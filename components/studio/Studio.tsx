"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage } from "@/components/remotion/Stage";
import { Viewfinder } from "@/components/remotion/compositions";
import { Reveal } from "@/components/ui/Reveal";
import { Activity } from "@/components/ui/Activity";
import { ConfirmDialog, type ConfirmRequest } from "@/components/ui/ConfirmDialog";
import { Toasts, type Toast } from "@/components/ui/Toasts";
import { HoverFX } from "@/components/ui/HoverFX";
import { DEFAULT_ASPECT, getAspect, type AspectId } from "@/lib/aspects";
import { DEFAULT_STYLE, getStyle, type StyleId } from "@/lib/styles";
import type { BackupSummary, EnhancedPrompt, ImageRecord, QueueJob } from "@/lib/types";
import { useQueue, type QueueItem } from "@/lib/useQueue";
import { Composer, type ComposerState } from "./Composer";
import { JobTile } from "./Tile";
import { QueueView } from "./QueueView";
import { PromptsView, INITIAL_LAB, type PromptLab } from "./PromptsView";
import { FitGrid } from "./FitGrid";
import { Gallery } from "./Gallery";
import { Lightbox } from "./Lightbox";
import { BackupDrawer } from "./BackupDrawer";
import { NavIsland, type View } from "./NavIsland";
import { IconGrid } from "./icons";

const SETTINGS_KEY = "darkroom:composer";
const DEFAULTS: ComposerState = { prompt: "", styleId: DEFAULT_STYLE, aspect: DEFAULT_ASPECT, count: 4 };

/** One press of Generate (or one "Add to queue" from Prompts): the jobs shown together on the Studio canvas. */
interface Batch {
  id: string;
  roll: number;
  /** Headline for the canvas: the prompt, or a summary when several prompts were queued. */
  title: string;
  styleId: StyleId;
  aspect: AspectId;
  jobIds: string[];
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Request failed (${res.status})`);
  return json as T;
}

export function Studio() {
  const [view, setView] = useState<View>("studio");
  const [settings, setSettings] = useState<ComposerState>(DEFAULTS);
  const [library, setLibrary] = useState<ImageRecord[] | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [deleted, setDeleted] = useState<Set<string>>(() => new Set());
  const [lab, setLab] = useState<PromptLab>(INITIAL_LAB);
  const [config, setConfig] = useState<{ model: string; completionModel: string; keyConfigured: boolean } | null>(null);
  const [viewer, setViewer] = useState<{ ids: string[]; id: string } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [backups, setBackups] = useState<BackupSummary[] | null>(null);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const rollCounter = useRef(0);

  const toast = useCallback((message: string, tone: Toast["tone"] = "info") => {
    setToasts((t) => [...t, { id: ++toastId.current, message, tone }]);
  }, []);
  const dropToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  /* ---------- bootstrapping ---------- */
  const loadLibrary = useCallback(async () => {
    try {
      const { images } = await api<{ images: ImageRecord[] }>("/api/images");
      setLibrary(images);
    } catch (e) {
      setLibrary([]);
      toast((e as Error).message, "error");
    }
  }, [toast]);

  useEffect(() => {
    // Restore saved composer settings after hydration (server render always uses the defaults).
    Promise.resolve().then(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null") as Partial<ComposerState> | null;
        if (saved) setSettings((s) => ({ ...s, ...saved, styleId: getStyle(saved.styleId).id, aspect: getAspect(saved.aspect).id }));
      } catch {
        /* storage unavailable */
      }
      loadLibrary();
    });
    api<{ model: string; completionModel: string; keyConfigured: boolean }>("/api/config").then(setConfig, () => undefined);
  }, [loadLibrary]);

  const updateSettings = useCallback((next: Partial<ComposerState>) => {
    setSettings((s) => {
      const merged = { ...s, ...next };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
      } catch {
        /* ignore */
      }
      return merged;
    });
  }, []);

  /* ---------- queue ---------- */
  const onImage = useCallback((image: ImageRecord) => {
    setLibrary((lib) => (lib === null || lib.some((r) => r.id === image.id) ? lib : [image, ...lib]));
  }, []);
  const queue = useQueue(onImage);
  const snap = queue.snap;
  const running = snap?.running ?? 0;
  const waiting = snap?.queued ?? 0;
  const room = snap ? Math.max(0, snap.queueSize - snap.queued + Math.max(0, snap.concurrency - snap.running)) : null;

  /** Queues items as a new batch shown on the Studio canvas. Returns false when the queue refused them. */
  const queueBatch = useCallback(
    async (items: QueueItem[], title: string, styleId: StyleId, aspect: AspectId) => {
      const id = crypto.randomUUID();
      try {
        const jobs = await queue.enqueue(items, id);
        setBatches((b) => [{ id, roll: ++rollCounter.current, title, styleId, aspect, jobIds: jobs.map((j) => j.id) }, ...b]);
        return true;
      } catch (e) {
        toast((e as Error).message, "error");
        return false;
      }
    },
    [queue, toast],
  );

  const generate = useCallback(() => {
    const prompt = settings.prompt.trim();
    if (!prompt) return;
    const items = Array.from({ length: settings.count }, () => ({ prompt, styleId: settings.styleId, aspect: settings.aspect }));
    queueBatch(items, prompt, settings.styleId, settings.aspect);
  }, [settings, queueBatch]);

  const retry = useCallback(
    async (job: QueueJob) => {
      try {
        const [fresh] = await queue.enqueue([{ prompt: job.prompt, styleId: job.styleId, aspect: job.aspect }], job.batchId);
        setBatches((bs) => bs.map((b) => ({ ...b, jobIds: b.jobIds.map((id) => (id === job.id ? fresh.id : id)) })));
      } catch (e) {
        toast((e as Error).message, "error");
      }
    },
    [queue, toast],
  );

  const cancelJob = useCallback(
    (job: QueueJob) => queue.cancel(job.id).catch((e) => toast((e as Error).message, "error")),
    [queue, toast],
  );

  /* ---------- prompt enhancement ---------- */
  const updateLab = useCallback((next: Partial<PromptLab>) => setLab((l) => ({ ...l, ...next })), []);

  const enhance = useCallback(async () => {
    const idea = lab.idea.trim();
    if (!idea) return;
    updateLab({ loading: true, error: null });
    try {
      const { prompts, model } = await api<{ prompts: EnhancedPrompt[]; model: string }>("/api/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: idea, count: lab.variations }),
      });
      updateLab({ results: prompts, selected: prompts.map(() => true), sourceIdea: idea, model, loading: false });
    } catch (e) {
      updateLab({ loading: false, error: (e as Error).message });
    }
  }, [lab.idea, lab.variations, updateLab]);

  const addLabToQueue = useCallback(async () => {
    const chosen = (lab.results ?? []).filter((_, i) => lab.selected[i]);
    if (!chosen.length) return;
    const items = chosen.flatMap((p) =>
      Array.from({ length: lab.perPrompt }, () => ({ prompt: p.prompt, styleId: lab.styleId, aspect: lab.aspect })),
    );
    const title = chosen.length === 1 ? chosen[0].prompt : `${chosen.length} prompts from “${lab.sourceIdea}”`;
    if (await queueBatch(items, title, lab.styleId, lab.aspect)) {
      toast(`Added ${items.length} image${items.length === 1 ? "" : "s"} to the queue.`, "success");
    }
  }, [lab, queueBatch, toast]);

  const useInStudio = useCallback(
    (prompt: string) => {
      updateSettings({ prompt });
      setView("studio");
    },
    [updateSettings],
  );

  /* ---------- viewer ---------- */
  const openViewer = useCallback((image: ImageRecord, list: ImageRecord[]) => {
    setViewer({ ids: list.map((r) => r.id), id: image.id });
  }, []);

  /* ---------- deletion ---------- */
  const askDelete = useCallback(
    (image: ImageRecord) =>
      setConfirm({
        title: "Delete this image?",
        body: "It will be removed from your gallery. Any backups you have made keep their copy.",
        confirmLabel: "Delete image",
        variant: "delete",
        onConfirm: async () => {
          await api(`/api/images/${image.id}`, { method: "DELETE" });
          setLibrary((lib) => (lib ?? []).filter((r) => r.id !== image.id));
          setViewer((v) => {
            if (!v) return v;
            const i = v.ids.indexOf(image.id);
            const ids = v.ids.filter((id) => id !== image.id);
            if (!ids.length) return null;
            return { ids, id: v.id === image.id ? ids[Math.min(i, ids.length - 1)] : v.id };
          });
          setDeleted((d) => new Set(d).add(image.id));
          toast("Image deleted.");
        },
      }),
    [toast],
  );

  /* ---------- backups ---------- */
  const loadBackups = useCallback(async () => {
    setBackupsLoading(true);
    try {
      setBackups((await api<{ backups: BackupSummary[] }>("/api/backup")).backups);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBackupsLoading(false);
    }
  }, [toast]);

  const openVault = () => {
    setVaultOpen(true);
    loadBackups();
  };

  const createSnapshot = async () => {
    setCreatingBackup(true);
    try {
      const { backup } = await api<{ backup: BackupSummary }>("/api/backup", { method: "POST", body: "{}" });
      setBackups((b) => [backup, ...(b ?? [])]);
      toast(`Backup created with ${backup.imageCount} image${backup.imageCount === 1 ? "" : "s"}.`, "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setCreatingBackup(false);
    }
  };

  const askRestore = (b: BackupSummary) =>
    setConfirm({
      title: "Restore this backup?",
      body: `Your gallery will be replaced with the ${b.imageCount} image${b.imageCount === 1 ? "" : "s"} from ${new Date(b.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}. Create a new backup first if you want to keep what you have now.`,
      confirmLabel: "Restore",
      variant: "restore",
      onConfirm: async () => {
        await api(`/api/backup/${b.id}/restore`, { method: "POST" });
        setBatches([]);
        await loadLibrary();
        toast("Gallery restored from backup.", "success");
      },
    });

  const askDeleteBackup = (b: BackupSummary) =>
    setConfirm({
      title: "Delete this backup?",
      body: "This backup and the image copies inside it will be permanently removed. Your gallery is not affected.",
      confirmLabel: "Delete backup",
      variant: "delete",
      onConfirm: async () => {
        await api(`/api/backup/${b.id}`, { method: "DELETE" });
        setBackups((list) => (list ?? []).filter((x) => x.id !== b.id));
        toast("Backup deleted.");
      },
    });

  const runConfirm = async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      await confirm.onConfirm();
      setConfirm(null);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setConfirmBusy(false);
    }
  };

  /* ---------- derived ---------- */
  const batch = batches[0];
  const batchJobs = useMemo(() => {
    if (!batch || !snap) return [];
    const byId = new Map(snap.jobs.map((j) => [j.id, j]));
    return batch.jobIds
      .map((id) => byId.get(id))
      .filter((j): j is QueueJob => Boolean(j) && !(j!.image && deleted.has(j!.image.id)));
  }, [batch, snap, deleted]);
  const batchPending = batchJobs.filter((j) => j.status === "queued" || j.status === "running").length;
  const batchDone = batchJobs.filter((j) => j.status === "done").length;
  const elsewhere = running + waiting - batchPending;
  const viewerImages = useMemo(() => {
    if (!viewer || !library) return [];
    const byId = new Map(library.map((r) => [r.id, r]));
    return viewer.ids.map((id) => byId.get(id)).filter((r): r is ImageRecord => Boolean(r));
  }, [viewer, library]);
  const viewerIndex = viewer ? viewerImages.findIndex((r) => r.id === viewer.id) : -1;

  return (
    <div className="flex min-h-dvh flex-col bg-paper lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      <HoverFX />
      <NavIsland
        view={view}
        onView={setView}
        galleryCount={library?.length ?? null}
        running={running}
        waiting={waiting}
        onVault={openVault}
      />

      <main className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-3 md:px-5 md:pb-5 lg:pt-4">
        {view === "studio" ? (
          <div key="studio" className="grid min-h-0 flex-1 grid-cols-1 gap-3 short:gap-2 lg:grid-cols-[minmax(340px,392px)_minmax(0,1fr)]">
            <Composer
              state={settings}
              onChange={updateSettings}
              onGenerate={generate}
              running={running + waiting}
              progress={batch && batchPending > 0 ? { done: batchDone, total: batchJobs.length } : null}
              queue={snap ? { running, waiting, concurrency: snap.concurrency, queueSize: snap.queueSize } : null}
              keyConfigured={config?.keyConfigured ?? null}
            />

            {/* Canvas */}
            <Reveal from="blur" delay={6} className="bezel flex min-h-[70vh] lg:min-h-0 [--r:30px]">
              <div className="bezel-core flex min-h-0 flex-1 flex-col p-4 md:p-5">
                <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                  <div className="min-w-0">
                    <span className="label">
                      {batch
                        ? `Batch ${batch.roll} · ${batch.jobIds.length} image${batch.jobIds.length === 1 ? "" : "s"} · ${getStyle(batch.styleId).name} · ${getAspect(batch.aspect).label} ${getAspect(batch.aspect).ratio}`
                        : "Current batch"}
                    </span>
                    <h1 className="mt-1 line-clamp-2 text-[20px] font-semibold leading-snug tracking-[-0.02em] text-ink md:text-[22px] lg:line-clamp-1">
                      {batch ? batch.title : "Your images will appear here"}
                    </h1>
                  </div>
                  <div className="flex items-center gap-2">
                    {batch && (
                      <span className="chip flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px]">
                        {batchPending > 0 ? (
                          <>
                            <Activity size={15} label="Generating" /> {batchDone} of {batchJobs.length} ready
                          </>
                        ) : (
                          <>{batchDone === 1 ? "1 image ready" : `${batchDone} images ready`}</>
                        )}
                        {elsewhere > 0 && (
                          <button type="button" onClick={() => setView("queue")} className="text-ink-faint underline-offset-2 hover:text-ink hover:underline">
                            · {elsewhere} more in queue
                          </button>
                        )}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setView("gallery")}
                      className="chip group flex h-9 items-center gap-2 rounded-full pl-3.5 pr-1.5 text-[13px]"
                    >
                      Open gallery
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-paper transition-transform duration-500 ease-fluid group-hover:scale-105">
                        <IconGrid size={12} />
                      </span>
                    </button>
                  </div>
                </header>

                {batch && batchJobs.length > 0 ? (
                  <div className="mt-4 flex min-h-0 flex-1">
                    <FitGrid key={batch.id} count={batchJobs.length} ratio={getAspect(batch.aspect).width / getAspect(batch.aspect).height}>
                      {batchJobs.map((job, i) => (
                        <Reveal key={`${batch.id}-${i}`} from="scale" delay={i * 4} spring="snappy">
                          <JobTile
                            job={job}
                            index={i}
                            onOpen={() => job.image && openViewer(job.image, batchJobs.flatMap((j) => (j.image ? [j.image] : [])))}
                            onDelete={() => job.image && askDelete(job.image)}
                            onRetry={() => retry(job)}
                            onCancel={() => cancelJob(job)}
                          />
                        </Reveal>
                      ))}
                    </FitGrid>
                  </div>
                ) : (
                  <div className="relative mt-4 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[20px] bg-canvas">
                    <Stage component={Viewfinder} inputProps={{ reticle: false }} width={1280} height={720} duration={240} cover className="absolute inset-0 h-full w-full" />
                    <div className="pointer-events-none relative flex flex-col items-center px-6 text-center">
                      <p className="text-[26px] font-semibold leading-tight tracking-[-0.025em] text-ink md:text-[30px]">No images yet</p>
                      <p className="mt-2 max-w-[380px] text-[15px] leading-relaxed text-ink-soft">
                        Write a prompt, pick a style, aspect ratio and number of images, then press Generate. Every image is also saved to the Gallery.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Reveal>
          </div>
        ) : view === "prompts" ? (
          <PromptsView
            key="prompts"
            lab={lab}
            onChange={updateLab}
            onEnhance={enhance}
            onAddToQueue={addLabToQueue}
            onUseInStudio={useInStudio}
            room={room}
          />
        ) : view === "queue" ? (
          <div key="queue" className="flex min-h-0 flex-1 flex-col">
            <QueueView
              snap={snap}
              onCancel={cancelJob}
              onRetry={retry}
              onOpen={(job) => job.image && openViewer(job.image, (snap?.jobs ?? []).flatMap((j) => (j.image && !deleted.has(j.image.id) ? [j.image] : [])))}
              onClearFinished={() => queue.clearFinished().catch((e) => toast((e as Error).message, "error"))}
              onGo={setView}
            />
          </div>
        ) : (
          <div key="gallery" className="flex min-h-0 flex-1 flex-col">
            <Gallery library={library} onOpen={openViewer} onDelete={askDelete} onGoStudio={() => setView("studio")} />
          </div>
        )}
      </main>

      <Lightbox
        images={viewerImages}
        index={viewerIndex >= 0 ? viewerIndex : null}
        onClose={() => setViewer(null)}
        onNavigate={(i) => setViewer((v) => (v ? { ...v, id: viewerImages[i]?.id ?? v.id } : v))}
        onDelete={askDelete}
      />
      <BackupDrawer
        open={vaultOpen}
        backups={backups}
        loading={backupsLoading}
        creating={creatingBackup}
        onClose={() => setVaultOpen(false)}
        onCreate={createSnapshot}
        onRestore={askRestore}
        onDelete={askDeleteBackup}
      />
      <ConfirmDialog request={confirm} busy={confirmBusy} onCancel={() => setConfirm(null)} onConfirm={runConfirm} />
      <Toasts toasts={toasts} onDone={dropToast} />
    </div>
  );
}
