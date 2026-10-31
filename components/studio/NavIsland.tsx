"use client";

import { useLayoutEffect, useRef } from "react";
import { Stage } from "@/components/remotion/Stage";
import { LogoMark } from "@/components/remotion/compositions";
import { Reveal } from "@/components/ui/Reveal";
import { Activity } from "@/components/ui/Activity";
import { FPS, spring, SPRINGS } from "@/lib/motion";
import { IconArchive } from "./icons";

export type View = "studio" | "prompts" | "queue" | "gallery";

/** Floating pill navigation: logo, the four menus and backups. */
export function NavIsland({
  view,
  onView,
  galleryCount,
  running,
  waiting,
  onVault,
}: {
  view: View;
  onView: (v: View) => void;
  galleryCount: number | null;
  /** Jobs generating right now. */
  running: number;
  /** Jobs waiting in the queue. */
  waiting: number;
  onVault: () => void;
}) {
  const indicator = useRef<HTMLSpanElement>(null);
  const tabs = useRef<Record<View, HTMLButtonElement | null>>({ studio: null, prompts: null, queue: null, gallery: null });

  // Slide the active-tab plate with a Remotion spring.
  useLayoutEffect(() => {
    const el = indicator.current;
    const target = tabs.current[view];
    if (!el || !target) return;
    const fromX = Number(el.dataset.x ?? target.offsetLeft);
    const fromW = Number(el.dataset.w ?? target.offsetWidth);
    const toX = target.offsetLeft;
    const toW = target.offsetWidth;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const s = spring({ frame: ((now - start) / 1000) * FPS, fps: FPS, config: SPRINGS.snappy });
      const x = fromX + (toX - fromX) * s;
      const w = fromW + (toW - fromW) * s;
      el.dataset.x = String(x);
      el.dataset.w = String(w);
      el.style.transform = `translateX(${x}px)`;
      el.style.width = `${w}px`;
      if (s < 0.999) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [view, galleryCount, running, waiting]);

  // Plain render helper (not a component) so buttons keep identity and focus across renders.
  const tab = (id: View, children: React.ReactNode) => (
    <button
      ref={(el) => {
        tabs.current[id] = el;
      }}
      type="button"
      role="tab"
      aria-selected={view === id}
      onClick={() => onView(id)}
      className={`relative z-10 flex h-9 items-center gap-1.5 rounded-full px-3 text-[13.5px] font-medium sm:gap-2 sm:px-4 sm:text-[14px] transition-colors duration-500 ease-fluid ${
        view === id ? "text-paper" : "text-ink-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );

  const badge = (id: View, value: number) => (
    <span
      className={`rounded-full px-1.5 py-px text-[11.5px] font-medium tabular-nums transition-colors duration-500 ease-fluid ${
        view === id ? "bg-paper/15 text-paper" : "bg-amber-soft text-amber"
      }`}
    >
      {value}
    </span>
  );
  const spinner = (id: View) => (
    <Activity
      size={14}
      tone={view === id ? "#ffffff" : "#0e0e0d"}
      blade={view === id ? "#0e0e0d" : "#ffffff"}
      label={`${running} generating`}
    />
  );

  return (
    <Reveal
      as="nav"
      from="down"
      spring="snappy"
      aria-label="Primary"
      className="relative z-30 mx-auto mt-3 flex w-[calc(100%-1.5rem)] items-center justify-between gap-2 rounded-full bg-paper/80 p-1.5 shadow-[0_0_0_1px_rgba(14,14,13,0.06),0_12px_40px_-18px_rgba(14,14,13,0.25)] backdrop-blur-2xl md:w-max md:justify-start md:gap-1"
    >
      <div className="flex items-center gap-2 pl-1.5 pr-2">
        <Stage component={LogoMark} width={96} height={96} duration={240} className="h-7 w-7" />
        <span className="hidden font-display text-[21px] italic leading-none tracking-[-0.01em] md:inline">Darkroom</span>
      </div>

      <div role="tablist" aria-label="Views" className="relative flex items-center rounded-full p-0.5">
        <span ref={indicator} aria-hidden className="pointer-events-none absolute bottom-0.5 left-0 top-0.5 rounded-full bg-ink shadow-[0_6px_16px_-8px_rgba(14,14,13,0.6)]" />
        {tab("studio", <>Studio</>)}
        {tab("prompts", <>Prompts</>)}
        {tab(
          "queue",
          <>
            Queue
            {running > 0 ? spinner("queue") : null}
            {running + waiting > 0 && badge("queue", running + waiting)}
          </>,
        )}
        {tab("gallery", <>Gallery{galleryCount !== null && badge("gallery", galleryCount)}</>)}
      </div>

      <span className="mx-1 hidden h-5 w-px bg-hair-strong md:block" />
      <button
        type="button"
        onClick={onVault}
        aria-label="Open backups"
        className="flex h-9 items-center gap-2 rounded-full px-3 text-[13px] text-ink-soft transition-colors duration-500 ease-fluid hover:bg-ink/[0.05] hover:text-ink"
      >
        <IconArchive /> <span className="hidden lg:inline">Backups</span>
      </button>
    </Reveal>
  );
}
