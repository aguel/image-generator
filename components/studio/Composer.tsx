"use client";

import { useEffect, useRef } from "react";
import { ASPECTS, MAX_COUNT, MIN_COUNT, type AspectId, type AspectPreset } from "@/lib/aspects";
import { STYLES, type StyleId } from "@/lib/styles";
import { spring, interpolate, FPS, SPRINGS } from "@/lib/motion";
import { Reveal } from "@/components/ui/Reveal";
import { Activity } from "@/components/ui/Activity";
import { IconSpark, StyleIcon } from "./icons";

export interface ComposerState {
  prompt: string;
  styleId: StyleId;
  aspect: AspectId;
  count: number;
}

/** Pops an element with a Remotion spring whenever `active` turns true. */
function useSpringPop<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const s = spring({ frame: ((now - start) / 1000) * FPS, fps: FPS, config: SPRINGS.bouncy });
      el.style.transform = `scale(${interpolate(s, [0, 1], [0.82, 1])})`;
      if (s < 0.999) raf = requestAnimationFrame(tick);
      else el.style.transform = "";
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return ref;
}

/** A frame preview drawn at the true aspect ratio. */
function FrameOption({ aspect, active, onSelect }: { aspect: AspectPreset; active: boolean; onSelect: () => void }) {
  const glyph = useSpringPop<HTMLSpanElement>(active);
  const longest = 30;
  const w = aspect.width >= aspect.height ? longest : Math.round((longest * aspect.width) / aspect.height);
  const h = aspect.height >= aspect.width ? longest : Math.round((longest * aspect.height) / aspect.width);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={`flex flex-col items-center justify-center gap-2 rounded-[16px] py-3 short:flex-row short:gap-2.5 short:py-2 transition-[background-color,box-shadow] duration-500 ease-fluid ${
        active
          ? "bg-paper shadow-[0_0_0_1.5px_var(--ink),0_10px_24px_-14px_rgba(14,14,13,0.45)]"
          : "tile"
      }`}
    >
      <span className="grid h-8 place-items-center short:h-6 short:scale-[0.8]">
        <span
          ref={glyph}
          className={`block rounded-[5px] border-[1.5px] transition-colors duration-500 ease-fluid ${
            active ? "border-ink bg-amber-soft" : "border-ink-faint/70 bg-paper"
          }`}
          style={{ width: w, height: h }}
        />
      </span>
      <span className="flex flex-col items-center leading-tight short:items-start">
        <span className={`text-[13px] font-medium ${active ? "text-ink" : "text-ink-soft"}`}>{aspect.label}</span>
        <span className="text-[12px] text-ink-faint tabular-nums">{aspect.ratio}</span>
      </span>
    </button>
  );
}

export function Composer({
  state,
  onChange,
  onGenerate,
  running,
  progress,
  queue,
  keyConfigured,
}: {
  state: ComposerState;
  onChange: (next: Partial<ComposerState>) => void;
  onGenerate: () => void;
  running: number;
  /** Progress of the latest batch, for the Generate button's status line. */
  progress: { done: number; total: number } | null;
  /** Live queue numbers; Generate always goes through the server queue. */
  queue: { running: number; waiting: number; concurrency: number; queueSize: number } | null;
  keyConfigured: boolean | null;
}) {
  const canGenerate = state.prompt.trim().length > 0 && keyConfigured !== false;
  const selectedAspect = ASPECTS.find((a) => a.id === state.aspect) ?? ASPECTS[0];
  const progressBar = useRef<HTMLSpanElement>(null);

  // Progress bar glides to its new value with a Remotion spring (transform only).
  const ratio = progress && progress.total ? progress.done / progress.total : 0;
  useEffect(() => {
    const el = progressBar.current;
    if (!el) return;
    const from = Number(el.dataset.v ?? 0);
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const s = spring({ frame: ((now - start) / 1000) * FPS, fps: FPS, config: SPRINGS.soft });
      const v = from + (ratio - from) * s;
      el.dataset.v = String(v);
      el.style.transform = `scaleX(${v})`;
      if (s < 0.999) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ratio]);

  return (
    <form
      className="flex h-full min-h-0 flex-col gap-3 short:gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (canGenerate) onGenerate();
      }}
    >
      {/* Prompt */}
      <Reveal delay={4} className="bezel flex min-h-[160px] flex-1 flex-col transition-shadow duration-500 ease-fluid focus-within:shadow-[inset_0_0_0_1.5px_rgba(14,14,13,0.25)] lg:max-h-[200px] lg:min-h-[112px] short:min-h-[100px]">
        <div className="bezel-core flex min-h-0 flex-1 flex-col px-4 pb-3 pt-3.5 short:pt-3">
          <div className="flex items-baseline justify-between">
            <label htmlFor="prompt" className="eyebrow">
              Prompt
            </label>
            <span className="label">{state.prompt.length} / 4000</span>
          </div>
          <textarea
            id="prompt"
            value={state.prompt}
            maxLength={4000}
            onChange={(e) => onChange({ prompt: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (canGenerate) onGenerate();
              }
            }}
            placeholder="Describe the scene: who is in it, what they are doing, and where."
            className="mt-1.5 min-h-[56px] short:min-h-[48px] w-full flex-1 resize-none bg-transparent text-[16px] leading-[1.6] text-ink placeholder:text-ink-faint focus:outline-none"
          />
        </div>
      </Reveal>

      {/* Style */}
      <Reveal delay={9} className="bezel shrink-0">
        <div className="bezel-core p-3.5 short:p-3">
          <span className="eyebrow">Style</span>
          <div className="mt-2.5 grid grid-cols-2 gap-2 short:mt-2 short:gap-1.5" role="radiogroup" aria-label="Style">
            {STYLES.map((style, i) => {
              const active = style.id === state.styleId;
              // An odd last card spans the row so the grid stays even.
              const span = STYLES.length % 2 === 1 && i === STYLES.length - 1;
              return (
                <button
                  key={style.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  title={style.tagline}
                  onClick={() => onChange({ styleId: style.id })}
                  className={`flex min-w-0 items-center gap-2.5 rounded-[14px] p-2 text-left short:gap-2 short:px-1.5 short:py-1 transition-[background-color,box-shadow] duration-500 ease-fluid ${
                    span ? "col-span-2" : ""
                  } ${active ? "bg-paper shadow-[0_0_0_1.5px_var(--ink),0_10px_24px_-14px_rgba(14,14,13,0.45)]" : "tile"}`}
                >
                  <StyleIcon style={style} className="h-10 w-10 rounded-[10px] short:h-8 short:w-8 short:rounded-[8px]" />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium leading-tight text-ink short:text-[13px]">{style.name}</span>
                    <span className="mt-0.5 block truncate text-[12px] leading-tight text-ink-soft">{style.tagline}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* Aspect ratio + number of images */}
      <Reveal delay={14} className="bezel shrink-0">
        <div className="bezel-core flex flex-col gap-4 p-3.5 short:gap-3 short:p-3">
          <div>
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">Aspect ratio</span>
              <span className="label">
                {selectedAspect.width} × {selectedAspect.height}
              </span>
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-2 short:mt-2" role="radiogroup" aria-label="Aspect ratio">
              {ASPECTS.map((a) => (
                <FrameOption key={a.id} aspect={a} active={a.id === state.aspect} onSelect={() => onChange({ aspect: a.id })} />
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">Number of images</span>
              <span className="label">{state.count === 1 ? "1 image" : `${state.count} images`}</span>
            </div>
            <div className="mt-2.5 grid grid-cols-8 gap-1.5" role="radiogroup" aria-label="Number of images">
              {Array.from({ length: MAX_COUNT - MIN_COUNT + 1 }, (_, i) => i + MIN_COUNT).map((n) => {
                const current = n === state.count;
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={current}
                    aria-label={`${n} image${n > 1 ? "s" : ""}`}
                    onClick={() => onChange({ count: n })}
                    className={`h-10 rounded-[12px] text-[14px] short:h-9 font-medium tabular-nums transition-[background-color,color,box-shadow] duration-500 ease-fluid ${
                      current
                        ? "bg-ink text-paper shadow-[0_8px_18px_-10px_rgba(14,14,13,0.7)]"
                        : "tile text-ink-soft hover:text-ink"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Reveal>

      {/* Generate */}
      <Reveal delay={19} from="scale" className="shrink-0">
        <button
          type="submit"
          disabled={!canGenerate}
          className="group relative flex h-[60px] short:h-[54px] w-full items-center gap-3 overflow-hidden rounded-[20px] bg-ink pl-2.5 pr-4 text-left text-paper shadow-[0_18px_40px_-20px_rgba(14,14,13,0.75)] transition-[transform,opacity] duration-500 ease-fluid active:scale-[0.985] disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink-faint disabled:shadow-[0_0_0_1px_rgba(14,14,13,0.09)]"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-paper/10 group-disabled:bg-amber-soft group-disabled:text-amber transition-transform duration-500 ease-fluid group-hover:scale-105 group-hover:rotate-12 group-disabled:transform-none">
            {running > 0 ? <Activity size={20} tone="#ffffff" blade="#0e0e0d" label="Generating" /> : <IconSpark size={18} />}
          </span>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="text-[15.5px] font-semibold tracking-[-0.01em] group-disabled:text-ink-soft">
              {!state.prompt.trim()
                ? "Write a prompt to generate"
                : running > 0
                ? `Add ${state.count} more to queue`
                : state.count === 1
                  ? "Generate image"
                  : `Generate ${state.count} images`}
            </span>
            <span className="mt-0.5 truncate text-[12.5px] text-paper/60 group-disabled:text-ink-faint">
              {running > 0 && queue
                ? `${progress ? `${progress.done} of ${progress.total} ready · ` : ""}${queue.running} generating, ${queue.waiting} waiting`
                : `${selectedAspect.label} ${selectedAspect.ratio} · ${STYLES.find((s) => s.id === state.styleId)?.name}${queue ? ` · ${queue.concurrency} at a time` : ""}`}
            </span>
          </span>
          <kbd className="hidden shrink-0 rounded-[8px] bg-paper/10 px-2 py-1 font-sans text-[12px] text-paper/70 group-disabled:hidden sm:block">⌘ ↵</kbd>
          <span
            ref={progressBar}
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-[3px] origin-left bg-amber"
            style={{ transform: "scaleX(0)", opacity: running > 0 ? 1 : 0 }}
          />
        </button>
        {keyConfigured === false && (
          <p className="mt-2 text-center text-[13px] text-danger">OPENAI_API_KEY is missing from .env, so generation is disabled.</p>
        )}
      </Reveal>
    </form>
  );
}
