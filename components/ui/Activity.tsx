"use client";

import { Stage } from "@/components/remotion/Stage";
import { ApertureSpinner } from "@/components/remotion/compositions";

/** App-wide activity indicator — a Remotion aperture that breathes while work runs. */
export function Activity({ size = 18, tone, blade, label }: { size?: number; tone?: string; blade?: string; label?: string }) {
  return (
    <span role="status" aria-label={label ?? "Working"} className="inline-flex shrink-0" style={{ width: size, height: size }}>
      <Stage
        component={ApertureSpinner}
        inputProps={{ ...(tone ? { tone } : {}), ...(blade ? { blade } : {}) }}
        width={96}
        height={96}
        duration={60}
        style={{ width: size, height: size }}
      />
    </span>
  );
}
