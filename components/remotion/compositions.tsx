"use client";

import {
  AbsoluteFill,
  Easing,
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
const PAPER = "#f4f2ed";
const BLADE_LIGHT = "#e9e5dd";
const DANGER = "#d6453a";
const MONO = "var(--font-mono), ui-monospace, monospace";

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

function Grain({ seed, opacity = 0.08 }: { seed: number; opacity?: number }) {
  return (
    <AbsoluteFill style={{ mixBlendMode: "multiply", opacity, pointerEvents: "none" }}>
      <svg width="100%" height="100%">
        <filter id={`grain-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
}

function CropMarks({ inset, length, color, opacity }: { inset: number; length: number; color: string; opacity: number }) {
  const s = { position: "absolute" as const, width: length, height: length, borderColor: color, opacity };
  return (
    <>
      <div style={{ ...s, left: inset, top: inset, borderLeft: "1.5px solid", borderTop: "1.5px solid" }} />
      <div style={{ ...s, right: inset, top: inset, borderRight: "1.5px solid", borderTop: "1.5px solid" }} />
      <div style={{ ...s, left: inset, bottom: inset, borderLeft: "1.5px solid", borderBottom: "1.5px solid" }} />
      <div style={{ ...s, right: inset, bottom: inset, borderRight: "1.5px solid", borderBottom: "1.5px solid" }} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* DevelopingFrame — per-tile loader while an image is being exposed. */
/* ------------------------------------------------------------------ */
export function DevelopingFrame({ index = 0, queued = false, position }: { index?: number; queued?: boolean; position?: number }) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const t = frame / durationInFrames; // 0..1 per loop
  const phase = index * 0.37;
  const unit = Math.min(width, height);

  const glowX = 50 + Math.sin((t + phase) * Math.PI * 2) * 18;
  const glowY = 45 + Math.cos((t + phase) * Math.PI * 2) * 12;
  const scanY = interpolate((t * 2 + phase) % 1, [0, 1], [-0.15, 1.15], { easing: Easing.inOut(Easing.cubic) });
  // Waiting jobs keep the iris nearly shut and breathing slowly; running jobs open and hunt.
  const open = queued ? 0.08 + Math.sin((t + phase) * Math.PI * 2) * 0.05 : 0.45 + Math.sin((t + phase) * Math.PI * 4) * 0.22;
  const intro = spring({ frame, fps: 30, config: { damping: 18, mass: 0.8 } });
  const dots = ".".repeat(1 + (Math.floor(frame / 8) % 3));
  const counter = String(Math.floor(frame / 2) + index * 113).padStart(4, "0");

  // Emerging "latent image": soft blobs that drift, as if the print were coming up in the tray.
  const blobs = Array.from({ length: 5 }).map((_, i) => {
    const seed = index * 10 + i;
    const bx = random(`bx${seed}`) * 100;
    const by = random(`by${seed}`) * 100;
    const drift = Math.sin((t + random(`d${seed}`)) * Math.PI * 2) * 6;
    const warm = random(`w${seed}`) > 0.45;
    return { x: bx + drift, y: by - drift, r: 30 + random(`r${seed}`) * 40, color: warm ? AMBER : TEAL, o: 0.1 + random(`o${seed}`) * 0.12 };
  });

  return (
    <AbsoluteFill style={{ background: PAPER, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(60% 55% at ${glowX}% ${glowY}%, rgba(217,130,43,0.20), rgba(217,130,43,0) 70%)`,
        }}
      />
      {blobs.map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${b.x}%`,
            top: `${b.y}%`,
            width: unit * (b.r / 100),
            height: unit * (b.r / 100),
            transform: "translate(-50%,-50%)",
            borderRadius: "50%",
            background: b.color,
            opacity: b.o * (queued ? 0.35 : 1) * (0.6 + 0.4 * Math.sin((t + i * 0.2) * Math.PI * 2)),
            filter: `blur(${unit * 0.09}px)`,
          }}
        />
      ))}

      {/* Scanner sweep (only while running) */}
      <div
        style={{
          opacity: queued ? 0 : 1,
          position: "absolute",
          left: 0,
          right: 0,
          top: `${scanY * 100}%`,
          height: unit * 0.28,
          transform: "translateY(-100%)",
          background: "linear-gradient(180deg, rgba(217,130,43,0) 0%, rgba(217,130,43,0.06) 70%, rgba(217,130,43,0.35) 99%, rgba(14,14,13,0.55) 100%)",
        }}
      />

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ transform: `scale(${interpolate(intro, [0, 1], [0.6, 1])})`, opacity: intro }}>
          <Iris id={`dev-${index}`} size={unit * 0.26} open={open} rotation={t * 360 + index * 17} blade={BLADE_LIGHT} />
        </div>
      </AbsoluteFill>

      <CropMarks inset={unit * 0.05} length={unit * 0.07} color={INK} opacity={0.35 * intro} />

      <div
        style={{
          position: "absolute",
          left: unit * 0.07,
          top: unit * 0.065,
          fontFamily: MONO,
          fontSize: unit * 0.036,
          letterSpacing: "0.18em",
          color: INK,
          opacity: 0.7,
          display: "flex",
          alignItems: "center",
          gap: unit * 0.02,
        }}
      >
        <span
          style={{
            width: unit * 0.022,
            height: unit * 0.022,
            borderRadius: "50%",
            background: queued ? INK : DANGER,
            opacity: queued ? 0.3 : Math.floor(frame / 15) % 2 ? 1 : 0.25,
          }}
        />
        {queued ? `IN QUEUE${position ? ` · #${position}` : ""}` : `IMAGE ${index + 1}`}
      </div>
      <div
        style={{
          position: "absolute",
          right: unit * 0.07,
          top: unit * 0.065,
          fontFamily: MONO,
          fontSize: unit * 0.036,
          letterSpacing: "0.18em",
          color: AMBER,
          opacity: 0.8,
        }}
      >
        FR {counter}
      </div>
      <div
        style={{
          position: "absolute",
          left: unit * 0.07,
          bottom: unit * 0.065,
          fontFamily: MONO,
          fontSize: unit * 0.038,
          letterSpacing: "0.22em",
          color: INK,
          opacity: 0.85,
        }}
      >
        {queued ? `WAITING${dots}` : `GENERATING${dots}`}
      </div>
      <div
        style={{
          position: "absolute",
          right: unit * 0.07,
          bottom: unit * 0.065,
          fontFamily: MONO,
          fontSize: unit * 0.032,
          letterSpacing: "0.14em",
          color: INK,
          opacity: 0.45,
        }}
      >
        ƒ/1.8 · 1/60
      </div>
      <Grain seed={(frame % 6) + 1} />
    </AbsoluteFill>
  );
}

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
/* Viewfinder — empty-state composition.                               */
/* ------------------------------------------------------------------ */
export function Viewfinder({ reticle = true }: { reticle?: boolean }) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames, fps } = useVideoConfig();
  const t = frame / durationInFrames;
  const unit = Math.min(width, height);
  // Focus "hunts" then locks for the second half of the loop.
  const hunt = t < 0.45 ? Math.sin(t * Math.PI * 9) * (1 - t / 0.45) : 0;
  const locked = t >= 0.45;
  const leak = interpolate(t, [0, 1], [-40, 140]);
  const iso = locked ? 800 : [400, 640, 1250, 800][Math.floor(frame / 5) % 4];
  const lockPop = spring({ frame: frame - durationInFrames * 0.45, fps, config: { damping: 12 } });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `linear-gradient(105deg, transparent ${leak - 30}%, rgba(217,130,43,0.07) ${leak - 8}%, rgba(217,130,43,0.13) ${leak}%, rgba(47,143,139,0.06) ${leak + 12}%, transparent ${leak + 30}%)`,
        }}
      />
      <CropMarks inset={unit * 0.06} length={unit * 0.09} color={INK} opacity={0.3} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: reticle ? 1 : 0 }}>
        <div
          style={{
            width: unit * 0.22,
            height: unit * 0.22,
            border: `1.5px solid ${locked ? AMBER : INK}`,
            opacity: locked ? 0.9 : 0.45,
            transform: `scale(${1 + hunt * 0.25 + (locked ? (1 - lockPop) * 0.15 : 0)})`,
            borderRadius: 4,
          }}
        />
        <div style={{ position: "absolute", width: 1, height: unit * 0.06, background: INK, opacity: 0.35 }} />
        <div style={{ position: "absolute", height: 1, width: unit * 0.06, background: INK, opacity: 0.35 }} />
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: unit * 0.08,
          display: "flex",
          justifyContent: "center",
          gap: unit * 0.06,
          fontFamily: MONO,
          fontSize: unit * 0.032,
          letterSpacing: "0.2em",
          color: INK,
          opacity: 0.55,
        }}
      >
        <span>ISO {iso}</span>
        <span>ƒ/1.8</span>
        <span>1/60</span>
        <span style={{ color: locked ? AMBER : INK }}>{locked ? "AF ●" : "AF ○"}</span>
      </div>
      <Grain seed={(frame % 6) + 1} opacity={0.05} />
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
