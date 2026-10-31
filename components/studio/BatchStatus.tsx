"use client";

import { useEffect, useRef } from "react";
import { FPS, spring, SPRINGS } from "@/lib/motion";
import { IconArrow } from "./icons";

const R = 15;
const CIRC = 2 * Math.PI * R;

/** Progress ring whose arc springs to the new value (Remotion spring, stroke only). */
function ProgressRing({ value, state }: { value: number; state: "running" | "done" | "partial" }) {
  const arc = useRef<SVGCircleElement>(null);
  useEffect(() => {
    const el = arc.current;
    if (!el) return;
    const from = Number(el.dataset.v ?? 0);
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const s = spring({ frame: ((now - start) / 1000) * FPS, fps: FPS, config: SPRINGS.soft });
      const v = from + (value - from) * s;
      el.dataset.v = String(v);
      el.style.strokeDashoffset = String(CIRC * (1 - v));
      if (s < 0.999) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span className="relative grid h-10 w-10 shrink-0 place-items-center">
      <svg width="40" height="40" viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="20" cy="20" r={R} fill="none" stroke="rgba(14,14,13,0.08)" strokeWidth="3" />
        <circle
          ref={arc}
          cx="20"
          cy="20"
          r={R}
          fill="none"
          stroke={state === "done" ? "var(--teal)" : state === "partial" ? "var(--danger)" : "var(--amber)"}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          style={{ strokeDashoffset: CIRC, transition: "stroke 500ms cubic-bezier(0.32,0.72,0,1)" }}
        />
      </svg>
      {state === "partial" ? (
        <span className="text-[13px] font-bold text-danger">!</span>
      ) : state === "done" ? (
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="text-teal">
          <path d="M3 7.5l2.6 2.6L11 4.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <span className="text-[11px] font-semibold tabular-nums text-ink">{Math.round(value * 100)}%</span>
      )}
    </span>
  );
}

/**
 * Batch status capsule for the Studio header: progress ring + readable status
 * on the left, and the Gallery shortcut (button-in-button arrow) on the right.
 */
export function BatchStatus({
  done,
  total,
  pending,
  elsewhere,
  onQueue,
  onGallery,
}: {
  done: number;
  total: number;
  pending: number;
  /** Jobs from other batches still queued or running. */
  elsewhere: number;
  onQueue: () => void;
  onGallery: () => void;
}) {
  const hasBatch = total > 0;
  const finished = hasBatch && pending === 0;
  const failed = total - done - pending;

  return (
    <div className="island flex h-[52px] items-center gap-1 rounded-full p-1.5">
      {hasBatch && (
        <>
          <button
            type="button"
            onClick={onQueue}
            title="Open the queue"
            className="flex h-10 items-center gap-2.5 rounded-full pr-3 text-left transition-colors duration-500 ease-fluid hover:bg-ink/[0.035]"
          >
            <ProgressRing value={total ? (finished ? 1 : done / total) : 0} state={!finished ? "running" : failed > 0 ? "partial" : "done"} />
            <span className="flex flex-col leading-tight">
              <span className="text-[13.5px] font-semibold tracking-[-0.01em] text-ink tabular-nums">
                {finished ? (done === 1 ? "1 image ready" : `${done} images ready`) : `${done} of ${total} ready`}
              </span>
              <span className="text-[12px] text-ink-faint tabular-nums">
                {finished
                  ? failed > 0
                    ? `${failed} failed or cancelled`
                    : elsewhere > 0
                      ? `${elsewhere} more in the queue`
                      : "Batch complete"
                  : `${pending} in progress${elsewhere > 0 ? ` · ${elsewhere} more queued` : ""}`}
              </span>
            </span>
          </button>
          <span className="mx-1 h-6 w-px bg-hair-strong" aria-hidden />
        </>
      )}
      <button
        type="button"
        onClick={onGallery}
        className="group flex h-10 items-center gap-2.5 rounded-full pl-3.5 pr-1 text-[13.5px] font-semibold text-ink transition-colors duration-500 ease-fluid hover:bg-ink/[0.035]"
      >
        Gallery
        <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-paper shadow-[0_6px_14px_-6px_rgba(14,14,13,0.6)] transition-transform duration-500 ease-fluid group-hover:-translate-y-px group-hover:translate-x-0.5 group-hover:scale-105">
          <IconArrow size={14} />
        </span>
      </button>
    </div>
  );
}
