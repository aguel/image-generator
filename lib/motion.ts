"use client";

// Remotion-powered UI motion. Remotion's `spring` and `interpolate` are pure
// functions of a frame number, so we drive them with a requestAnimationFrame
// clock at 60fps. Entrance animations write straight to the DOM (no re-renders).

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { interpolate, spring, type SpringConfig } from "remotion";

export const FPS = 60;
export const SPRINGS = {
  soft: { damping: 200, mass: 1, stiffness: 100 },
  snappy: { damping: 22, mass: 0.6, stiffness: 180 },
  bouncy: { damping: 12, mass: 0.7, stiffness: 140 },
} satisfies Record<string, Partial<SpringConfig>>;

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export type RevealFrom = "up" | "down" | "left" | "right" | "scale" | "blur" | "none";

/**
 * Animates an element in once on mount with a Remotion spring.
 * `delay` is in frames (60fps).
 */
export function useReveal<T extends HTMLElement>({
  delay = 0,
  from = "up",
  distance = 18,
  config = SPRINGS.soft,
}: { delay?: number; from?: RevealFrom; distance?: number; config?: Partial<SpringConfig> } = {}) {
  const ref = useRef<T>(null);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.style.opacity = "";
      return;
    }
    let raf = 0;
    const start = performance.now();
    const apply = (p: number) => {
      const inv = 1 - p;
      const tx = from === "left" ? -distance * inv : from === "right" ? distance * inv : 0;
      const ty = from === "up" ? distance * inv : from === "down" ? -distance * inv : 0;
      const sc = from === "scale" ? interpolate(p, [0, 1], [0.92, 1]) : 1;
      el.style.opacity = String(Math.min(1, p * 1.2));
      el.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${sc})`;
      el.style.filter = from === "blur" || from === "scale" ? `blur(${inv * 8}px)` : "";
    };
    apply(0);
    const tick = (now: number) => {
      const frame = ((now - start) / 1000) * FPS - delay;
      const p = frame <= 0 ? 0 : spring({ frame, fps: FPS, config });
      apply(p);
      if (frame < FPS * 2.5) raf = requestAnimationFrame(tick);
      else {
        el.style.transform = "";
        el.style.filter = "";
        el.style.opacity = "";
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return ref;
}

/**
 * A 0→1 spring value that follows `target` (true = 1). Re-renders each frame
 * while moving. Returns [progress, isRendered] so callers can keep exiting
 * elements mounted until the out-animation finishes.
 */
export function usePresence(target: boolean, config: Partial<SpringConfig> = SPRINGS.snappy, initial?: number) {
  const [value, setValue] = useState(initial ?? (target ? 1 : 0));
  const valueRef = useRef(value);

  useEffect(() => {
    const to = target ? 1 : 0;
    const fromValue = valueRef.current;
    if (fromValue === to) return;
    const reduced = prefersReducedMotion();
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const frame = ((now - start) / 1000) * FPS;
      const s = reduced ? 1 : spring({ frame, fps: FPS, config });
      const v = fromValue + (to - fromValue) * s;
      const done = frame > FPS * 2 || Math.abs(v - to) < 0.001;
      valueRef.current = done ? to : v;
      setValue(valueRef.current);
      if (!done) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return [value, target || value > 0.001] as const;
}

/** Springs a set of numbers toward `target` (used for zoom / pan in the lightbox). */
export function useSpringValues<T extends Record<string, number>>(target: T, config: Partial<SpringConfig> = SPRINGS.snappy): T {
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);
  const key = JSON.stringify(target);

  useEffect(() => {
    const from = valueRef.current;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const frame = ((now - start) / 1000) * FPS;
      const s = prefersReducedMotion() ? 1 : spring({ frame, fps: FPS, config });
      const next = {} as Record<string, number>;
      for (const k of Object.keys(target)) next[k] = from[k] + (target[k] - from[k]) * s;
      valueRef.current = next as T;
      setValue(next as T);
      if (s < 0.999 && frame < FPS * 2) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return value;
}

/** A continuously running frame counter (for small live accents). */
export function useFrame(active = true) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setFrame(Math.floor(((now - start) / 1000) * FPS));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return frame;
}

export { interpolate, spring };
