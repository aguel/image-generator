"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  interpolate,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const AMBER = "#d9822b";
const AMBER_HOT = "#ffc27a";
const TEAL = "#2f8f8b";
const INK = "#0e0e0d";
const DANGER = "#d6453a";

/* ------------------------------------------------------------------ */
/* Iris — six half-planes rotated 60° apart form a hexagonal aperture. */
/* ------------------------------------------------------------------ */
function Iris({
  size,
  open,
  rotation,
  tone = AMBER,
  blade = "#1d1916",
  id,
}: {
  size: number;
  open: number;
  rotation: number;
  tone?: string;
  blade?: string;
  id: string;
}) {
  const r = 50;
  const gap = interpolate(open, [0, 1], [4, 40]);
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" style={{ overflow: "visible" }}>
      <defs>
        <clipPath id={`${id}-clip`}>
          <circle r={r - 2} />
        </clipPath>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0%" stopColor={tone} stopOpacity={0.95} />
          <stop offset="55%" stopColor={tone} stopOpacity={0.25} />
          <stop offset="100%" stopColor={tone} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle r={r - 2} fill={`url(#${id}-glow)`} />
      <g clipPath={`url(#${id}-clip)`} transform={`rotate(${rotation})`}>
        {Array.from({ length: 6 }).map((_, i) => (
          <g key={i} transform={`rotate(${i * 60}) skewY(-14)`}>
            <rect x={gap * 0.58} y={-r * 1.6} width={r * 2} height={r * 1.6} fill={blade} />
            <line x1={gap * 0.58} y1={-r * 1.6} x2={gap * 0.58} y2={0} stroke={tone} strokeOpacity={0.35} strokeWidth={0.8} />
          </g>
        ))}
      </g>
      <circle r={r - 2} fill="none" stroke={tone} strokeOpacity={0.55} strokeWidth={1.5} />
      <circle r={r + 3} fill="none" stroke={INK} strokeOpacity={0.08} strokeWidth={1} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* ImageDraft — the idle preview, waiting and generating tiles.        */
/* ------------------------------------------------------------------ */
// A wall of small coloured dots on a fixed grid, glowing against black. Slow waves swell and brighten the dots,
// a bright diagonal band passes across them, and single dots twinkle, as if the picture were
// still forming. The finished image then sharpens into place from the top down
// (DevelopingImage in Tile.tsx).
//
//  idle     The full spectrum at low strength, with slow waves and an unhurried band.
//  queued   Grey and nearly still; the band is slow and dim.
//  running  Vivid and quick; on the job's own clock more of the wall lights up,
//           so the tile visibly fills in while it works.
// Each frame is a pure function of time. Reduced motion holds a still frame.

export type DraftMode = "idle" | "queued" | "running";
type RGB = [number, number, number];

const TAU = Math.PI * 2;
const GREY: RGB = [176, 172, 166];
/** Colours around the wall's hue wheel; the wheel wraps, so the last blends back into the first. */
const DOT_HUES = ["#f0386b", "#ff7a2f", "#ffbf1f", "#37c871", "#14b8c4", "#2f7bff", "#7350ff", "#d93fd0"];
const DOT_SHADES = 40;
/** Grid spacing in on-screen CSS pixels, so dots stay the same small size however large the tile is. */
const DOT_PITCH = 8;
const SPRITE_SIZE = 8;
/** Smallest dot radius in device pixels; below this, dots on a standard-density screen fade to almost nothing. */
const DOT_MIN_RADIUS = 0.8;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3;
const rgbOf = (hex: string): RGB => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mixRGB = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const cssOf = (c: RGB) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
/** A repeatable value in 0–1 for one dot, cheap enough to call for thousands of them. */
const hashOf = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** Per-mode feel: dot size and opacity at rest and at peak (size is a share of the pitch), and how the wall moves. */
const DRAFT_LOOK: Record<DraftMode, { size: [number, number]; alpha: [number, number]; flow: number; band: number; bandSeconds: number; twinkle: number; spin: number }> = {
  idle: { size: [0.056, 0.125], alpha: [0.6, 1], flow: 0.45, band: 0.3, bandSeconds: 5, twinkle: 0.25, spin: 0.012 },
  queued: { size: [0.05, 0.088], alpha: [0.34, 0.68], flow: 0.14, band: 0.2, bandSeconds: 7, twinkle: 0.1, spin: 0 },
  running: { size: [0.056, 0.156], alpha: [0.5, 1], flow: 1.15, band: 0.75, bandSeconds: 2.4, twinkle: 0.45, spin: 0.04 },
};

interface Dot {
  x: number;
  y: number;
  u: number;
  v: number;
  /** Twinkle phase and speed, and a small hue offset that keeps neighbours from looking airbrushed. */
  phase: number;
  speed: number;
  jitter: number;
}

/** All sizes are in device pixels. Dots sit on pixel centres at a whole-pixel pitch, which keeps the wall free of moiré. */
function dotGrid(width: number, height: number, base: number, pitch: number): Dot[] {
  const cols = Math.floor(width / pitch);
  const rows = Math.floor(height / pitch);
  const left = Math.round((width - (cols - 1) * pitch) / 2) + 0.5;
  const top = Math.round((height - (rows - 1) * pitch) / 2) + 0.5;
  return Array.from({ length: cols * rows }, (_, i) => {
    const x = left + (i % cols) * pitch;
    const y = top + Math.floor(i / cols) * pitch;
    const n = i + base * 1000;
    return { x, y, u: x / width, v: y / height, phase: hashOf(n) * TAU, speed: 1 + hashOf(n + 0.31) * 2.5, jitter: hashOf(n + 0.67) - 0.5 };
  });
}

/** One small antialiased circle per colour, shared by every tile: drawing these is far cheaper than thousands of arcs. */
let dotSprites: { shades: HTMLCanvasElement[]; grey: HTMLCanvasElement } | null = null;
function getDotSprites() {
  if (dotSprites) return dotSprites;
  const sprite = (colour: RGB) => {
    const c = document.createElement("canvas");
    c.width = c.height = SPRITE_SIZE;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = cssOf(colour);
    ctx.beginPath();
    ctx.arc(SPRITE_SIZE / 2, SPRITE_SIZE / 2, SPRITE_SIZE / 2 - 0.5, 0, TAU);
    ctx.fill();
    return c;
  };
  const hues = DOT_HUES.map(rgbOf);
  const shades = Array.from({ length: DOT_SHADES }, (_, i) => {
    const at = (i / DOT_SHADES) * hues.length;
    const from = Math.floor(at);
    return sprite(mixRGB(hues[from], hues[(from + 1) % hues.length], at - from));
  });
  dotSprites = { shades, grey: sprite(GREY) };
  return dotSprites;
}

function drawDotWall(ctx: CanvasRenderingContext2D, dots: Dot[], pitch: number, mode: DraftMode, t: number, base: number, warmed: number) {
  const look = DRAFT_LOOK[mode];
  const { shades, grey } = getDotSprites();
  const offset = base * TAU;
  const flow = t * look.flow + offset;
  // The band crosses the tile once per period; each tile starts at its own point, so bands ripple across the grid.
  const band = (((t / look.bandSeconds + base) % 1) + 1) % 1 * 2.2 - 0.6;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const d of dots) {
    const wave = 0.5 + 0.25 * (Math.sin(d.u * 7 + d.v * 3 + flow) + Math.sin(d.v * 9 - d.u * 4 - flow * 0.7 + offset * 3));
    const gap = d.u * 0.7 + d.v * 0.3 - band;
    const spark = 0.5 + 0.5 * Math.sin(t * d.speed + d.phase);
    const energy = clamp01(wave * wave + look.band * Math.exp(-gap * gap * 28) + look.twinkle * spark * spark * spark + warmed * 0.3);
    const r = Math.max(DOT_MIN_RADIUS, pitch * (look.size[0] + (look.size[1] - look.size[0]) * energy));
    const hue = base + d.u * 0.4 + d.v * 0.3 + 0.08 * Math.sin(d.v * 5 + flow) + t * look.spin + d.jitter * 0.07;
    const shade = Math.floor((hue - Math.floor(hue)) * DOT_SHADES) % DOT_SHADES;
    ctx.globalAlpha = look.alpha[0] + (look.alpha[1] - look.alpha[0]) * energy;
    ctx.drawImage(mode === "queued" ? grey : shades[shade], d.x - r, d.y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
}

export function ImageDraft({
  mode = "idle",
  seed = "0",
  startedAt,
}: {
  mode?: DraftMode;
  seed?: string;
  /** Epoch ms the job started; running tiles follow the job's real clock, so a remount doesn't restart them. */
  startedAt?: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const canvas = useRef<HTMLCanvasElement>(null);
  const wall = useRef<{ width: number; height: number; base: number; pitch: number; dots: Dot[] } | null>(null);
  const still = useMemo(() => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, []);
  const base = useMemo(() => random(seed), [seed]);
  const [mountedAt] = useState(() => Date.now());
  const clock = frame / fps;
  const t = still ? 3 : mode === "running" && startedAt ? Math.max(0, (mountedAt - startedAt) / 1000 + clock) : clock;
  const warmed = mode === "running" ? 1 - Math.exp(-t / 25) : 0;
  const enter = still ? 1 : easeOut(clock / 0.6);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    // The Player scales the composition with a transform, so only the on-screen box gives the real pixel size.
    const box = el.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(box.width * dpr);
    const h = Math.round(box.height * dpr);
    if (!w || !h) return;
    const pitch = Math.max(2, Math.round(DOT_PITCH * dpr));
    let current = wall.current;
    if (!current || current.width !== w || current.height !== h || current.base !== base || current.pitch !== pitch) {
      el.width = w;
      el.height = h;
      current = wall.current = { width: w, height: h, base, pitch, dots: dotGrid(w, h, base, pitch) };
    }
    drawDotWall(ctx, current.dots, current.pitch, mode, t, base, warmed);
  }, [frame, mode, t, base, warmed]);

  return (
    <AbsoluteFill style={{ background: INK, overflow: "hidden" }}>
      <canvas ref={canvas} style={{ width: "100%", height: "100%", opacity: enter }} />
    </AbsoluteFill>
  );
}

/**
 * The finished-image reveal (ChatGPT style), driven from Tile.tsx: a blurred copy of the
 * image fades in over the draft, then the sharp image sharpens into place from the top
 * down behind a soft, feathered edge. `revealProgress` runs 0 → 1 over `REVEAL_FRAMES`
 * (30fps frames); `REVEAL_FEATHER` is the height of the soft edge, as a share of the image.
 */
export const REVEAL_FRAMES = 60;
export const REVEAL_FEATHER = 0.28;
export const revealProgress = (frame: number, fps: number) =>
  spring({ frame: frame - 8, fps, config: { damping: 200, stiffness: 40 }, durationInFrames: REVEAL_FRAMES - 8 });

/* ------------------------------------------------------------------ */
/* ApertureSpinner — the app-wide activity indicator.                  */
/* ------------------------------------------------------------------ */
export function ApertureSpinner({ tone = INK, blade = "#ffffff" }: { tone?: string; blade?: string }) {
  const frame = useCurrentFrame();
  const { durationInFrames, width } = useVideoConfig();
  const t = frame / durationInFrames;
  const open = 0.5 + Math.sin(t * Math.PI * 2) * 0.35;
  const arc = interpolate(Math.sin(t * Math.PI * 2), [-1, 1], [40, 200]);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <svg width={width} height={width} viewBox="0 0 100 100" style={{ position: "absolute", transform: `rotate(${t * 720}deg)` }}>
        <circle cx={50} cy={50} r={46} fill="none" stroke={tone} strokeWidth={4} strokeLinecap="round" strokeDasharray={`${arc} 400`} />
      </svg>
      <Iris id={`spin-${tone.replace("#", "")}`} size={width * 0.7} open={open} rotation={t * 60} tone={tone} blade={blade} />
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ */
/* LogoMark — breathing aperture used in the header.                   */
/* ------------------------------------------------------------------ */
export function LogoMark() {
  const frame = useCurrentFrame();
  const { durationInFrames, width } = useVideoConfig();
  const t = frame / durationInFrames;
  const intro = spring({ frame, fps: 30, config: { damping: 14 } });
  const open = interpolate(intro, [0, 1], [0, 0.42]) + Math.sin(t * Math.PI * 2) * 0.08;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Iris id="logo" size={width * 0.86} open={open} rotation={t * 60 + intro * 30} tone={AMBER_HOT} />
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ */
/* ConfirmGlyph — animated icon at the top of confirmation dialogs.    */
/* ------------------------------------------------------------------ */
export type GlyphVariant = "delete" | "restore" | "backup";

const GLYPH_PATHS: Record<GlyphVariant, string[]> = {
  delete: ["M34 38h32", "M44 38v-5h12v5", "M38 38l3 30h18l3-30", "M47 46v15", "M53 46v15"],
  restore: ["M33 50a17 17 0 1 0 5-12", "M33 30v9h9", "M50 41v10l7 5"],
  backup: ["M34 44h32v22H34z", "M38 36h24", "M42 30h16", "M50 49v11", "M45 55l5 5 5-5"],
};

export function ConfirmGlyph({ variant = "delete" }: { variant?: GlyphVariant }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tone = variant === "delete" ? DANGER : variant === "restore" ? TEAL : AMBER;
  const ring = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 24 });
  const pop = spring({ frame: frame - 4, fps, config: { damping: 10, mass: 0.7 } });
  const pulse = frame > 30 ? (Math.sin(((frame - 30) / fps) * Math.PI * 1.2) + 1) / 2 : 0;
  const paths = GLYPH_PATHS[variant];
  const circ = 2 * Math.PI * 34;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <circle cx={50} cy={50} r={44 + pulse * 4} fill="none" stroke={tone} strokeOpacity={0.12 * (1 - pulse) + 0.04} strokeWidth={1} />
        <circle
          cx={50}
          cy={50}
          r={34}
          fill={tone}
          fillOpacity={0.09 * pop}
          stroke={tone}
          strokeWidth={1.6}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - ring)}
          transform="rotate(-90 50 50)"
          strokeLinecap="round"
        />
        <g transform={`translate(50 50) scale(${interpolate(pop, [0, 1], [0.7, 1])}) translate(-50 -50)`}>
          {paths.map((d, i) => {
            const draw = spring({ frame: frame - 10 - i * 4, fps, config: { damping: 200 }, durationInFrames: 18 });
            return (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={INK}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - draw}
              />
            );
          })}
        </g>
      </svg>
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ */
/* Scribble — placeholder lines "being written" while prompts load.    */
/* ------------------------------------------------------------------ */
export function Scribble({ seed = 0 }: { seed?: number }) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const lines = [0.42, 0.96, 0.9, 0.98, 0.64];
  const lineH = height / (lines.length * 2.1);
  const cycle = frame % durationInFrames;
  const shimmer = interpolate(cycle, [0, durationInFrames], [-30, 130]);
  return (
    <AbsoluteFill style={{ padding: `${lineH * 0.6}px 0`, gap: lineH, display: "flex", flexDirection: "column" }}>
      {lines.map((w, i) => {
        const delay = i * 7 + (seed % 3) * 3;
        const s = spring({ frame: cycle - delay, fps, config: { damping: 200 }, durationInFrames: 22 });
        const fade = interpolate(cycle, [durationInFrames - 14, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
        return (
          <div
            key={i}
            style={{
              height: lineH,
              width: `${w * 100 * (0.85 + random(`w${seed}-${i}`) * 0.15)}%`,
              borderRadius: lineH,
              transform: `scaleX(${s})`,
              transformOrigin: "left",
              opacity: fade,
              background: i === 0
                ? `linear-gradient(90deg, rgba(14,14,13,0.16) ${shimmer - 30}%, rgba(217,130,43,0.35) ${shimmer}%, rgba(14,14,13,0.16) ${shimmer + 30}%)`
                : `linear-gradient(90deg, rgba(14,14,13,0.11) ${shimmer - 30}%, rgba(217,130,43,0.28) ${shimmer}%, rgba(14,14,13,0.11) ${shimmer + 30}%)`,
            }}
          />
        );
      })}
      <div style={{ position: "absolute", right: 0, bottom: 0, width: width * 0.04, height: width * 0.04, borderRadius: "50%", background: AMBER, opacity: (Math.sin(frame / 6) + 1) / 2 }} />
    </AbsoluteFill>
  );
}

/** Seed shared by the idle preview tile and the job that later fills its slot. */
export const latentSeed = (styleId: string, index: number) => `${styleId}:${index}`;

/** Idle and waiting frames never visibly loop (one hour at 30fps); running frames follow the job's own clock. */
export const LATENT_DURATION = 30 * 60 * 60;
