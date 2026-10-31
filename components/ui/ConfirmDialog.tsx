"use client";

import { Player } from "@remotion/player";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ConfirmGlyph, type GlyphVariant } from "@/components/remotion/compositions";
import { usePresence, SPRINGS } from "@/lib/motion";

export interface ConfirmDetail {
  label: string;
  value: string;
}

export interface ConfirmRequest {
  title: string;
  body: string;
  confirmLabel: string;
  variant: GlyphVariant;
  /** Optional picture of the thing being acted on (e.g. the image about to be deleted). */
  image?: string;
  /** Up to three facts about the thing being acted on. */
  details?: ConfirmDetail[];
  onConfirm: () => Promise<void> | void;
}

const FPS = 60;
const MARGIN = 28; // room inside the composition for the card's shadow
const CARD_W = 460;
const INNER = CARD_W - 48; // text column width
const STAGE_IMAGE = 208;
const STAGE_GLYPH = 148;
// Long enough that the scene never ends while a dialog is open; idle frames keep the stage alive.
const DURATION = FPS * 60 * 10;

const TONES: Record<GlyphVariant, { solid: string; tint: string; ring: string }> = {
  delete: { solid: "var(--danger)", tint: "rgba(214,69,58,0.08)", ring: "rgba(214,69,58,0.18)" },
  restore: { solid: "var(--teal)", tint: "rgba(47,143,139,0.09)", ring: "rgba(47,143,139,0.2)" },
  backup: { solid: "var(--ink)", tint: "rgba(14,14,13,0.04)", ring: "rgba(14,14,13,0.12)" },
};

function lines(text: string, perLine: number) {
  return Math.max(1, Math.ceil(text.length / perLine));
}

function estimateHeight(r: ConfirmRequest) {
  const stage = r.image ? STAGE_IMAGE : STAGE_GLYPH;
  const afterStage = r.image ? 40 : 22;
  const title = lines(r.title, Math.floor(INNER / 12)) * 29;
  const body = lines(r.body, Math.floor(INNER / 7.6)) * 24;
  const details = r.details?.length ? 18 + 58 : 0;
  return 8 + stage + afterStage + title + 6 + body + details + 24 + 48 + 22;
}

type SceneProps = ConfirmRequest & { busy: boolean; onCancel: () => void; onConfirmClick: () => void };

/** Rises in with a spring after `delay` frames. */
function useRise(delay: number, distance = 14) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 22, stiffness: 170 } });
  return { opacity: s, transform: `translateY(${interpolate(s, [0, 1], [distance, 0])}px)` };
}

/** Expanding rings behind the glyph, looping while the dialog is open. */
function Ripples({ ring }: { ring: string }) {
  const frame = useCurrentFrame();
  const period = 150;
  return (
    <>
      {[0, 1, 2].map((i) => {
        const t = ((frame + i * (period / 3)) % period) / period;
        const size = interpolate(t, [0, 1], [70, 230], { easing: Easing.out(Easing.cubic) });
        return (
          <span
            key={i}
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{
              width: size,
              height: size,
              transform: "translate(-50%, -50%)",
              boxShadow: `inset 0 0 0 1.5px ${ring}`,
              opacity: interpolate(t, [0, 0.15, 1], [0, 1, 0]),
            }}
          />
        );
      })}
    </>
  );
}

function Stage({ image, variant }: { image?: string; variant: GlyphVariant }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tone = TONES[variant];
  // The stage opens like a shutter: a clip wipe from the bottom while the picture settles from 1.12×.
  const open = spring({ frame: frame - 4, fps, config: { damping: 26, stiffness: 120 } });
  const settle = interpolate(frame, [4, 120], [1.12, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const height = image ? STAGE_IMAGE : STAGE_GLYPH;

  return (
    <div
      className="relative overflow-hidden rounded-[22px]"
      style={{ height, background: image ? "var(--canvas)" : tone.tint, clipPath: `inset(${(1 - open) * 100}% 0 0 0 round 22px)` }}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-full w-full object-cover" style={{ transform: `scale(${settle})` }} />
      ) : (
        <>
          <Ripples ring={tone.ring} />
          <div className="absolute left-1/2 top-1/2 h-[84px] w-[84px] -translate-x-1/2 -translate-y-1/2">
            <ConfirmGlyph variant={variant} />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The whole dialog card is a Remotion composition. Timeline (60fps):
 * card springs up (0) → stage opens like a shutter (4) → badge pops (14) →
 * title words rise one by one (16+) → body (26) → details (32+) → buttons (40).
 * Buttons are real DOM buttons inside the Player, so they stay focusable.
 */
function ConfirmScene(props: SceneProps) {
  const { title, body, confirmLabel, variant, image, details, busy, onCancel, onConfirmClick } = props;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tone = TONES[variant];

  const card = spring({ frame, fps, config: { damping: 20, mass: 0.9, stiffness: 150 } });
  const badge = spring({ frame: frame - 14, fps, config: { damping: 11, stiffness: 190 } });
  const bodyRise = useRise(26);
  const buttonsRise = useRise(40, 18);
  const words = title.split(" ");

  return (
    <AbsoluteFill style={{ padding: MARGIN }}>
      <div
        className="flex h-full flex-col rounded-[30px] bg-paper p-2 text-left"
        style={{
          opacity: Math.min(1, card * 1.6),
          transform: `translateY(${interpolate(card, [0, 1], [36, 0])}px) scale(${interpolate(card, [0, 1], [0.94, 1])})`,
          boxShadow: "0 0 0 1px rgba(14,14,13,0.06), 0 30px 70px -30px rgba(14,14,13,0.45)",
        }}
      >
        <div className="relative">
          <Stage image={image} variant={variant} />
          {image && (
            <div
              className="absolute -bottom-6 left-4 h-14 w-14 rounded-full bg-paper p-1"
              style={{ transform: `scale(${interpolate(badge, [0, 1], [0.4, 1])})`, opacity: Math.min(1, badge * 2) }}
            >
              <div className="relative h-full w-full rounded-full" style={{ background: tone.tint }}>
                <ConfirmGlyph variant={variant} />
              </div>
            </div>
          )}
        </div>

        <div className={`flex flex-1 flex-col px-4 ${image ? "pt-10" : "pt-5"}`}>
          <h2 id="confirm-title" className="text-[22px] font-semibold leading-[1.3] tracking-[-0.025em] text-ink">
            {words.map((w, i) => {
              const s = spring({ frame: frame - 16 - i * 2, fps, config: { damping: 20, stiffness: 180 } });
              return (
                <span key={i} className="inline-block" style={{ opacity: s, transform: `translateY(${interpolate(s, [0, 1], [10, 0])}px)` }}>
                  {w}
                  {i < words.length - 1 ? " " : ""}
                </span>
              );
            })}
          </h2>
          <p id="confirm-body" className="mt-1.5 text-[15px] leading-[1.6] text-ink-soft" style={bodyRise}>
            {body}
          </p>

          {details?.length ? (
            <dl className="mt-4 grid gap-3 rounded-[16px] bg-canvas px-4 py-3" style={{ gridTemplateColumns: `repeat(${details.length}, minmax(0, 1fr))` }}>
              {details.map((d, i) => {
                const s = spring({ frame: frame - 32 - i * 4, fps, config: { damping: 22, stiffness: 170 } });
                return (
                  <div key={d.label} className="min-w-0" style={{ opacity: s, transform: `translateY(${interpolate(s, [0, 1], [8, 0])}px)` }}>
                    <dt className="text-[12.5px] text-ink-faint">{d.label}</dt>
                    <dd className="truncate text-[14px] font-medium text-ink">{d.value}</dd>
                  </div>
                );
              })}
            </dl>
          ) : null}

          <div className="mt-auto grid grid-cols-2 gap-2 pb-2 pt-6" style={buttonsRise}>
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="chip flex h-12 items-center justify-center gap-2 rounded-full text-[15px] disabled:opacity-40"
            >
              Cancel
              <kbd className="rounded-[6px] bg-ink/[0.05] px-1.5 py-0.5 font-sans text-[11.5px] text-ink-faint">Esc</kbd>
            </button>
            <button
              type="button"
              data-confirm-action
              onClick={onConfirmClick}
              disabled={busy}
              className="flex h-12 items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-paper transition-[filter] duration-500 ease-fluid hover:brightness-110 disabled:cursor-wait"
              style={{ background: tone.solid }}
            >
              {busy ? (
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden style={{ transform: `rotate(${frame * 9}deg)` }}>
                  <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
                  <path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : null}
              {busy ? "Working…" : confirmLabel}
              {!busy && <kbd className="rounded-[6px] bg-paper/15 px-1.5 py-0.5 font-sans text-[11.5px] text-paper/80">↵</kbd>}
            </button>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** Confirmation dialog: the card is a Remotion composition; backdrop and exit use Remotion springs. */
export function ConfirmDialog({
  request,
  busy,
  onCancel,
  onConfirm,
}: {
  request: ConfirmRequest | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [p, rendered] = usePresence(Boolean(request), SPRINGS.snappy);
  // Keep the last request around so the dialog can animate out with its content.
  const [current, setCurrent] = useState(request);
  if (request && request !== current) setCurrent(request);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!request) return;
    // The Player mounts its content a tick later; focus the primary action once it exists.
    const t = setTimeout(() => root.current?.querySelector<HTMLButtonElement>("[data-confirm-action]")?.focus(), 80);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [request, busy, onCancel]);

  if (!rendered || !current || typeof document === "undefined") return null;
  const width = CARD_W + MARGIN * 2;
  const height = estimateHeight(current) + MARGIN * 2;
  const closing = !request;

  return createPortal(
    <div ref={root} className="fixed inset-0 z-[90] flex items-center justify-center p-2 sm:p-4" role="presentation">
      <div
        className="absolute inset-0 bg-ink/25"
        style={{ opacity: p, backdropFilter: `blur(${p * 6}px)`, WebkitBackdropFilter: `blur(${p * 6}px)` }}
        onClick={() => !busy && onCancel()}
      />
      <div
        role="alertdialog"
        data-open={request ? "true" : "false"}
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        className="relative w-full"
        style={{
          maxWidth: width,
          // Entrance is choreographed inside the composition; the exit drops the whole card away.
          opacity: closing ? p : 1,
          transform: closing ? `translateY(${(1 - p) * 28}px) scale(${0.95 + p * 0.05})` : undefined,
        }}
      >
        <Player
          key={current.title + current.body}
          component={ConfirmScene}
          inputProps={{ ...current, busy, onCancel, onConfirmClick: onConfirm }}
          durationInFrames={DURATION}
          compositionWidth={width}
          compositionHeight={height}
          fps={FPS}
          autoPlay
          controls={false}
          clickToPlay={false}
          doubleClickToFullscreen={false}
          spaceKeyToPlayOrPause={false}
          initiallyMuted
          acknowledgeRemotionLicense
          style={{ width: "100%", aspectRatio: `${width} / ${height}`, background: "transparent" }}
        />
      </div>
    </div>,
    document.body,
  );
}
