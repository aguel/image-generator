"use client";

import { useEffect, useRef, useState } from "react";
import { getAspect } from "@/lib/aspects";
import { getStyle } from "@/lib/styles";
import { FPS, spring, SPRINGS } from "@/lib/motion";
import type { QueueJob, QueueSnapshot } from "@/lib/types";
import { Reveal } from "@/components/ui/Reveal";
import { Activity } from "@/components/ui/Activity";
import { downloadImage } from "./Tile";
import { IconClose, IconDownload, IconExpand, IconRetry, IconSweep } from "./icons";

type Filter = "all" | "active" | "done" | "failed";

/** Shared column template for the list header and every row. */
const ROW = "grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 md:grid-cols-[48px_minmax(0,1fr)_176px_112px_104px] md:gap-4";

function duration(from?: string, to?: string) {
  if (!from) return "";
  const s = Math.max(0, ((to ? Date.parse(to) : Date.now()) - Date.parse(from)) / 1000);
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

function ago(iso?: string) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

/** Re-renders while something is running so the live timers tick (slowly otherwise, for "min ago"). */
function useTicker(active: boolean) {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((t) => t + 1), active ? 250 : 15000);
    return () => clearInterval(id);
  }, [active]);
}

/** Springs a bar's fill to `value` with a Remotion spring (transform only). */
function useSpringFill(value: number) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = Number(el.dataset.v ?? 0);
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const s = spring({ frame: ((now - start) / 1000) * FPS, fps: FPS, config: SPRINGS.soft });
      const v = from + (value - from) * s;
      el.dataset.v = String(v);
      el.style.transform = `scaleX(${v})`;
      if (s < 0.999) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return ref;
}

function Bar({ value, tone }: { value: number; tone: string }) {
  const ref = useSpringFill(value);
  return (
    <span className="block h-2 overflow-hidden rounded-full bg-ink/[0.06]">
      <span ref={ref} className="block h-full origin-left rounded-full" style={{ background: tone, transform: "scaleX(0)" }} />
    </span>
  );
}

function SlotSegment({ on }: { on: boolean }) {
  const ref = useSpringFill(on ? 1 : 0);
  return (
    <span className="block h-2 flex-1 overflow-hidden rounded-full bg-ink/[0.06]">
      <span ref={ref} className="block h-full origin-left rounded-full bg-amber" style={{ transform: "scaleX(0)" }} />
    </span>
  );
}

/** One segment per worker slot; busy slots fill with a spring. */
function Slots({ busy, total }: { busy: number; total: number }) {
  return (
    <div className="flex gap-1.5" aria-hidden>
      {Array.from({ length: Math.min(total, 16) }, (_, i) => (
        <SlotSegment key={i} on={i < busy} />
      ))}
    </div>
  );
}

function Metric({ label, value, note, children }: { label: string; value: number; note: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <span className="text-[13.5px] font-medium text-ink">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-[36px] font-semibold leading-none tracking-[-0.04em] text-ink tabular-nums">{value}</span>
        <span className="text-[14px] text-ink-soft">{note}</span>
      </div>
      <div className="flex h-8 items-center">{children}</div>
    </div>
  );
}

function StatusPill({ job }: { job: QueueJob }) {
  if (job.status === "running")
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-amber-soft py-1 pl-1.5 pr-3 text-[13px] font-medium text-amber">
        <Activity size={16} tone="#d9822b" blade="#fbf1e6" label="Generating" />
        Generating
      </span>
    );
  const map = {
    queued: { text: `${job.position ?? "–"} in line`, dot: "bg-ink/40", cls: "bg-ink/[0.045] text-ink-soft" },
    done: { text: "Done", dot: "bg-teal", cls: "bg-teal/10 text-teal" },
    error: { text: "Failed", dot: "bg-danger", cls: "bg-danger/10 text-danger" },
    cancelled: { text: "Cancelled", dot: "bg-ink-faint", cls: "bg-ink/[0.045] text-ink-faint" },
  } as const;
  const m = map[job.status];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-medium ${m.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.text}
    </span>
  );
}

function IconAction({ label, onClick, tone, children }: { label: string; onClick: () => void; tone?: "danger"; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-9 w-9 place-items-center rounded-full text-ink-soft transition-colors duration-500 ease-fluid ${
        tone === "danger" ? "hover:bg-danger/10 hover:text-danger" : "hover:bg-ink/[0.06] hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function JobRow({
  job,
  delay,
  onCancel,
  onRetry,
  onOpen,
}: {
  job: QueueJob;
  delay: number;
  onCancel: () => void;
  onRetry: () => void;
  onOpen: () => void;
}) {
  const aspect = getAspect(job.aspect);
  const time =
    job.status === "running"
      ? { main: duration(job.startedAt), sub: "elapsed" }
      : job.status === "queued"
        ? { main: ago(job.createdAt), sub: "added" }
        : { main: job.status === "done" ? duration(job.startedAt, job.finishedAt) : "—", sub: ago(job.finishedAt) };

  return (
    <Reveal as="li" delay={delay} from="up" className={`${ROW} rounded-[16px] px-2 py-2 transition-colors duration-500 ease-fluid hover:bg-canvas`}>
      <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-[12px] bg-canvas text-[15px] font-semibold text-ink tabular-nums">
        {job.status === "done" && job.image ? (
          <button type="button" onClick={onOpen} aria-label="View image" data-hover="off" className="h-full w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/images/${job.image.id}`} alt="" className="h-full w-full object-cover" />
          </button>
        ) : job.status === "running" ? (
          <Activity size={24} label="Generating" />
        ) : job.status === "queued" ? (
          job.position
        ) : (
          <span className={job.status === "error" ? "text-danger" : "text-ink-faint"}>!</span>
        )}
      </span>

      <div className="min-w-0">
        <p className="truncate text-[14.5px] text-ink" title={job.prompt}>
          {job.prompt}
        </p>
        <p className="mt-0.5 truncate text-[13px] text-ink-soft">
          {getStyle(job.styleId).name} · {aspect.label} {aspect.ratio}
          {job.status === "error" && job.error ? <span className="text-danger"> · {job.error}</span> : null}
        </p>
      </div>

      <div className="hidden md:block">
        <StatusPill job={job} />
      </div>

      <div className="hidden flex-col leading-tight md:flex">
        <span className={`text-[14px] font-medium tabular-nums ${job.status === "running" ? "text-amber" : "text-ink"}`}>{time.main}</span>
        <span className="text-[12.5px] text-ink-faint">{time.sub}</span>
      </div>

      <div className="flex justify-end gap-0.5">
        {(job.status === "queued" || job.status === "running") && (
          <IconAction label="Cancel" tone="danger" onClick={onCancel}>
            <IconClose />
          </IconAction>
        )}
        {job.status === "done" && job.image && (
          <>
            <IconAction label="View image" onClick={onOpen}>
              <IconExpand />
            </IconAction>
            <IconAction label="Download" onClick={() => downloadImage(job.image!.id)}>
              <IconDownload />
            </IconAction>
          </>
        )}
        {(job.status === "error" || job.status === "cancelled") && (
          <IconAction label="Queue again" onClick={onRetry}>
            <IconRetry />
          </IconAction>
        )}
      </div>
    </Reveal>
  );
}

/**
 * A header action: a two-line label (what it does, and how many jobs it touches) with a trailing icon disc.
 * Danger actions sit on a soft red field and the disc fills red on hover; neutral ones are white with an ink disc.
 * Disabled actions turn into a quiet white card with faint text.
 */
function QueueAction({
  tone,
  label,
  note,
  icon,
  disabled,
  onClick,
}: {
  tone: "danger" | "ink";
  label: string;
  note: string;
  icon: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  const danger = tone === "danger";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group flex h-[52px] min-w-[200px] items-center justify-between gap-4 rounded-full py-1.5 pl-5 pr-1.5 text-left transition-[background-color,color,box-shadow] duration-500 ease-fluid focus-visible:outline-none focus-visible:ring-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink-faint disabled:shadow-[0_0_0_1px_rgba(14,14,13,0.07)] ${
        danger
          ? "bg-danger/[0.07] text-danger hover:bg-danger/[0.11] focus-visible:ring-danger/40"
          : "tile text-ink focus-visible:ring-ink/30"
      }`}
    >
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="text-[14.5px] font-semibold">{label}</span>
        <span className={`mt-0.5 truncate text-[12.5px] tabular-nums group-disabled:text-ink-faint ${danger ? "text-danger/70" : "text-ink-soft"}`}>{note}</span>
      </span>
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition-[background-color,color,transform] duration-500 ease-fluid group-hover:-rotate-12 group-disabled:rotate-0 group-disabled:bg-ink/[0.04] group-disabled:text-ink-faint ${
          danger ? "bg-danger/[0.12] group-hover:bg-danger group-hover:text-paper" : "bg-ink/[0.05] group-hover:bg-ink group-hover:text-paper"
        }`}
      >
        {icon}
      </span>
    </button>
  );
}

export function QueueView({
  snap,
  onCancel,
  onCancelWaiting,
  onRetry,
  onOpen,
  onClearFinished,
  onGo,
}: {
  snap: QueueSnapshot | null;
  onCancel: (job: QueueJob) => void;
  onCancelWaiting: (jobs: QueueJob[]) => void;
  onRetry: (job: QueueJob) => void;
  onOpen: (job: QueueJob) => void;
  onClearFinished: () => void;
  onGo: (view: "studio" | "prompts") => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  useTicker((snap?.running ?? 0) > 0);

  const jobs = snap?.jobs ?? [];
  const running = jobs.filter((j) => j.status === "running");
  const waiting = jobs.filter((j) => j.status === "queued").sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const finished = jobs.filter((j) => j.status === "done" || j.status === "error" || j.status === "cancelled").reverse();
  const done = finished.filter((j) => j.status === "done");
  const failed = finished.filter((j) => j.status !== "done");

  const active = filter === "all" || filter === "active";
  const groups = [
    { title: "In progress", items: active ? running : [] },
    { title: "Up next", items: active ? waiting : [] },
    {
      title: filter === "failed" ? "Failed or cancelled" : filter === "done" ? "Done" : "Finished",
      items: filter === "all" ? finished : filter === "done" ? done : filter === "failed" ? failed : [],
    },
  ].filter((g) => g.items.length > 0);

  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: jobs.length },
    { id: "active", label: "Active", count: running.length + waiting.length },
    { id: "done", label: "Done", count: done.length },
    { id: "failed", label: "Failed", count: failed.length },
  ];

  let rowIndex = 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Header */}
      <Reveal className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.035em] text-ink">Queue</h1>
          <p className="text-[14px] text-ink-soft">
            {snap
              ? `${snap.concurrency === 1 ? "One image is" : `${snap.concurrency} images are`} generated at a time; up to ${snap.queueSize} more wait in line.`
              : "Loading…"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <QueueAction
            tone="danger"
            label={waiting.length ? "Cancel waiting" : "Nothing waiting"}
            note={waiting.length ? `${waiting.length} image${waiting.length === 1 ? "" : "s"} in line` : "The line is empty"}
            disabled={waiting.length === 0}
            onClick={() => onCancelWaiting(waiting)}
            icon={<IconClose size={15} />}
          />
          <QueueAction
            tone="ink"
            label={finished.length ? "Clear finished" : "Nothing to clear"}
            note={finished.length ? `${finished.length} from this session` : "Finished jobs show here"}
            disabled={finished.length === 0}
            onClick={onClearFinished}
            icon={<IconSweep size={15} />}
          />
        </div>
      </Reveal>

      {/* Summary */}
      <Reveal delay={4} className="bezel shrink-0 [--r:28px]">
        <div className="bezel-core grid grid-cols-1 gap-6 p-5 sm:grid-cols-3 sm:gap-10">
          <Metric label="Generating now" value={running.length} note={`of ${snap?.concurrency ?? "–"} slots busy`}>
            <div className="w-full">
              <Slots busy={running.length} total={snap?.concurrency ?? 0} />
            </div>
          </Metric>
          <Metric label="Waiting in line" value={waiting.length} note={`of ${snap?.queueSize ?? "–"} places`}>
            <div className="w-full">
              <Bar value={snap?.queueSize ? waiting.length / snap.queueSize : 0} tone="var(--ink)" />
            </div>
          </Metric>
          <Metric label="Finished this session" value={done.length} note={failed.length ? `· ${failed.length} failed or cancelled` : "images"}>
            {done.length === 0 ? (
              <span className="text-[13px] text-ink-faint">Finished images appear here.</span>
            ) : (
              <div className="flex">
                {done.slice(0, 7).map((j, i) => (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => onOpen(j)}
                    aria-label="View image"
                    className="relative h-8 w-8 overflow-hidden rounded-[9px] ring-2 ring-paper"
                    style={{ marginLeft: i ? -6 : 0, zIndex: 10 - i }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/images/${j.image!.id}`} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
                {done.length > 7 && (
                  <span className="relative grid h-8 min-w-8 place-items-center rounded-[9px] bg-canvas px-1.5 text-[12px] font-medium text-ink-soft ring-2 ring-paper" style={{ marginLeft: -6 }}>
                    +{done.length - 7}
                  </span>
                )}
              </div>
            )}
          </Metric>
        </div>
      </Reveal>

      {/* Job list */}
      <Reveal delay={8} from="blur" className="bezel flex min-h-[420px] flex-1 lg:min-h-0 [--r:30px]">
        <div className="bezel-core flex min-h-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
            <div role="tablist" aria-label="Filter jobs" className="seg flex rounded-full p-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === t.id}
                  onClick={() => setFilter(t.id)}
                  className={`flex h-8 items-center gap-2 rounded-full px-3.5 text-[13.5px] font-medium transition-[background-color,color] duration-500 ease-fluid ${
                    filter === t.id ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {t.label}
                  <span className={`text-[12px] tabular-nums ${filter === t.id ? "text-paper/60" : "text-ink-faint"}`}>{t.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={`${ROW} mt-3 hidden px-6 pb-1 text-[12.5px] font-medium text-ink-faint md:grid`}>
            <span />
            <span>Prompt</span>
            <span>Status</span>
            <span>Time</span>
            <span className="text-right">Actions</span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-1">
            {snap === null ? (
              <div className="flex h-full items-center justify-center gap-3 text-[14px] text-ink-soft">
                <Activity size={22} label="Loading queue" /> Loading the queue…
              </div>
            ) : groups.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
                <p className="text-[22px] font-semibold tracking-[-0.025em] text-ink">
                  {filter === "all" ? "Nothing in the queue" : `No ${tabs.find((t) => t.id === filter)?.label.toLowerCase()} jobs`}
                </p>
                <p className="max-w-[400px] text-[15px] text-ink-soft">
                  Generate in the Studio, or turn an idea into prompts and queue the ones you like.
                </p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => onGo("studio")} className="h-10 rounded-full bg-ink px-5 text-[14px] font-medium text-paper">
                    Go to Studio
                  </button>
                  <button type="button" onClick={() => onGo("prompts")} className="chip h-10 rounded-full px-5 text-[14px]">
                    Write prompts
                  </button>
                </div>
              </div>
            ) : (
              groups.map((g) => (
                <section key={g.title} className="mb-3 last:mb-0">
                  <h2 className="sticky top-0 z-10 flex items-baseline gap-2 bg-paper px-2 pb-1.5 pt-2 text-[13.5px] font-semibold text-ink">
                    {g.title}
                    <span className="font-normal text-ink-faint tabular-nums">{g.items.length}</span>
                  </h2>
                  <ul className="flex flex-col gap-0.5">
                    {g.items.map((job) => (
                      <JobRow
                        key={job.id}
                        job={job}
                        delay={Math.min(rowIndex++, 14) * 2}
                        onCancel={() => onCancel(job)}
                        onRetry={() => onRetry(job)}
                        onOpen={() => onOpen(job)}
                      />
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>
        </div>
      </Reveal>
    </div>
  );
}
