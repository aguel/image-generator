"use client";

import { Player } from "@remotion/player";
import { useLayoutEffect, useRef, useState, useSyncExternalStore, type ComponentType, type CSSProperties } from "react";

const noopSubscribe = () => () => {};

/**
 * Thin wrapper around the Remotion <Player> for decorative, self-playing
 * compositions (loaders, glyphs, empty states). All interactivity is disabled.
 * With `cover`, the composition is resized to the container's own aspect ratio
 * (the compositions read their size from useVideoConfig), so it fills the box.
 */
export function Stage<P extends Record<string, unknown>>({
  component,
  width,
  height,
  duration,
  fps = 30,
  loop = true,
  inputProps,
  className,
  style,
  cover = false,
}: {
  component: ComponentType<P>;
  width: number;
  height: number;
  duration: number;
  fps?: number;
  loop?: boolean;
  inputProps?: P;
  className?: string;
  style?: CSSProperties;
  cover?: boolean;
}) {
  // The Player measures its container; render it only after mount to keep SSR markup stable.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const box = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!cover || !el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect;
      if (w > 0 && h > 0) setMeasured({ w: Math.round(w), h: Math.round(h) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [cover]);

  // Keep the longest side at the requested resolution so text sizes stay consistent.
  const scale = measured ? Math.max(width, height) / Math.max(measured.w, measured.h) : 1;
  const compW = cover && measured ? Math.max(1, Math.round(measured.w * scale)) : width;
  const compH = cover && measured ? Math.max(1, Math.round(measured.h * scale)) : height;
  const ready = mounted && (!cover || measured);

  return (
    <div ref={box} className={className} style={{ ...(cover ? {} : { aspectRatio: `${width} / ${height}` }), ...style }} aria-hidden>
      {ready && (
        <Player
          component={component as ComponentType<Record<string, unknown>>}
          inputProps={(inputProps ?? {}) as Record<string, unknown>}
          durationInFrames={duration}
          compositionWidth={compW}
          compositionHeight={compH}
          fps={fps}
          autoPlay
          loop={loop}
          controls={false}
          clickToPlay={false}
          doubleClickToFullscreen={false}
          spaceKeyToPlayOrPause={false}
          initiallyMuted
          acknowledgeRemotionLicense
          style={{ width: "100%", height: "100%", background: "transparent" }}
        />
      )}
    </div>
  );
}
