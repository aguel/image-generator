// Hairline icon set (1.5px stroke, 16px grid).
import type { ReactNode, SVGProps } from "react";
import type { StyleId, StylePreset } from "@/lib/styles";

function Base({ children, size = 16, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

type P = SVGProps<SVGSVGElement> & { size?: number };

export const IconExpand = (p: P) => (
  <Base {...p}>
    <path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5L9 7M2.5 13.5L7 9" />
  </Base>
);
export const IconDownload = (p: P) => (
  <Base {...p}>
    <path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M2.5 13.5h11" />
  </Base>
);
export const IconTrash = (p: P) => (
  <Base {...p}>
    <path d="M2.5 4h11M6 4V2.5h4V4M3.8 4l.7 9.5h7l.7-9.5" />
  </Base>
);
export const IconRetry = (p: P) => (
  <Base {...p}>
    <path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v2.5h-2.5" />
  </Base>
);
export const IconClose = (p: P) => (
  <Base {...p}>
    <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
  </Base>
);
export const IconPlus = (p: P) => (
  <Base {...p}>
    <path d="M8 3v10M3 8h10" />
  </Base>
);
export const IconMinus = (p: P) => (
  <Base {...p}>
    <path d="M3 8h10" />
  </Base>
);
export const IconChevron = ({ dir = "right", ...p }: P & { dir?: "left" | "right" }) => (
  <Base {...p}>
    <path d={dir === "right" ? "M6 3l5 5-5 5" : "M10 3L5 8l5 5"} />
  </Base>
);
export const IconArchive = (p: P) => (
  <Base {...p}>
    <path d="M2.5 3.5h11v3h-11zM3.5 6.5v6.5h9V6.5M6.5 9h3" />
  </Base>
);
export const IconRestore = (p: P) => (
  <Base {...p}>
    <path d="M3 8a5 5 0 1 0 1.5-3.6M3 2.5v2.5h2.5M8 5.5V8l2 1.5" />
  </Base>
);
export const IconSpark = (p: P) => (
  <Base {...p}>
    <path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3M3.4 3.4l2 2M10.6 10.6l2 2M3.4 12.6l2-2M10.6 5.4l2-2" />
  </Base>
);
export const IconFit = (p: P) => (
  <Base {...p}>
    <rect x="2.5" y="3.5" width="11" height="9" rx="1.5" />
    <path d="M5.5 6.5v3M10.5 6.5v3" />
  </Base>
);
export const IconArrow = (p: P) => (
  <Base {...p}>
    <path d="M4.5 11.5l7-7M5.5 4.5h6v6" />
  </Base>
);
export const IconGrid = (p: P) => (
  <Base {...p}>
    <rect x="2.5" y="2.5" width="5" height="5" rx="1" />
    <rect x="8.5" y="2.5" width="5" height="5" rx="1" />
    <rect x="2.5" y="8.5" width="5" height="5" rx="1" />
    <rect x="8.5" y="8.5" width="5" height="5" rx="1" />
  </Base>
);
export const IconSweep = (p: P) => (
  <Base {...p}>
    <path d="M10.5 2.5l-4 6M4 9.5h5l1 4H3l1-4zM5.5 13.5l.5-2M8 13.5l-.2-2" />
  </Base>
);

/* ---------- Style glyphs: one per style preset, same hairline grid ---------- */

const STYLE_GLYPHS: Record<StyleId, ReactNode> = {
  // Cinematic: a clapperboard.
  cinematic: (
    <>
      <rect x="2.5" y="6.5" width="11" height="7" rx="1" />
      <path d="M2.5 6.5l10.2-3.4.6 1.9-10.2 3.4zM5.4 5.5l1.6 1M8.6 4.4l1.6 1.1" />
    </>
  ),
  // Moonlight: a crescent moon over water.
  moonlight: (
    <>
      <path d="M9.6 2.5a3.6 3.6 0 1 0 3.4 4.6 2.9 2.9 0 0 1-3.4-4.6z" />
      <path d="M2.5 11.5c1 .7 2 .7 3 0s2-.7 3 0 2 .7 3 0 1.3-.5 2 0M4.5 13.8c.8.4 1.5.4 2.3 0s1.5-.4 2.3 0" />
    </>
  ),
  // Night Paint: a brush with a stroke.
  "night-paint": (
    <>
      <path d="M13.5 2.5L8 8M7 7.2l1.8 1.8" />
      <path d="M7 7.2c-1.6-.3-2.8.6-3 2.3-.1 1.2-.6 2.2-1.5 2.8 2 .9 4.6.7 5.6-1 .6-1 .6-1.9-.3-2.3" />
    </>
  ),
  // Melancholy: a low sun sinking into haze.
  melancholy: (
    <>
      <path d="M4.5 10a3.5 3.5 0 0 1 7 0" />
      <path d="M8 3v1.6M3.3 5l1.1 1.1M12.7 5l-1.1 1.1M1.8 10h12.4M3.5 12.3h9M5.5 14.3h5" />
    </>
  ),
  // Director's Cut: a film camera with its two reels.
  "directors-cut": (
    <>
      <circle cx="5" cy="4.5" r="2" />
      <circle cx="10" cy="4.5" r="2" />
      <rect x="2.5" y="7.5" width="8" height="5" rx="1" />
      <path d="M10.5 9.5l3-1.5v4l-3-1.5" />
    </>
  ),
  // Solitude: a lone tree by a river.
  solitude: (
    <>
      <path d="M6 13V8.5M6 8.5c-2 0-3-1.2-3-2.6S4.3 3 6 3s3 1.4 3 2.9-1 2.6-3 2.6z" />
      <path d="M2.5 13.5h4M9 11.5c.9.5 1.8.5 2.6 0s1.4-.4 1.9 0M9.5 13.5c.7.3 1.4.3 2 0" />
    </>
  ),
  // Landscape: mountains under a sun with a cloud.
  landscape: (
    <>
      <path d="M1.5 13.5l4-6 2.5 3.2 2-2.7 4.5 5.5z" />
      <circle cx="11.5" cy="4" r="1.5" />
      <path d="M2.5 5.5h3.5M3.5 3.8h1.8" />
    </>
  ),
  // Raw: a plain text cursor (the prompt as written).
  raw: (
    <>
      <path d="M3 4.5h7M3 8h5M3 11.5h3.5" />
      <path d="M12 3.5v9M10.8 3.5h2.4M10.8 12.5h2.4" />
    </>
  ),
};

/**
 * The style's own glyph, in its accent colour on a tile of its darkest tone.
 * Pass `size` / `radius` in px, or size it with `className` (the glyph scales to 55% of the tile).
 */
export function StyleIcon({ style, size, radius = 10, className = "" }: { style: StylePreset; size?: number; radius?: number; className?: string }) {
  return (
    <span
      className={`grid shrink-0 place-items-center ${className}`}
      style={{ width: size, height: size, borderRadius: className.includes("rounded") ? undefined : radius, background: style.swatch[0], color: style.swatch[2] }}
    >
      <svg viewBox="0 0 16 16" width="55%" height="55%" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {STYLE_GLYPHS[style.id] ?? STYLE_GLYPHS.raw}
      </svg>
    </span>
  );
}
