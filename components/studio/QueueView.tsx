"use client";

import { useEffect, useRef, useState } from "react";
import { getAspect } from "@/lib/aspects";
import { getStyle } from "@/lib/styles";
import { FPS, spring, SPRINGS } from "@/lib/motion";
import type { QueueJob, QueueSnapshot } from "@/lib/types";
import { Reveal } from "@/components/ui/Reveal";
import { Activity } from "@/components/ui/Activity";
import { IconClose, IconExpand, IconRetry } from "./icons";

const STATUS: Record<QueueJob["status"], { label: string; cls: string }> = {
  queued: { label: "Waiting", cls: "chip" },
  running: { label: "Generating", cls: "bg-amber-soft text-amber" },
  done: { label: "Done", cls: "bg-teal/10 text-teal" },
  error: { label: "Failed", cls: "bg-danger/10 text-danger" },
  cancelled: { label: "Cancelled", cls: "chip !text-ink-faint" },
};

function seconds(from?: string, to?: string) {
  if (!from) return null;
  const end = to ? Date.parse(to) : Date.now();
  return `${Math.max(0, (end - Date.parse(from)) / 1000).toFixed(1)}s`;
}

/** Re-renders every 500ms while something is running so elapsed times tick. */
function useTicker(active: boolean) {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setT((t) => t + 1), 500);
    return () => clearInterval(id);
  }, [active]);
}

/** Capacity meter: fill springs to its value (transform only). */
function Meter({ value, tone }: { value: number; tone: string }) {
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
  return (
    <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-ink/[0.06]">
      <span ref={ref} className="block h-full origin-left rounded-full" style={{ background: tone, transform: "scaleX(0)" }} />
    </span>
  );
}

function Stat({ label, value, of, tone, children }: { label: string; value: number; of?: number; tone: string; children?: React.ReactNode }) {
  return (
    <div className="bezel flex-1">
      <div className="bezel-core h-full p-4">
        <div className="flex items-center justify-between">
          <span className="eyebrow">{label}</span>
          {children}
        </div>
        <p className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.03em] text-ink tabular-nums">
          {value}
          {of !== undefined && <span className="ml-1 text-[15px] font-medium text-ink-faint">/ {of}</span>}
        </p>
        {of !== undefined && <Meter value={of ? value / of : 0} tone={tone} />}
      </div>
    </div>
  );
}

export function QueueView({
  snap,
  onCancel,
  onRetry,
  onOpen,
  onClearFinished,
  onGo,
}: {
  snap: QueueSnapshot | null;
  onCancel: (job: QueueJob) => void;
  onRetry: (job: QueueJob) => void;
  onOpen: (job: QueueJob) => void;
  onClearFinished: () => void;
  onGo: (view: "studio" | "prompts") => void;
}) {
  useTicker((snap?.running ?? 0) > 0);
  // Newest first; the line order for waiting jobs is kept in their position number.
  const jobs = [...(snap?.jobs ?? [])].reverse();
  const finished = jobs.filter((j) => j.status === "done").length;
  const failed = jobs.filter((j) => j.status === "error").length;
  const clearable = jobs.some((j) => j.status === "done" || j.status === "error" || j.status === "cancelled");

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <Reveal className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-ink md:text-[32px]">Queue</h1>
          <p className="label !text-[13px]">
            {snap
              ? `Up to ${snap.concurrency} images generate at once, and up to ${snap.queueSize} can wait in line.`
              : "Loading…"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClearFinished}
          disabled={!clearable}
          className="chip h-9 rounded-full px-4 text-[13.5px] font-medium"
        >
          Clear finished
        </button>
      </Reveal>

      <Reveal delay={4} className="flex shrink-0 flex-col gap-3 sm:flex-row">
        <Stat label="Generating" value={snap?.running ?? 0} of={snap?.concurrency ?? 0} tone="var(--amber)">
          {(snap?.running ?? 0) > 0 && <Activity size={18} label="Generating" />}
        </Stat>
        <Stat label="Waiting" value={snap?.queued ?? 0} of={snap?.queueSize ?? 0} tone="var(--ink)" />
        <Stat label="Finished" value={finished} tone="var(--teal)">
          {failed > 0 && <span className="text-[12.5px] font-medium text-danger">{failed} failed</span>}
        </Stat>
      </Reveal>

      <Reveal delay={8} from="blur" className="bezel flex min-h-[320px] flex-1 lg:min-h-0 [--r:30px]">
        <div className="bezel-core flex min-h-0 flex-1 flex-col overflow-hidden">
          {snap === null ? (
            <div className="flex flex-1 items-center justify-center gap-3 text-[14px] text-ink-soft">
              <Activity size={22} label="Loading queue" /> Loading the queue…
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-[24px] font-semibold tracking-[-0.025em] text-ink">The queue is empty</p>
              <p className="max-w-[380px] text-[15px] text-ink-soft">
                Images you generate in the Studio, or prompts you add from Prompts, line up here.
              </p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => onGo("studio")} className="h-10 rounded-full bg-ink px-5 text-[14px] font-medium text-paper">
                  Go to Studio
                </button>
                <button type="button" onClick={() => onGo("prompts")} className="chip h-10 rounded-full px-5 text-[14px] font-medium">
                  Write prompts
                </button>
              </div>
            </div>
          ) : (
            <ol className="min-h-0 flex-1 divide-y divide-hair overflow-y-auto">
              {jobs.map((job, i) => {
                const st = STATUS[job.status];
                const aspect = getAspect(job.aspect);
                const time = job.status === "queued" ? null : seconds(job.startedAt, job.finishedAt);
                return (
                  <Reveal as="li" key={job.id} delay={Math.min(i, 12) * 2} from="right" className="flex items-center gap-4 px-4 py-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[12px] bg-canvas text-[14px] font-semibold text-ink-soft tabular-nums">
                      {job.status === "done" && job.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/images/${job.image.id}`} alt="" className="h-full w-full object-cover" />
                      ) : job.status === "running" ? (
                        <Activity size={26} label="Generating" />
                      ) : job.status === "queued" ? (
                        `#${job.position ?? "–"}`
                      ) : (
                        "–"
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] text-ink" title={job.prompt}>
                        {job.prompt}
                      </p>
                      <p className="label mt-0.5 truncate">
                        {getStyle(job.styleId).name} · {aspect.label} {aspect.ratio}
                        {time && ` · ${time}`}
                        {job.status === "error" && job.error && <span className="text-danger"> · {job.error}</span>}
                      </p>
                    </div>
                    <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium sm:inline ${st.cls}`}>{st.label}</span>
                    <div className="flex shrink-0 gap-1">
                      {(job.status === "queued" || job.status === "running") && (
                        <button
                          type="button"
                          onClick={() => onCancel(job)}
                          aria-label="Cancel"
                          title="Cancel"
                          className="grid h-9 w-9 place-items-center rounded-full text-ink-soft transition-colors duration-500 ease-fluid hover:bg-danger/10 hover:text-danger"
                        >
                          <IconClose />
                        </button>
                      )}
                      {job.status === "done" && (
                        <button
                          type="button"
                          onClick={() => onOpen(job)}
                          aria-label="View image"
                          title="View image"
                          className="grid h-9 w-9 place-items-center rounded-full text-ink-soft transition-colors duration-500 ease-fluid hover:bg-ink/[0.06] hover:text-ink"
                        >
                          <IconExpand />
                        </button>
                      )}
                      {(job.status === "error" || job.status === "cancelled") && (
                        <button
                          type="button"
                          onClick={() => onRetry(job)}
                          aria-label="Queue again"
                          title="Queue again"
                          className="grid h-9 w-9 place-items-center rounded-full text-ink-soft transition-colors duration-500 ease-fluid hover:bg-ink/[0.06] hover:text-ink"
                        >
                          <IconRetry />
                        </button>
                      )}
                    </div>
                  </Reveal>
                );
              })}
            </ol>
          )}
        </div>
      </Reveal>
    </div>
  );
}
