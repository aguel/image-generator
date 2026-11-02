"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getAspect } from "@/lib/aspects";
import { getStyle } from "@/lib/styles";
import { FPS, interpolate, spring, usePresence, useSpringValues, SPRINGS } from "@/lib/motion";
import type { ImageRecord } from "@/lib/types";
import { downloadImage } from "./Tile";
import { IconArrow, IconChevron, IconClose, IconDownload, IconFit, IconMinus, IconPlus, IconRetry, IconTrash, StyleIcon } from "./icons";

const MIN = 1;
const MAX = 8;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type View = { s: number; x: number; y: number };
const FIT: View = { s: 1, x: 0, y: 0 };

/** Stops stage gestures (zoom on click, drag to pan) from firing through overlaid controls. */
const shield = {
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  onPointerUp: (e: React.PointerEvent) => e.stopPropagation(),
};

function DarkButton({ label, onClick, children, wide }: { label: string; onClick: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid h-9 place-items-center rounded-full text-white/75 transition-colors duration-500 ease-fluid hover:bg-white/10 hover:text-white ${wide ? "min-w-14 px-2 text-[13px] font-medium tabular-nums" : "w-9"}`}
    >
      {children}
    </button>
  );
}

/** Springs the incoming image in from the side it was navigated toward (Remotion spring). */
function useImageEntrance(key: string | undefined, dir: number) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !key) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const s = spring({ frame: ((now - start) / 1000) * FPS, fps: FPS, config: { damping: 24, stiffness: 160 } });
      el.style.opacity = String(Math.min(1, s * 1.4));
      el.style.transform = `translateX(${interpolate(s, [0, 1], [dir * 48, 0])}px) scale(${interpolate(s, [0, 1], [0.97, 1])})`;
      if (s < 0.999) raf = requestAnimationFrame(tick);
      else {
        el.style.transform = "";
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // `dir` is read once per image change on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return ref;
}

export function Lightbox({
  images,
  index,
  onClose,
  onNavigate,
  onDelete,
  onReuse,
  onRegenerate,
  regenerating,
  onRetitle,
}: {
  images: ImageRecord[];
  index: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onDelete: (image: ImageRecord) => void;
  /** Send the image's prompt, style and aspect ratio back to the Studio composer. */
  onReuse: (image: ImageRecord) => void;
  /** Replace the image with a new one from the same prompt, style and aspect ratio. */
  onRegenerate: (image: ImageRecord) => void;
  /** Ids of images a job is currently replacing. */
  regenerating: Set<string>;
  /** Write (or rewrite) the image's inspirational title. */
  onRetitle: (image: ImageRecord) => Promise<void>;
}) {
  const open = index !== null && Boolean(images[index]);
  const [p, rendered] = usePresence(open, SPRINGS.snappy);
  const [shownIndex, setShownIndex] = useState(index);
  const [dir, setDir] = useState(0);
  if (open && index !== shownIndex) {
    if (shownIndex !== null && index !== null) setDir(index > shownIndex ? 1 : -1);
    setShownIndex(index);
  }
  const image = shownIndex !== null ? images[shownIndex] : undefined;

  const [view, setView] = useState<View>(FIT);
  const anim = useSpringValues(view, { damping: 30, mass: 0.5, stiffness: 260 });
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [titling, setTitling] = useState(false);
  const [box, setBox] = useState({ W: 0, H: 0, w: 0, h: 0 });
  const enterRef = useImageEntrance(image?.id, dir);

  // Reset zoom when the image changes (adjusting state during render).
  const [viewFor, setViewFor] = useState(image?.id);
  if (image?.id !== viewFor) {
    setViewFor(image?.id);
    setView(FIT);
    setCopied(false);
  }

  // Track stage and fitted image sizes for the navigator.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || !rendered) return;
    const measure = () => {
      const img = imgRef.current;
      setBox({ W: stage.clientWidth, H: stage.clientHeight, w: img?.offsetWidth ?? 0, h: img?.offsetHeight ?? 0 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    if (imgRef.current) ro.observe(imgRef.current);
    return () => ro.disconnect();
  }, [rendered, image?.id]);

  // Keep the active filmstrip frame in view.
  useEffect(() => {
    const strip = stripRef.current;
    const active = strip?.querySelector<HTMLElement>('[aria-current="true"]');
    active?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [shownIndex, rendered]);

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
    (d: 1 | -1) => {
      if (index === null || images.length < 2) return;
      onNavigate((index + d + images.length) % images.length);
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
  const zoomed = view.s > 1.01;
  const created = new Date(image.createdAt);

  // Navigator: the visible part of the image, as fractions of the image.
  const nav = (() => {
    const { W, H, w, h } = box;
    if (!w || !h) return { l: 0, t: 0, r: 1, b: 1 };
    const l = clamp(((-W / 2 - anim.x) / anim.s + w / 2) / w, 0, 1);
    const r = clamp(((W / 2 - anim.x) / anim.s + w / 2) / w, 0, 1);
    const t = clamp(((-H / 2 - anim.y) / anim.s + h / 2) / h, 0, 1);
    const b = clamp(((H / 2 - anim.y) / anim.s + h / 2) / h, 0, 1);
    return { l, t, r, b };
  })();
  const NAV_W = 152;
  const navH = (NAV_W * image.height) / image.width;

  // Panel sections stagger in with the presence spring.
  const rise = (i: number) => {
    const local = clamp((p - i * 0.07) / (1 - i * 0.07), 0, 1);
    return { opacity: local, transform: `translateY(${interpolate(local, [0, 1], [14, 0])}px)` };
  };

  const details: { label: string; value: React.ReactNode; wide?: boolean }[] = [
    {
      label: "Style",
      value: (
        <span className="inline-flex items-center gap-2">
          <StyleIcon style={style} size={20} radius={6} />
          {style.name}
        </span>
      ),
    },
    { label: "Aspect ratio", value: `${aspect.label} ${aspect.ratio}` },
    { label: "Resolution", value: `${image.width} × ${image.height} px` },
    { label: "Created", value: created.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" }), wide: true },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[80] overflow-y-auto lg:overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      style={{ pointerEvents: open ? "auto" : "none" }}
    >
      <div className="absolute inset-0 bg-ink" style={{ opacity: p }} />

      <div className="relative flex min-h-full flex-col lg:grid lg:h-full lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* ── Stage ─────────────────────────────────────────── */}
        <div className="relative flex h-[64vh] min-h-0 flex-col lg:h-full">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4" style={{ opacity: p }}>
            <span className="rounded-full bg-black/55 px-3 py-1.5 text-[13.5px] font-medium tabular-nums text-white/85">
              {(shownIndex ?? 0) + 1} of {images.length}
            </span>
            <div className="pointer-events-auto" {...shield}>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close viewer (Esc)"
                title="Close (Esc)"
                className="flex h-10 items-center gap-2 rounded-full bg-white/10 pl-3 pr-4 text-[13.5px] font-medium text-white transition-colors duration-500 ease-fluid hover:bg-white/20"
              >
                <IconClose /> Close
              </button>
            </div>
          </div>

          <div
            ref={stageRef}
            className="relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden px-6 pb-4 pt-16 sm:px-20"
            style={{ cursor: zoomed ? (dragging ? "grabbing" : "grab") : "zoom-in" }}
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
              if (zoomed && d.moved) setView((v) => bound({ ...v, x: d.vx + dx, y: d.vy + dy }));
            }}
            onPointerUp={(e) => {
              const d = drag.current;
              drag.current = null;
              setDragging(false);
              if (d?.moved) return;
              if (e.target === stageRef.current && !zoomed) return onClose();
              const r = stageRef.current!.getBoundingClientRect();
              if (zoomed) setView(FIT);
              else zoomAt(2.5, e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
            }}
          >
            {/* Edge hit-areas for previous / next */}
            {images.length > 1 && !zoomed && (
              <>
                <button
                  type="button"
                  aria-label="Previous image"
                  {...shield}
                  onClick={() => step(-1)}
                  data-hover="off"
                  className="group absolute inset-y-0 left-0 z-10 hidden w-20 items-center justify-center sm:flex"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white/70 transition-[background-color,color,transform] duration-500 ease-fluid group-hover:-translate-x-0.5 group-hover:bg-white/20 group-hover:text-white">
                    <IconChevron dir="left" />
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  {...shield}
                  onClick={() => step(1)}
                  data-hover="off"
                  className="group absolute inset-y-0 right-0 z-10 hidden w-20 items-center justify-center sm:flex"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white/70 transition-[background-color,color,transform] duration-500 ease-fluid group-hover:translate-x-0.5 group-hover:bg-white/20 group-hover:text-white">
                    <IconChevron dir="right" />
                  </span>
                </button>
              </>
            )}

            <div
              className="flex h-full w-full items-center justify-center"
              style={{ opacity: p, transform: `scale(${interpolate(p, [0, 1], [0.94, 1])})` }}
            >
              <div ref={enterRef} className="flex h-full w-full items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={image.id}
                  ref={imgRef}
                  src={`/api/images/${image.id}?metadata=2`}
                  alt={image.prompt}
                  width={image.width}
                  height={image.height}
                  draggable={false}
                  onLoad={() => setBox((b) => ({ ...b, w: imgRef.current?.offsetWidth ?? 0, h: imgRef.current?.offsetHeight ?? 0 }))}
                  className="max-h-full max-w-full select-none rounded-[4px] object-contain"
                  style={{
                    transform: `translate3d(${anim.x}px, ${anim.y}px, 0) scale(${anim.s})`,
                    imageRendering: anim.s > 2.5 ? "pixelated" : "auto",
                  }}
                />
              </div>
            </div>

            {/* Navigator mini-map while zoomed */}
            {zoomed && (
              <div
                {...shield}
                className="absolute bottom-4 right-4 z-10 overflow-hidden rounded-[10px] bg-[#1d1c1a]"
                style={{ width: NAV_W, height: navH }}
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  const fx = (e.clientX - r.left) / r.width;
                  const fy = (e.clientY - r.top) / r.height;
                  setView((v) => bound({ ...v, x: -(fx * box.w - box.w / 2) * v.s, y: -(fy * box.h - box.h / 2) * v.s }));
                }}
                title="Click to move the view"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/images/${image.id}?metadata=2`} alt="" className="h-full w-full object-cover opacity-60" draggable={false} />
                <span
                  className="pointer-events-none absolute rounded-[3px] bg-white/15 outline outline-[1.5px] outline-white"
                  style={{ left: `${nav.l * 100}%`, top: `${nav.t * 100}%`, width: `${(nav.r - nav.l) * 100}%`, height: `${(nav.b - nav.t) * 100}%` }}
                />
              </div>
            )}
          </div>

          {/* Bottom bar: zoom controls + filmstrip */}
          <div
            {...shield}
            className="relative z-10 flex items-center gap-4 px-4 pb-4"
            style={{ opacity: p, transform: `translateY(${interpolate(p, [0, 1], [20, 0])}px)` }}
          >
            <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-[#1d1c1a] p-1">
              <DarkButton label="Zoom out (−)" onClick={() => setView((v) => bound({ ...v, s: v.s / 1.5 }))}>
                <IconMinus />
              </DarkButton>
              <DarkButton label="Actual pixels (1)" onClick={actualSize} wide>
                {pct}%
              </DarkButton>
              <DarkButton label="Zoom in (+)" onClick={() => setView((v) => bound({ ...v, s: v.s * 1.5 }))}>
                <IconPlus />
              </DarkButton>
              <DarkButton label="Fit to screen (0)" onClick={() => setView(FIT)}>
                <IconFit />
              </DarkButton>
            </div>

            {images.length > 1 && (
              <div ref={stripRef} className="scrollbar-none flex min-w-0 flex-1 gap-2 overflow-x-auto py-1">
                {images.map((img, i) => {
                  const active = i === shownIndex;
                  return (
                    <button
                      key={img.id}
                      type="button"
                      aria-label={`Show image ${i + 1}`}
                      aria-current={active ? "true" : undefined}
                      onClick={() => onNavigate(i)}
                      className={`relative h-14 shrink-0 overflow-hidden rounded-[8px] transition-opacity duration-500 ease-fluid ${
                        active ? "opacity-100 outline outline-2 -outline-offset-2 outline-white" : "opacity-45 hover:opacity-80"
                      }`}
                      style={{ aspectRatio: `${img.width} / ${img.height}` }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/images/${img.id}?metadata=2`} alt="" loading="lazy" className="h-full w-full object-cover" draggable={false} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Details panel ─────────────────────────────────── */}
        <aside
          className="relative flex flex-col bg-paper lg:h-full lg:min-h-0"
          style={{ transform: `translateX(${interpolate(p, [0, 1], [48, 0])}px)`, opacity: p }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pb-6 pt-7">
            <section style={rise(0)} aria-live="polite">
              {image.title ? (
                <>
                  <p className="text-[24px] font-semibold leading-[1.25] tracking-[-0.025em] text-ink">{image.title.text}</p>
                  {image.title.source ? <p className="mt-2 text-[15px] font-medium text-amber">{image.title.source}</p> : null}
                </>
              ) : (
                <p className="text-[18px] font-medium leading-snug text-ink-soft">This image has no title yet.</p>
              )}
              <button
                type="button"
                disabled={titling}
                onClick={async () => {
                  setTitling(true);
                  try {
                    await onRetitle(image);
                  } finally {
                    setTitling(false);
                  }
                }}
                className="chip mt-3 h-8 rounded-full px-3 text-[13px] disabled:opacity-60"
              >
                {titling ? "Writing…" : image.title ? "New quote" : "Write a title"}
              </button>
            </section>

            <section style={rise(1)}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[15px] font-semibold text-ink">Prompt</h2>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(image.prompt).then(() => setCopied(true), () => undefined);
                  }}
                  className="chip h-8 rounded-full px-3 text-[13px]"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-2 text-[15px] leading-[1.6] text-ink-soft">{image.prompt}</p>
            </section>

            <section style={rise(2)}>
              <h2 className="text-[15px] font-semibold text-ink">Details</h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 rounded-[18px] bg-canvas p-4">
                {details.map((d) => (
                  <div key={d.label} className={`min-w-0 ${d.wide ? "col-span-2" : ""}`}>
                    <dt className="text-[12.5px] text-ink-faint">{d.label}</dt>
                    <dd className="mt-0.5 truncate text-[14.5px] font-medium text-ink">{d.value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="flex flex-col gap-2" style={rise(3)}>
              <button
                type="button"
                onClick={() => downloadImage(image.id)}
                className="group flex h-[52px] items-center justify-between rounded-full bg-ink py-1.5 pl-5 pr-1.5 text-[15px] font-semibold text-paper"
              >
                Download PNG
                <span className="grid h-10 w-10 place-items-center rounded-full bg-paper/10 transition-transform duration-500 ease-fluid group-hover:translate-y-0.5">
                  <IconDownload />
                </span>
              </button>
              <button
                type="button"
                disabled={regenerating.has(image.id)}
                onClick={() => onRegenerate(image)}
                className="chip group flex h-[52px] items-center justify-between rounded-full py-1.5 pl-5 pr-1.5 text-[15px] disabled:opacity-60"
              >
                {regenerating.has(image.id) ? "Regenerating…" : "Regenerate"}
                <span className="grid h-10 w-10 place-items-center rounded-full bg-ink/[0.05] transition-transform duration-500 ease-fluid group-hover:-rotate-45">
                  <IconRetry />
                </span>
              </button>
              <button
                type="button"
                onClick={() => onReuse(image)}
                className="chip group flex h-[52px] items-center justify-between rounded-full py-1.5 pl-5 pr-1.5 text-[15px]"
              >
                Use prompt in Studio
                <span className="grid h-10 w-10 place-items-center rounded-full bg-ink/[0.05] transition-transform duration-500 ease-fluid group-hover:-translate-y-px group-hover:translate-x-0.5">
                  <IconArrow />
                </span>
              </button>
            </section>

            <section className="mt-auto flex flex-col gap-4" style={rise(4)}>
              <button
                type="button"
                onClick={() => onDelete(image)}
                className="group flex h-[52px] w-full items-center justify-between rounded-full bg-danger/[0.07] py-1.5 pl-5 pr-1.5 text-left text-danger transition-colors duration-500 ease-fluid hover:bg-danger/[0.11] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40 active:scale-[0.98]"
              >
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="text-[15px] font-semibold">Delete image</span>
                  <span className="mt-0.5 truncate text-[12.5px] text-danger/70">Removed from the Gallery; backups keep a copy</span>
                </span>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-danger/[0.12] transition-[background-color,color,transform] duration-500 ease-fluid group-hover:-rotate-12 group-hover:bg-danger group-hover:text-paper">
                  <IconTrash />
                </span>
              </button>
              <p className="text-[12.5px] leading-relaxed text-ink-faint">
                <Kbd>←</Kbd> <Kbd>→</Kbd> browse · <Kbd>+</Kbd> <Kbd>−</Kbd> zoom · <Kbd>0</Kbd> fit · <Kbd>1</Kbd> actual size · <Kbd>Esc</Kbd> close.
                Click the picture to zoom, drag to pan.
              </p>
            </section>
          </div>
        </aside>
      </div>
    </div>,
    document.body,
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-[5px] bg-ink/[0.06] px-1.5 py-px font-sans text-[11.5px] text-ink-soft">{children}</kbd>;
}
