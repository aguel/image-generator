"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getAspect } from "@/lib/aspects";
import { getStyle } from "@/lib/styles";
import { interpolate, usePresence, useSpringValues, SPRINGS } from "@/lib/motion";
import type { ImageRecord } from "@/lib/types";
import { IconChevron, IconClose, IconDownload, IconFit, IconMinus, IconPlus, IconTrash } from "./icons";

const MIN = 1;
const MAX = 8;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type View = { s: number; x: number; y: number };
const FIT: View = { s: 1, x: 0, y: 0 };

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-full text-ink-soft transition-colors hover:bg-ink/[0.05] hover:text-ink"
    >
      {children}
    </button>
  );
}

export function Lightbox({
  images,
  index,
  onClose,
  onNavigate,
  onDelete,
}: {
  images: ImageRecord[];
  index: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onDelete: (image: ImageRecord) => void;
}) {
  const open = index !== null && Boolean(images[index]);
  const [p, rendered] = usePresence(open, SPRINGS.snappy);
  const [shownIndex, setShownIndex] = useState(index);
  if (open && index !== shownIndex) setShownIndex(index);
  const image = shownIndex !== null ? images[shownIndex] : undefined;

  const [view, setView] = useState<View>(FIT);
  const anim = useSpringValues(view, { damping: 30, mass: 0.5, stiffness: 260 });
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Reset zoom when the image changes (adjusting state during render).
  const [viewFor, setViewFor] = useState(image?.id);
  if (image?.id !== viewFor) {
    setViewFor(image?.id);
    setView(FIT);
  }

  const bound = useCallback((v: View): View => {
    const el = imgRef.current;
    if (!el) return v;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const s = clamp(v.s, MIN, MAX);
    const mx = ((s - 1) * w) / 2;
    const my = ((s - 1) * h) / 2;
    return { s, x: clamp(v.x, -mx, mx), y: clamp(v.y, -my, my) };
  }, []);

  /** Zoom to `s`, keeping the point (px, py) relative to the stage centre fixed. */
  const zoomAt = useCallback(
    (s: number, px = 0, py = 0) =>
      setView((v) => {
        const ns = clamp(s, MIN, MAX);
        const lx = (px - v.x) / v.s;
        const ly = (py - v.y) / v.s;
        return bound({ s: ns, x: px - ns * lx, y: py - ns * ly });
      }),
    [bound],
  );

  const actualSize = useCallback(() => {
    const el = imgRef.current;
    if (!el || !image) return;
    zoomAt(image.width / el.offsetWidth);
  }, [image, zoomAt]);

  const step = useCallback(
    (dir: 1 | -1) => {
      if (index === null || images.length < 2) return;
      onNavigate((index + dir + images.length) % images.length);
    },
    [index, images.length, onNavigate],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[role="alertdialog"][data-open="true"]')) return;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "+" || e.key === "=") setView((v) => bound({ ...v, s: v.s * 1.5 }));
      else if (e.key === "-") setView((v) => bound({ ...v, s: v.s / 1.5 }));
      else if (e.key === "0") setView(FIT);
      else if (e.key === "1") actualSize();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, step, bound, actualSize]);

  // Non-passive wheel listener so we can prevent page scroll while zooming.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !rendered) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left - r.width / 2;
      const py = e.clientY - r.top - r.height / 2;
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022));
      setView((v) => {
        const ns = clamp(v.s * factor, MIN, MAX);
        const lx = (px - v.x) / v.s;
        const ly = (py - v.y) / v.s;
        return bound({ s: ns, x: px - ns * lx, y: py - ns * ly });
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [rendered, bound]);

  if (!rendered || !image || typeof document === "undefined") return null;
  const aspect = getAspect(image.aspect);
  const style = getStyle(image.styleId);
  const pct = Math.round(view.s * 100);


  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      style={{ pointerEvents: open ? "auto" : "none" }}
    >
      <div
        className="absolute inset-0 bg-paper"
        style={{ opacity: p, backdropFilter: `blur(${p * 28}px)`, WebkitBackdropFilter: `blur(${p * 28}px)` }}
      />

      {/* Top bar */}
      <div
        className="relative z-10 flex items-center justify-between gap-4 px-4 py-3 sm:px-6"
        style={{ opacity: p, transform: `translateY(${interpolate(p, [0, 1], [-16, 0])}px)` }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="label tabular-nums">
            {String((shownIndex ?? 0) + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
          </span>
          <span className="hidden h-3 w-px bg-hair-strong sm:block" />
          <span className="label hidden sm:inline">
            {style.name} · {aspect.ratio} · {image.width}×{image.height}
          </span>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-paper/90 p-1 shadow-[0_0_0_1px_rgba(14,14,13,0.06),0_12px_36px_-16px_rgba(14,14,13,0.3)] backdrop-blur-xl">
          <ToolButton label="Zoom out (−)" onClick={() => setView((v) => bound({ ...v, s: v.s / 1.5 }))}>
            <IconMinus />
          </ToolButton>
          <button
            type="button"
            onClick={actualSize}
            title="Actual pixels (1)"
            className="label h-9 min-w-14 rounded-full px-2 tabular-nums !text-ink-soft transition-colors hover:bg-ink/[0.05] hover:!text-ink"
          >
            {pct}%
          </button>
          <ToolButton label="Zoom in (+)" onClick={() => setView((v) => bound({ ...v, s: v.s * 1.5 }))}>
            <IconPlus />
          </ToolButton>
          <ToolButton label="Fit to screen (0)" onClick={() => setView(FIT)}>
            <IconFit />
          </ToolButton>
          <span className="mx-1 h-4 w-px bg-hair-strong" />
          <ToolButton
            label="Download"
            onClick={() => {
              const a = document.createElement("a");
              a.href = `/api/images/${image.id}?download`;
              a.click();
            }}
          >
            <IconDownload />
          </ToolButton>
          <ToolButton label="Delete" onClick={() => onDelete(image)}>
            <IconTrash />
          </ToolButton>
          <ToolButton label="Close (Esc)" onClick={onClose}>
            <IconClose />
          </ToolButton>
        </div>
      </div>

      {/* Stage */}
      <div
        ref={stageRef}
        className="relative flex flex-1 touch-none items-center justify-center overflow-hidden px-4 sm:px-16"
        style={{ cursor: view.s > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in" }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          if (!d.moved && Math.abs(dx) + Math.abs(dy) > 3) {
            d.moved = true;
            setDragging(true);
          }
          if (view.s > 1 && d.moved) setView((v) => bound({ ...v, x: d.vx + dx, y: d.vy + dy }));
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          setDragging(false);
          if (d?.moved) return;
          if (e.target === stageRef.current && view.s === 1) return onClose();
          const r = stageRef.current!.getBoundingClientRect();
          const px = e.clientX - r.left - r.width / 2;
          const py = e.clientY - r.top - r.height / 2;
          if (view.s > 1.01) setView(FIT);
          else zoomAt(2.5, px, py);
        }}
      >
        {images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={() => step(-1)}
              className="absolute left-3 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-paper text-ink-soft shadow-[0_0_0_1px_rgba(14,14,13,0.06),0_10px_30px_-14px_rgba(14,14,13,0.3)] transition-colors duration-500 ease-fluid hover:text-ink sm:grid"
              style={{ opacity: p * (view.s > 1 ? 0.3 : 1) }}
            >
              <IconChevron dir="left" />
            </button>
            <button
              type="button"
              aria-label="Next image"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={() => step(1)}
              className="absolute right-3 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-paper text-ink-soft shadow-[0_0_0_1px_rgba(14,14,13,0.06),0_10px_30px_-14px_rgba(14,14,13,0.3)] transition-colors duration-500 ease-fluid hover:text-ink sm:grid"
              style={{ opacity: p * (view.s > 1 ? 0.3 : 1) }}
            >
              <IconChevron dir="right" />
            </button>
          </>
        )}
        <div
          style={{
            opacity: p,
            transform: `scale(${interpolate(p, [0, 1], [0.92, 1])})`,
            filter: `blur(${(1 - p) * 12}px)`,
          }}
          className="flex h-full max-h-full w-full items-center justify-center"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={image.id}
            ref={imgRef}
            src={`/api/images/${image.id}`}
            alt={image.prompt}
            width={image.width}
            height={image.height}
            draggable={false}
            className="max-h-[calc(100dvh-170px)] max-w-full select-none rounded-[6px] object-contain shadow-[0_0_0_1px_rgba(14,14,13,0.05),0_40px_100px_-40px_rgba(14,14,13,0.45)]"
            style={{
              transform: `translate3d(${anim.x}px, ${anim.y}px, 0) scale(${anim.s})`,
              imageRendering: anim.s > 2.5 ? "pixelated" : "auto",
            }}
          />
        </div>
      </div>

      {/* Caption */}
      <div
        className="relative z-10 mx-auto w-full max-w-3xl px-6 pb-5 pt-3 text-center"
        style={{ opacity: p * (view.s > 1 ? 0.35 : 1), transform: `translateY(${interpolate(p, [0, 1], [16, 0])}px)` }}
      >
        <p className="line-clamp-2 text-[16px] font-medium leading-snug text-ink">{image.prompt}</p>
        <p className="label mt-2">
          {new Date(image.createdAt).toLocaleString()} · click or scroll to zoom, drag to pan
        </p>
      </div>
    </div>,
    document.body,
  );
}
