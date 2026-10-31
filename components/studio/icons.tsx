// Hairline icon set (1.5px stroke, 16px grid).
import type { SVGProps } from "react";

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
