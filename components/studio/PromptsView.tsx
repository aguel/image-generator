"use client";

import { useEffect, useRef } from "react";
import { Stage } from "@/components/remotion/Stage";
import { Scribble } from "@/components/remotion/compositions";
import { ASPECTS, type AspectId } from "@/lib/aspects";
import { STYLES, type StyleId } from "@/lib/styles";
import { FPS, interpolate, spring, SPRINGS } from "@/lib/motion";
import type { EnhancedPrompt } from "@/lib/types";
import { Reveal } from "@/components/ui/Reveal";
import { Activity } from "@/components/ui/Activity";
import { IconArrow, IconSpark } from "./icons";

export interface PromptLab {
  idea: string;
  variations: number;
  results: EnhancedPrompt[] | null;
  selected: boolean[];
  loading: boolean;
  error: string | null;
  sourceIdea: string;
  model: string | null;
  styleId: StyleId;
  aspect: AspectId;
  perPrompt: number;
}

export const INITIAL_LAB: PromptLab = {
  idea: "",
  variations: 6,
  results: null,
  selected: [],
  loading: false,
  error: null,
  sourceIdea: "",
  model: null,
  styleId: "cinematic",
  aspect: "landscape",
  perPrompt: 1,
};

const VARIATIONS = [4, 6, 8, 12];
const PER_PROMPT = [1, 2, 3, 4];

/** Checkbox whose tick draws in with a Remotion spring. */
function Check({ on }: { on: boolean }) {
  const path = useRef<SVGPathElement>(null);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const p = path.current;
    const b = box.current;
    if (!p || !b) return;
    const from = Number(b.dataset.v ?? (on ? 0 : 1));
    const to = on ? 1 : 0;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const s = spring({ frame: ((now - start) / 1000) * FPS, fps: FPS, config: SPRINGS.bouncy });
      const v = from + (to - from) * s;
      b.dataset.v = String(v);
      p.style.strokeDashoffset = String(1 - Math.max(0, Math.min(1, v)));
      b.style.scale = String(interpolate(v, [0, 0.5, 1], [1, 0.88, 1]));
      if (s < 0.999) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  return (
    <span
      ref={box}
      aria-hidden
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-[8px] transition-colors duration-500 ease-fluid ${
        on ? "bg-amber text-paper" : "bg-paper text-transparent shadow-[inset_0_0_0_1.5px_rgba(14,14,13,0.2)]"
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 14 14">
        <path ref={path} d="M3 7.5l2.6 2.6L11 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} style={{ strokeDashoffset: on ? 0 : 1 }} />
      </svg>
    </span>
  );
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  render = (v) => String(v),
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  label: string;
  render?: (v: T) => string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="seg grid gap-1 rounded-[14px] p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={`h-9 rounded-[10px] text-[13.5px] font-medium transition-[background-color,color,box-shadow] duration-500 ease-fluid ${
            value === o ? "bg-ink text-paper shadow-[0_6px_16px_-8px_rgba(14,14,13,0.6)]" : "text-ink-soft hover:text-ink"
          }`}
        >
          {render(o)}
        </button>
      ))}
    </div>
  );
}

export function PromptsView({
  lab,
  onChange,
  onEnhance,
  onAddToQueue,
  onUseInStudio,
  room,
}: {
  lab: PromptLab;
  onChange: (next: Partial<PromptLab>) => void;
  onEnhance: () => void;
  onAddToQueue: () => void;
  onUseInStudio: (prompt: string) => void;
  /** How many more images the queue can accept right now (null while unknown). */
  room: number | null;
}) {
  const selectedCount = lab.selected.filter(Boolean).length;
  const total = selectedCount * lab.perPrompt;
  const overCapacity = room !== null && total > room;
  const canEnhance = lab.idea.trim().length > 0 && !lab.loading;
  const results = lab.results ?? [];
  const allOn = results.length > 0 && selectedCount === results.length;

  const setAll = (on: boolean) => onChange({ selected: results.map(() => on) });
  const toggle = (i: number) => onChange({ selected: lab.selected.map((v, j) => (j === i ? !v : v)) });

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 short:gap-2 lg:grid-cols-[minmax(340px,392px)_minmax(0,1fr)]">
      {/* Left: idea + queue settings */}
      <div className="flex min-h-0 flex-col gap-3 short:gap-2">
        <Reveal delay={4} className="bezel flex min-h-[220px] flex-1 flex-col transition-shadow duration-500 ease-fluid focus-within:shadow-[inset_0_0_0_1.5px_rgba(14,14,13,0.25)] lg:min-h-[170px]">
          <form
            className="bezel-core flex min-h-0 flex-1 flex-col px-4 pb-4 pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (canEnhance) onEnhance();
            }}
          >
            <div className="flex items-baseline justify-between">
              <label htmlFor="idea" className="eyebrow">
                Your idea
              </label>
            </div>
            <textarea
              id="idea"
              value={lab.idea}
              maxLength={2000}
              onChange={(e) => onChange({ idea: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (canEnhance) onEnhance();
                }
              }}
              placeholder="A short idea, e.g. “night market cooks” or “a fisherman at dawn”."
              className="mt-2 min-h-[64px] w-full flex-1 resize-none bg-transparent text-[16px] leading-[1.6] text-ink placeholder:text-ink-faint focus:outline-none"
            />
            <div className="mt-3">
              <span className="eyebrow">Number of prompts</span>
              <div className="mt-2">
                <Segmented label="Number of prompts" value={lab.variations} options={VARIATIONS} onChange={(v) => onChange({ variations: v })} />
              </div>
            </div>
            <button
              type="submit"
              disabled={!canEnhance}
              className="group mt-3 flex h-12 items-center justify-center gap-2.5 rounded-[16px] bg-ink text-[15px] font-semibold text-paper shadow-[0_14px_32px_-18px_rgba(14,14,13,0.75)] transition-opacity duration-500 ease-fluid disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink-faint disabled:shadow-[0_0_0_1px_rgba(14,14,13,0.09)]"
            >
              {lab.loading ? <Activity size={18} tone="#ffffff" blade="#0e0e0d" label="Writing prompts" /> : <IconSpark />}
              {lab.loading ? "Writing prompts…" : "Enhance into prompts"}
            </button>
          </form>
        </Reveal>

        <Reveal delay={10} className="bezel shrink-0">
          <div className="bezel-core flex flex-col gap-3 p-3.5 short:gap-2.5 short:p-3">
            <div>
              <span className="eyebrow">Style</span>
              <div className="mt-2">
                <Segmented
                  label="Style"
                  value={lab.styleId}
                  options={STYLES.map((s) => s.id)}
                  render={(id) => STYLES.find((s) => s.id === id)?.name ?? id}
                  onChange={(v) => onChange({ styleId: v })}
                />
              </div>
            </div>
            <div>
              <span className="eyebrow">Aspect ratio</span>
              <div className="mt-2">
                <Segmented
                  label="Aspect ratio"
                  value={lab.aspect}
                  options={ASPECTS.map((a) => a.id)}
                  render={(id) => {
                    const a = ASPECTS.find((x) => x.id === id)!;
                    return `${a.label} ${a.ratio}`;
                  }}
                  onChange={(v) => onChange({ aspect: v })}
                />
              </div>
            </div>
            <div>
              <span className="eyebrow">Images per prompt</span>
              <div className="mt-2">
                <Segmented label="Images per prompt" value={lab.perPrompt} options={PER_PROMPT} onChange={(v) => onChange({ perPrompt: v })} />
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={16} from="scale" className="shrink-0">
          <button
            type="button"
            onClick={onAddToQueue}
            disabled={selectedCount === 0 || overCapacity}
            className="group flex h-[60px] w-full items-center gap-3 rounded-[20px] bg-ink pl-2.5 pr-3 text-left text-paper shadow-[0_18px_40px_-20px_rgba(14,14,13,0.75)] transition-opacity duration-500 ease-fluid disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink-faint disabled:shadow-[0_0_0_1px_rgba(14,14,13,0.09)] short:h-[54px]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-paper/10 group-disabled:bg-amber-soft group-disabled:text-amber text-[15px] font-semibold tabular-nums">{total}</span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-[15.5px] font-semibold tracking-[-0.01em] group-disabled:text-ink-soft">
                {selectedCount === 0 ? "Select prompts to queue" : `Add ${total} image${total === 1 ? "" : "s"} to queue`}
              </span>
              <span className={`mt-0.5 truncate text-[12.5px] ${overCapacity ? "text-[#ffb4a8] group-disabled:text-danger" : "text-paper/60 group-disabled:text-ink-faint"}`}>
                {overCapacity
                  ? `Queue has room for ${room} right now`
                  : `${selectedCount} prompt${selectedCount === 1 ? "" : "s"} × ${lab.perPrompt} · ${STYLES.find((s) => s.id === lab.styleId)?.name}`}
              </span>
            </span>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-paper/10 group-disabled:bg-amber-soft group-disabled:text-amber">
              <IconArrow />
            </span>
          </button>
        </Reveal>
      </div>

      {/* Right: generated prompts */}
      <Reveal from="blur" delay={6} className="bezel flex min-h-[60vh] lg:min-h-0 [--r:30px]">
        <div className="bezel-core flex min-h-0 flex-1 flex-col p-4 md:p-5">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <span className="label">{lab.sourceIdea ? `From “${lab.sourceIdea}”` : "Prompt enhancement"}</span>
              <h1 className="mt-1 text-[20px] font-semibold leading-snug tracking-[-0.02em] text-ink md:text-[22px]">
                {results.length ? `${results.length} prompts` : lab.loading ? "Writing prompts…" : "Generated prompts appear here"}
              </h1>
            </div>
            {results.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="label !text-[13px]">
                  {selectedCount} of {results.length} selected
                </span>
                <div className="seg flex rounded-full p-1">
                  <button
                    type="button"
                    onClick={() => setAll(true)}
                    disabled={allOn}
                    className="h-8 rounded-full px-3.5 text-[13px] font-medium text-ink transition-colors duration-500 ease-fluid hover:bg-ink/[0.05] disabled:text-ink-faint disabled:hover:bg-transparent"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setAll(false)}
                    disabled={selectedCount === 0}
                    className="h-8 rounded-full px-3.5 text-[13px] font-medium text-ink transition-colors duration-500 ease-fluid hover:bg-ink/[0.05] disabled:text-ink-faint disabled:hover:bg-transparent"
                  >
                    Deselect all
                  </button>
                </div>
              </div>
            )}
          </header>

          {lab.error && (
            <p role="alert" className="mt-3 rounded-[14px] bg-danger/10 px-4 py-3 text-[14px] text-danger">
              {lab.error}
            </p>
          )}

          <div className="-mx-1 mt-3 min-h-0 flex-1 overflow-y-auto px-1 py-1">
            {lab.loading ? (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {Array.from({ length: lab.variations }, (_, i) => (
                  <Reveal key={i} delay={i * 3} from="scale" className="rounded-[18px] bg-canvas p-4">
                    <Stage component={Scribble} inputProps={{ seed: i }} width={480} height={150} duration={110} className="w-full" />
                  </Reveal>
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
                <p className="text-[24px] font-semibold tracking-[-0.025em] text-ink">Start with a short idea</p>
                <p className="max-w-[420px] text-[15px] leading-relaxed text-ink-soft">
                  The writer turns it into several detailed prompts. Pick the ones you like, choose a style, and add them to the queue.
                </p>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {results.map((r, i) => {
                  const on = lab.selected[i];
                  return (
                    <Reveal
                      as="li"
                      key={`${lab.sourceIdea}-${i}`}
                      delay={i * 3}
                      from="up"
                      className={`group flex cursor-pointer gap-3 rounded-[18px] p-4 transition-[background-color,box-shadow] duration-500 ease-fluid ${
                        on ? "bg-amber-soft/70 shadow-[inset_0_0_0_1.5px_rgba(217,130,43,0.55)]" : "bg-canvas hover:bg-ink/[0.05]"
                      }`}
                      role="checkbox"
                      aria-checked={on}
                      tabIndex={0}
                      onClick={() => toggle(i)}
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          toggle(i);
                        }
                      }}
                    >
                      <Check on={on} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-ink">{r.title}</p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUseInStudio(r.prompt);
                            }}
                            className="shrink-0 rounded-full px-2.5 py-1 text-[12.5px] font-medium text-ink-soft opacity-0 transition-[opacity,background-color] duration-500 ease-fluid hover:bg-ink/[0.06] hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                          >
                            Use in Studio
                          </button>
                        </div>
                        <p className="mt-1 text-[14px] leading-[1.6] text-ink-soft">{r.prompt}</p>
                      </div>
                    </Reveal>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </Reveal>
    </div>
  );
}
