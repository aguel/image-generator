"use client";

import { useEffect, useRef, useState } from "react";
import { Stage } from "@/components/remotion/Stage";
import { DevelopingFrame } from "@/components/remotion/compositions";
import { getAspect, type AspectId } from "@/lib/aspects";
import { getStyle } from "@/lib/styles";
import { FPS, interpolate, spring, SPRINGS } from "@/lib/motion";
import type { ImageRecord, QueueJob } from "@/lib/types";
import { IconClose, IconDownload, IconExpand, IconRetry, IconTrash } from "./icons";

const COMP_SIZE: Record<AspectId, [number, number]> = {
  landscape: [600, 400],
  square: [480, 480],
  portrait: [400, 600],
};


function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(since);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);
  return <>{Math.max(0, (now - since) / 1000).toFixed(1)}s</>;
}

export function downloadImage(id: string) {
  const a = document.createElement("a");
  a.href = `/api/images/${id}?download`;
  a.click();
}

/** Image "develops" in: blur, exposure and saturation spring from latent to final. */
function DevelopingImage({ image }: { image: ImageRecord }) {
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !loaded) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const frame = ((now - start) / 1000) * FPS;
      const p = spring({ frame, fps: FPS, config: { damping: 200, stiffness: 60 } });
      el.style.filter = `blur(${interpolate(p, [0, 1], [22, 0])}px) brightness(${interpolate(p, [0, 1], [1.6, 1])}) saturate(${interpolate(p, [0, 1], [0, 1])}) sepia(${interpolate(p, [0, 0.6, 1], [0.6, 0.2, 0])})`;
      el.style.transform = `scale(${interpolate(p, [0, 1], [1.08, 1])})`;
      el.style.opacity = String(Math.min(1, p * 3));
      if (frame < FPS * 3) raf = requestAnimationFrame(tick);
      else {
        el.style.filter = "";
        el.style.transform = "";
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loaded]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={`/api/images/${image.id}`}
      alt={image.prompt}
      width={image.width}
      height={image.height}
      onLoad={() => setLoaded(true)}
      className="absolute inset-0 h-full w-full object-cover"
      style={{ opacity: 0 }}
      draggable={false}
    />
  );
}

function ActionButton({ label, onClick, children, tone }: { label: string; onClick: () => void; children: React.ReactNode; tone?: "danger" }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`grid h-8 w-8 place-items-center rounded-full bg-paper/90 text-ink shadow-[0_4px_14px_-6px_rgba(0,0,0,0.4)] transition-[background-color,color,transform] duration-500 ease-fluid active:scale-95 ${
        tone === "danger" ? "hover:bg-danger hover:text-paper" : "hover:bg-ink hover:text-paper"
      }`}
    >
      {children}
    </button>
  );
}

export function ImageCard({
  image,
  index,
  onOpen,
  onDelete,
  develop = false,
  fill = false,
  featured = false,
}: {
  image: ImageRecord;
  index?: number;
  onOpen: () => void;
  onDelete: () => void;
  develop?: boolean;
  /** Fill the parent box (object-cover) instead of using the image's aspect ratio. */
  fill?: boolean;
  /** Larger caption treatment for hero cells. */
  featured?: boolean;
}) {
  const aspect = getAspect(image.aspect);
  const hoverRef = useRef<HTMLDivElement>(null);

  // Hover lift uses a short Remotion spring rather than CSS transitions.
  const animateHover = (to: number) => {
    const el = hoverRef.current;
    if (!el) return;
    const from = Number(el.dataset.h ?? 0);
    const start = performance.now();
    const tick = (now: number) => {
      const s = spring({ frame: ((now - start) / 1000) * FPS, fps: FPS, config: SPRINGS.snappy });
      const v = from + (to - from) * s;
      el.dataset.h = String(v);
      el.style.setProperty("--h", String(v));
      if (s < 0.999) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  return (
    <div
      ref={hoverRef}
      role="button"
      data-hover="off"
      tabIndex={0}
      aria-label={`Open “${image.title?.text ?? image.prompt}”`}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      onPointerEnter={() => animateHover(1)}
      onPointerLeave={() => animateHover(0)}
      onFocus={() => animateHover(1)}
      onBlur={() => animateHover(0)}
      className={`group relative cursor-zoom-in overflow-hidden rounded-[18px] bg-canvas ${fill ? "h-full w-full" : "w-full"}`}
      style={{ ...(fill ? {} : { aspectRatio: `${aspect.width} / ${aspect.height}` }), ["--h" as string]: 0 }}
    >
      <div className="absolute inset-0" style={{ transform: "scale(calc(1 + var(--h) * 0.04))" }}>
        {develop ? (
          <DevelopingImage image={image} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/images/${image.id}`}
            alt={image.prompt}
            width={image.width}
            height={image.height}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        )}
      </div>
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent"
        style={{ opacity: featured ? "calc(0.55 + var(--h) * 0.45)" : "var(--h)" }}
      />
      <div
        className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3.5"
        style={featured ? undefined : { opacity: "var(--h)", transform: "translateY(calc((1 - var(--h)) * 10px))" }}
      >
        <div className="min-w-0 text-left">
          {featured && (
            <span className="text-[12px] font-medium text-white/70">
              {getStyle(image.styleId).name} · {aspect.label} {aspect.ratio}
            </span>
          )}
          <p className={`line-clamp-2 text-white ${featured ? "mt-1 text-[19px] font-semibold leading-snug tracking-[-0.015em]" : "text-[13.5px] font-medium leading-snug"}`}>
            {image.title?.text ?? image.prompt}
          </p>
          {image.title?.source ? (
            <p className={`mt-0.5 truncate text-white/70 ${featured ? "text-[13.5px]" : "text-[12px]"}`}>{image.title.source}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1.5" style={featured ? { opacity: "var(--h)" } : undefined}>
          <ActionButton label="View full size" onClick={onOpen}>
            <IconExpand />
          </ActionButton>
          <ActionButton label="Download" onClick={() => downloadImage(image.id)}>
            <IconDownload />
          </ActionButton>
          <ActionButton label="Delete" tone="danger" onClick={onDelete}>
            <IconTrash />
          </ActionButton>
        </div>
      </div>
      {typeof index === "number" && (
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-paper/90 px-2 py-0.5 text-[12px] font-medium tabular-nums text-ink">
          {index + 1}
        </span>
      )}
    </div>
  );
}

export function JobTile({
  job,
  index,
  onOpen,
  onDelete,
  onRetry,
  onCancel,
}: {
  job: QueueJob;
  index: number;
  onOpen: () => void;
  onDelete: () => void;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const aspect = getAspect(job.aspect);
  const [w, h] = COMP_SIZE[job.aspect];

  if (job.status === "done" && job.image) {
    return <ImageCard image={job.image} index={index} onOpen={onOpen} onDelete={onDelete} develop />;
  }

  if (job.status === "error" || job.status === "cancelled") {
    const failed = job.status === "error";
    return (
      <div
        className={`relative flex w-full flex-col items-start justify-end gap-2.5 overflow-hidden rounded-[18px] p-4 ${
          failed ? "bg-[#fdf3f1] shadow-[inset_0_0_0_1px_rgba(214,69,58,0.18)]" : "bg-canvas shadow-[inset_0_0_0_1px_rgba(14,14,13,0.06)]"
        }`}
        style={{ aspectRatio: `${aspect.width} / ${aspect.height}` }}
      >
        <span className={`text-[13px] font-semibold ${failed ? "text-danger" : "text-ink-soft"}`}>
          Image {index + 1} {failed ? "failed" : "cancelled"}
        </span>
        {failed && <p className="line-clamp-4 text-[13px] leading-snug text-ink-soft">{job.error}</p>}
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-paper"
        >
          <IconRetry /> {failed ? "Retry" : "Queue again"}
        </button>
      </div>
    );
  }

  const queued = job.status === "queued";
  return (
    <div
      className="group relative w-full overflow-hidden rounded-[18px] shadow-[inset_0_0_0_1px_rgba(14,14,13,0.05)]"
      style={{ aspectRatio: `${aspect.width} / ${aspect.height}` }}
      aria-busy="true"
      aria-label={queued ? `Image ${index + 1} is waiting in the queue` : `Generating image ${index + 1}`}
    >
      <Stage
        component={DevelopingFrame}
        inputProps={{ index, queued, position: job.position }}
        width={w}
        height={h}
        duration={180}
        className="absolute inset-0 h-full w-full"
      />
      <span className="pointer-events-none absolute bottom-[12%] left-1/2 -translate-x-1/2 text-[12px] font-medium tabular-nums text-ink/60">
        {queued ? "Waiting for a free slot" : job.startedAt && <Elapsed since={Date.parse(job.startedAt)} />}
      </span>
      <button
        type="button"
        onClick={onCancel}
        aria-label={`Cancel image ${index + 1}`}
        title="Cancel"
        className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-paper/90 text-ink-soft opacity-0 shadow-[0_4px_14px_-6px_rgba(0,0,0,0.3)] transition-opacity duration-500 ease-fluid hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
      >
        <IconClose />
      </button>
    </div>
  );
}
