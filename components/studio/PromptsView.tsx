"use client";

import { useEffect, useRef } from "react";
import { Stage } from "@/components/remotion/Stage";
import { Scribble } from "@/components/remotion/compositions";
import { ASPECTS, type AspectId } from "@/lib/aspects";
import { STYLES, getStyle, type StyleId } from "@/lib/styles";
import { FPS, interpolate, spring, SPRINGS } from "@/lib/motion";
import type { EnhancedPrompt } from "@/lib/types";
import { Reveal } from "@/components/ui/Reveal";
import { Activity } from "@/components/ui/Activity";
import { IconArrow, IconSpark } from "./icons";
import { StylePicker } from "./StylePicker";

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
const IDEAS = ["Night market cooks", "Fishermen at dawn", "Jeepney drivers at rush hour", "Rice farmers after rain"];

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
      b.style.scale = String(interpolate(v, [0, 0.5, 1], [1, 0.86, 1]));
      if (s < 0.999) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  return (
    <span
      ref={box}
      aria-hidden
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full transition-colors duration-500 ease-fluid ${
        on ? "bg-ink text-paper" : "bg-paper text-paper shadow-[inset_0_0_0_1.5px_rgba(14,14,13,0.2)]"
      }`}
    >
      <svg width="13" height="13" viewBox="0 0 14 14">
        <path ref={path} d="M3 7.5l2.6 2.6L11 4.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} style={{ strokeDashoffset: on ? 0 : 1 }} />
      </svg>
    </span>
  );
}

/** Compact labelled segmented control used in the command bars. */
function Seg<T extends string | number>({
  label,
  value,
  options,
  onChange,
  render = (v) => String(v),
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  render?: (v: T) => string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[12px] font-medium text-ink-soft">{label}</span>
      <div role="radiogroup" aria-label={label} className="seg flex rounded-full p-1">
        {options.map((o) => (
          <button
            key={String(o)}
            type="button"
            role="radio"
            aria-checked={value === o}
            onClick={() => onChange(o)}
            className={`h-8 whitespace-nowrap rounded-full px-3 text-[13px] font-medium transition-[background-color,color] duration-500 ease-fluid ${
              value === o ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
            }`}
          >
            {render(o)}
          </button>
        ))}
      </div>
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
  const results = lab.results ?? [];
  const selectedCount = lab.selected.filter(Boolean).length;
  const total = selectedCount * lab.perPrompt;
  const overCapacity = room !== null && total > room;
  const canEnhance = lab.idea.trim().length > 0 && !lab.loading;
  const allOn = results.length > 0 && selectedCount === results.length;

  const setAll = (on: boolean) => onChange({ selected: results.map(() => on) });
  const toggle = (i: number) => onChange({ selected: lab.selected.map((v, j) => (j === i ? !v : v)) });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* ── Idea bar ─────────────────────────────────────────── */}
      <Reveal delay={2} className="bezel shrink-0 [--r:30px]">
        <form
          className="bezel-core flex flex-col gap-3 p-3 md:flex-row md:items-stretch"
          onSubmit={(e) => {
            e.preventDefault();
            if (canEnhance) onEnhance();
          }}
        >
          <div className="flex min-w-0 flex-1 items-start gap-3 rounded-[20px] bg-canvas px-4 py-3 transition-shadow duration-500 ease-fluid focus-within:shadow-[inset_0_0_0_1.5px_rgba(14,14,13,0.22)]">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-amber-soft text-amber">
              <IconSpark />
            </span>
            <div className="min-w-0 flex-1">
              <label htmlFor="idea" className="text-[12px] font-medium text-ink-soft">
                Describe an idea and get detailed prompts back
              </label>
              <textarea
                id="idea"
                rows={1}
                value={lab.idea}
                maxLength={2000}
                onChange={(e) => onChange({ idea: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (canEnhance) onEnhance();
                  }
                }}
                placeholder="e.g. Filipinos doing day-to-day work"
                className="block max-h-[72px] min-h-[30px] w-full resize-none bg-transparent text-[18px] font-medium leading-[1.5] tracking-[-0.01em] text-ink placeholder:font-normal placeholder:text-ink-faint focus:outline-none"
              />
              {!lab.idea && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {IDEAS.map((idea) => (
                    <button key={idea} type="button" onClick={() => onChange({ idea })} className="chip rounded-full px-2.5 py-0.5 text-[12px]">
                      {idea}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-end gap-3">
            <Seg label="How many prompts" value={lab.variations} options={VARIATIONS} onChange={(v) => onChange({ variations: v })} />
            <button
              type="submit"
              disabled={!canEnhance}
              className="group flex h-[52px] shrink-0 items-center gap-2.5 rounded-full bg-ink py-1.5 pl-5 pr-1.5 text-[14.5px] font-semibold text-paper shadow-[0_14px_32px_-18px_rgba(14,14,13,0.75)] disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink-faint disabled:shadow-[0_0_0_1px_rgba(14,14,13,0.09)]"
            >
              {lab.loading ? "Writing…" : "Enhance"}
              <span className="grid h-10 w-10 place-items-center rounded-full bg-paper/10 group-disabled:bg-amber-soft group-disabled:text-amber">
                {lab.loading ? <Activity size={18} tone="#d9822b" blade="#ffffff" label="Writing prompts" /> : <IconArrow />}
              </span>
            </button>
          </div>
        </form>
      </Reveal>

      {/* ── Results ──────────────────────────────────────────── */}
      <Reveal delay={6} from="blur" className="bezel flex min-h-[60vh] flex-1 lg:min-h-0 [--r:30px]">
        <div className="bezel-core relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="flex flex-wrap items-end justify-between gap-3 px-5 pb-1 pt-4">
            <div className="min-w-0">
              <span className="label">{lab.sourceIdea ? `From “${lab.sourceIdea}”` : "Prompt enhancement"}</span>
              <h1 className="mt-0.5 text-[20px] font-semibold tracking-[-0.02em] text-ink md:text-[22px]">
                {results.length ? `${results.length} prompts ready` : lab.loading ? "Writing prompts…" : "Your prompts will appear here"}
              </h1>
            </div>
            {lab.error && (
              <p role="alert" className="rounded-full bg-danger/10 px-4 py-1.5 text-[13.5px] text-danger">
                {lab.error}
              </p>
            )}
          </header>

          <div className={`min-h-0 flex-1 overflow-y-auto px-4 pt-2 ${results.length ? "pb-32" : "pb-4"}`}>
            {lab.loading ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {Array.from({ length: lab.variations }, (_, i) => (
                  <Reveal key={i} delay={i * 3} from="scale" className="rounded-[20px] bg-canvas p-5">
                    <Stage component={Scribble} inputProps={{ seed: i }} width={480} height={170} duration={110} className="w-full" />
                  </Reveal>
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="grid h-full place-items-center">
                <div className="flex max-w-[460px] flex-col items-center text-center">
                  <div className="w-[280px] rounded-[20px] bg-canvas p-5">
                    <Stage component={Scribble} inputProps={{ seed: 2 }} width={480} height={170} duration={110} className="w-full" />
                  </div>
                  <p className="mt-5 text-[22px] font-semibold tracking-[-0.025em] text-ink">Start with a short idea</p>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">
                    Each prompt explores a different take on it. Select the ones you like, pick a style, and send them to the queue.
                  </p>
                </div>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {results.map((r, i) => {
                  const on = lab.selected[i];
                  return (
                    <Reveal
                      as="li"
                      key={`${lab.sourceIdea}-${i}`}
                      delay={i * 3}
                      from="up"
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
                      className={`group relative flex cursor-pointer flex-col rounded-[20px] p-5 transition-[background-color,box-shadow] duration-500 ease-fluid ${
                        on
                          ? "bg-paper shadow-[inset_0_0_0_1.5px_var(--ink),0_16px_36px_-24px_rgba(14,14,13,0.5)]"
                          : "bg-canvas hover:bg-paper hover:shadow-[inset_0_0_0_1px_rgba(14,14,13,0.12)]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <p className="min-w-0 flex-1 truncate text-[15.5px] font-semibold tracking-[-0.01em] text-ink">{r.title}</p>
                        <Check on={on} />
                      </div>
                      <p className="mt-2.5 flex-1 text-[14px] leading-[1.65] text-ink-soft">{r.prompt}</p>
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUseInStudio(r.prompt);
                          }}
                          className="chip rounded-full px-3 py-1 text-[12.5px] font-medium opacity-0 transition-opacity duration-500 ease-fluid focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          Open in Studio
                        </button>
                      </div>
                    </Reveal>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ── Floating action bar ───────────────────────────── */}
          {results.length > 0 && (
            <Reveal
              from="up"
              spring="snappy"
              className="absolute inset-x-3 bottom-3 flex flex-wrap items-end gap-x-4 gap-y-3 rounded-[24px] bg-paper/90 p-3 pl-4 shadow-[0_0_0_1px_rgba(14,14,13,0.08),0_24px_60px_-24px_rgba(14,14,13,0.45)] backdrop-blur-xl"
            >
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-ink-soft">
                  {selectedCount} of {results.length} selected
                </span>
                <div className="seg flex rounded-full p-1">
                  <button
                    type="button"
                    onClick={() => setAll(true)}
                    disabled={allOn}
                    className="h-8 rounded-full px-3 text-[13px] font-medium text-ink transition-colors duration-500 ease-fluid hover:bg-ink/[0.05] disabled:text-ink-faint disabled:hover:bg-transparent"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setAll(false)}
                    disabled={selectedCount === 0}
                    className="h-8 rounded-full px-3 text-[13px] font-medium text-ink transition-colors duration-500 ease-fluid hover:bg-ink/[0.05] disabled:text-ink-faint disabled:hover:bg-transparent"
                  >
                    Deselect all
                  </button>
                </div>
              </div>
              <div className="flex min-w-[200px] flex-col gap-1.5">
                <span className="text-[12px] font-medium text-ink-soft">Style</span>
                <StylePicker value={lab.styleId} onChange={(v) => { const { aspect } = getStyle(v); onChange({ styleId: v, ...(aspect && { aspect }) }); }} placement="up" compact />
              </div>
              <Seg
                label="Aspect ratio"
                value={lab.aspect}
                options={ASPECTS.map((a) => a.id)}
                render={(id) => ASPECTS.find((a) => a.id === id)?.ratio ?? id}
                onChange={(v) => onChange({ aspect: v })}
              />
              <Seg label="Images each" value={lab.perPrompt} options={PER_PROMPT} onChange={(v) => onChange({ perPrompt: v })} />
              <button
                type="button"
                onClick={onAddToQueue}
                disabled={selectedCount === 0 || overCapacity}
                className="group ml-auto flex h-[52px] items-center gap-3 rounded-full bg-ink py-1.5 pl-5 pr-1.5 text-left text-paper shadow-[0_14px_32px_-18px_rgba(14,14,13,0.75)] disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink-faint disabled:shadow-[0_0_0_1px_rgba(14,14,13,0.09)]"
              >
                <span className="flex flex-col leading-tight">
                  <span className="text-[14.5px] font-semibold">
                    {selectedCount === 0 ? "Select prompts" : `Queue ${total} image${total === 1 ? "" : "s"}`}
                  </span>
                  <span className={`text-[12px] ${overCapacity ? "text-[#ffb4a8] group-disabled:text-danger" : "text-paper/60 group-disabled:text-ink-faint"}`}>
                    {overCapacity ? `Room for ${room} right now` : `${selectedCount} × ${lab.perPrompt} · ${STYLES.find((s) => s.id === lab.styleId)?.name}`}
                  </span>
                </span>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-paper/10 group-disabled:bg-amber-soft group-disabled:text-amber">
                  <IconArrow />
                </span>
              </button>
            </Reveal>
          )}
        </div>
      </Reveal>
    </div>
  );
}
