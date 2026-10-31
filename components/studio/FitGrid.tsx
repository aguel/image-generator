"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Lays out `count` equal-aspect tiles so they all fit inside the available box
 * without scrolling, choosing the column count that yields the largest tiles.
 * Tiles are anchored to the top-left so they line up under the header.
 */
export function FitGrid({ count, ratio, gap = 12, children }: { count: number; ratio: number; gap?: number; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  let best = { cols: 1, tileW: 0 };
  if (size.w > 0 && size.h > 0) {
    for (let cols = 1; cols <= count; cols++) {
      const rows = Math.ceil(count / cols);
      const byWidth = (size.w - gap * (cols - 1)) / cols;
      const byHeight = ((size.h - gap * (rows - 1)) / rows) * ratio;
      const tileW = Math.min(byWidth, byHeight);
      if (tileW > best.tileW) best = { cols, tileW };
    }
  }

  return (
    <div ref={box} className="flex min-h-0 flex-1 items-start justify-start">
      {best.tileW > 0 && (
        <div
          className="grid content-start justify-start"
          style={{ gap, gridTemplateColumns: `repeat(${best.cols}, ${Math.floor(best.tileW)}px)` }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
