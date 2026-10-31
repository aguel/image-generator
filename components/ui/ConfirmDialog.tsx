"use client";

import { Player } from "@remotion/player";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ConfirmGlyph, type GlyphVariant } from "@/components/remotion/compositions";
import { usePresence, SPRINGS } from "@/lib/motion";

export interface ConfirmRequest {
  title: string;
  body: string;
  confirmLabel: string;
  variant: GlyphVariant;
  onConfirm: () => Promise<void> | void;
}

const FPS = 60;
const MARGIN = 24; // room inside the composition for the card's soft shadow
const CARD_W = 440;
// Long enough that the scene never ends while a dialog is open; idle frames keep the glyph and spinner alive.
const DURATION = FPS * 60 * 10;

const TONES: Record<GlyphVariant, { solid: string; text: string }> = {
  delete: { solid: "var(--danger)", text: "#ffffff" },
  restore: { solid: "var(--teal)", text: "#ffffff" },
  backup: { solid: "var(--ink)", text: "#ffffff" },
};

function estimateHeight(title: string, body: string) {
  const titleLines = Math.max(1, Math.ceil(title.length / 34));
  const bodyLines = Math.max(1, Math.ceil(body.length / 50));
  return 28 + 52 + 20 + titleLines * 28 + 8 + bodyLines * 24 + 28 + 44 + 24;
}

type SceneProps = {
  title: string;
  body: string;
  confirmLabel: string;
  variant: GlyphVariant;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * The whole dialog card is a Remotion composition: card, glyph, title, body
 * and buttons are choreographed from `useCurrentFrame()`. Buttons are real DOM
 * buttons inside the Player, so they stay focusable and clickable.
 */
function ConfirmScene({ title, body, confirmLabel, variant, busy, onCancel, onConfirm }: SceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tone = TONES[variant];

  const card = spring({ frame, fps, config: { damping: 18, mass: 0.8, stiffness: 160 } });
  const rise = (delay: number) => {
    const s = spring({ frame: frame - delay, fps, config: { damping: 22, stiffness: 170 } });
    return { opacity: s, transform: `translateY(${interpolate(s, [0, 1], [14, 0])}px)` };
  };
  const pop = (delay: number) => {
    const s = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 180 } });
    return { opacity: s, transform: `scale(${interpolate(s, [0, 1], [0.86, 1])})` };
  };
  // One light sweep across the primary action once the card has settled.
  const sweep = interpolate(frame, [48, 96], [-60, 160], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ padding: MARGIN }}>
      <div
        className="flex h-full flex-col rounded-[28px] bg-paper px-7 pb-6 pt-7 text-left"
        style={{
          opacity: Math.min(1, card * 1.5),
          transform: `translateY(${interpolate(card, [0, 1], [26, 0])}px) scale(${interpolate(card, [0, 1], [0.93, 1])})`,
          boxShadow: "0 0 0 1px rgba(14,14,13,0.06), 0 24px 60px -24px rgba(14,14,13,0.35)",
        }}
      >
        <div className="relative h-[52px] w-[52px]" style={pop(2)}>
          <ConfirmGlyph variant={variant} />
        </div>
        <h2 id="confirm-title" className="mt-5 text-[21px] font-semibold leading-[1.3] tracking-[-0.02em] text-ink" style={rise(8)}>
          {title}
        </h2>
        <p id="confirm-body" className="mt-2 text-[15px] leading-[1.6] text-ink-soft" style={rise(13)}>
          {body}
        </p>
        <div className="mt-auto flex justify-end gap-2.5 pt-7">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="chip h-11 rounded-full px-5 text-[15px] font-medium !text-ink disabled:opacity-40"
            style={pop(17)}
          >
            Cancel
          </button>
          <button
            type="button"
            data-confirm-action
            onClick={onConfirm}
            disabled={busy}
            className="relative flex h-11 items-center gap-2 overflow-hidden rounded-full px-5 text-[15px] font-medium transition-[filter,transform] duration-500 ease-fluid hover:brightness-110 active:scale-[0.97] disabled:cursor-wait"
            style={{ ...pop(20), background: tone.solid, color: tone.text }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-10 -skew-x-12 bg-white/25 blur-[2px]"
              style={{ left: `${sweep}%` }}
            />
            {busy && (
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden style={{ transform: `rotate(${frame * 9}deg)` }}>
                <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
                <path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
            <span className="relative">{busy ? "Working…" : confirmLabel}</span>
          </button>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** Confirmation dialog: the card is a Remotion composition, the backdrop and exit use Remotion springs. */
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
  const height = estimateHeight(current.title, current.body) + MARGIN * 2;
  const closing = !request;

  return createPortal(
    <div ref={root} className="fixed inset-0 z-[90] flex items-center justify-center p-2 sm:p-4" role="presentation">
      <div
        className="absolute inset-0 bg-paper/55"
        style={{ opacity: p, backdropFilter: `blur(${p * 12}px)`, WebkitBackdropFilter: `blur(${p * 12}px)` }}
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
          // Entrance is choreographed inside the composition; the exit springs the whole card away.
          opacity: closing ? p : 1,
          transform: closing ? `translateY(${(1 - p) * 16}px) scale(${0.96 + p * 0.04})` : undefined,
        }}
      >
        <Player
          key={current.title + current.body}
          component={ConfirmScene}
          inputProps={{ ...current, busy, onCancel, onConfirm }}
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
