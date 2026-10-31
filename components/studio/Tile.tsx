"use client";

import { useEffect, useRef, useState } from "react";
import { Stage } from "@/components/remotion/Stage";
import { ImageDraft, LATENT_DURATION, latentSeed, REVEAL_FEATHER, REVEAL_FRAMES, revealProgress } from "@/components/remotion/compositions";
import { getAspect, type AspectId } from "@/lib/aspects";
import { getStyle, type StyleId } from "@/lib/styles";
import { FPS, spring, SPRINGS } from "@/lib/motion";
import type { ImageRecord, QueueJob } from "@/lib/types";
import { IconClose, IconDownload, IconExpand, IconRetry, IconTrash } from "./icons";

export const COMP_SIZE: Record<AspectId, [number, number]> = {
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
  const s = Math.max(0, (now - since) / 1000);
  return <>{s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${String(Math.floor(s % 60)).padStart(2, "0")}s`}</>;
}

const ordinal = (n: number) => {
  const tail = n % 100;
  if (tail >= 11 && tail <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
};

export function downloadImage(id: string) {
  const a = document.createElement("a");
  a.href = `/api/images/${id}?download`;
  a.click();
}

/**
 * ChatGPT-style reveal: a blurred copy of the finished image fades in over the
 * draft, then the sharp image sharpens into place from the top down behind a soft,
 * feathered edge (`revealProgress`, `REVEAL_FEATHER`).
 */
function DevelopingImage({ image }: { image: ImageRecord }) {
  const sharp = useRef<HTMLImageElement>(null);
  const soft = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [done, setDone] = useState(false);

  // A cached image can finish loading before React attaches onLoad.
  useEffect(() => {
    const el = sharp.current;
    if (!el?.complete || !el.naturalWidth) return;
    const raf = requestAnimationFrame(() => setLoaded(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const el = sharp.current;
    const under = soft.current;
    if (!el || !under || !loaded) return;
    let raf = 0;
    const finish = () => {
      el.style.maskImage = el.style.webkitMaskImage = "";
      setDone(true);
    };
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      raf = requestAnimationFrame(finish);
      return () => cancelAnimationFrame(raf);
    }
    const start = performance.now();
    const tick = (now: number) => {
      const frame = ((now - start) / 1000) * 30;
      under.style.opacity = String(Math.min(1, frame / 8));
      // The sharp layer's edge travels from above the top to below the bottom, feathered over REVEAL_FEATHER.
      const edge = -REVEAL_FEATHER + revealProgress(frame, 30) * (1 + REVEAL_FEATHER * 2);
      const mask = `linear-gradient(to bottom, #000 ${((edge - REVEAL_FEATHER) * 100).toFixed(2)}%, transparent ${(edge * 100).toFixed(2)}%)`;
      el.style.maskImage = el.style.webkitMaskImage = mask;
      if (frame < REVEAL_FRAMES + 4) raf = requestAnimationFrame(tick);
      else finish();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loaded]);

  const hidden = "linear-gradient(to bottom, transparent, transparent)";
  return (
    <>
      {!done && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={soft}
          src={`/api/images/${image.id}`}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl saturate-[0.85]"
          style={{ opacity: 0 }}
          draggable={false}
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={sharp}
        src={`/api/images/${image.id}`}
        alt={image.prompt}
        width={image.width}
        height={image.height}
        onLoad={() => setLoaded(true)}
        className="absolute inset-0 h-full w-full object-cover"
        style={done ? undefined : { maskImage: hidden, WebkitMaskImage: hidden }}
        draggable={false}
      />
    </>
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
  onRegenerate,
  regenerating = false,
  develop = false,
  fill = false,
  featured = false,
}: {
  image: ImageRecord;
  index?: number;
  onOpen: () => void;
  onDelete: () => void;
  /** Replace this image with a new one from the same prompt, style and aspect ratio. */
  onRegenerate: () => void;
  /** A job is replacing this image: show the dot wall until it finishes. */
  regenerating?: boolean;
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
      className={`group relative cursor-zoom-in overflow-hidden rounded-[18px] ${develop ? "bg-ink" : "bg-canvas"} ${fill ? "h-full w-full" : "w-full"}`}
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
      {regenerating && (
        <div className="absolute inset-0 bg-ink">
          <Stage cover component={ImageDraft} inputProps={{ mode: "running", seed: image.id }} width={600} height={400} duration={LATENT_DURATION} className="absolute inset-0 h-full w-full" />
          <span className="pointer-events-none absolute left-2.5 top-2.5 inline-flex items-center gap-2 rounded-full bg-paper px-3 py-1.5 text-[12.5px] font-medium text-ink">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
            Regenerating
          </span>
        </div>
      )}
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
          {!regenerating && (
            <ActionButton label="Regenerate" onClick={onRegenerate}>
              <IconRetry />
            </ActionButton>
          )}
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

/** Empty-canvas preview: one draft tile per image the next Generate will make, in the chosen style and aspect. */
export function IdleTile({ styleId, aspect: aspectId, index }: { styleId: StyleId; aspect: AspectId; index: number }) {
  const aspect = getAspect(aspectId);
  const [w, h] = COMP_SIZE[aspectId];
  return (
    <div className="relative w-full overflow-hidden rounded-[18px] bg-ink" style={{ aspectRatio: `${aspect.width} / ${aspect.height}` }}>
      <Stage
        key={`${styleId}-${aspectId}`}
        component={ImageDraft}
        inputProps={{ mode: "idle", seed: latentSeed(styleId, index) }}
        width={w}
        height={h}
        duration={LATENT_DURATION}
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}

export function JobTile({
  job,
  index,
  onOpen,
  onDelete,
  onRegenerate,
  onRetry,
  onCancel,
}: {
  job: QueueJob;
  index: number;
  onOpen: () => void;
  onDelete: () => void;
  onRegenerate: () => void;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const aspect = getAspect(job.aspect);
  const [w, h] = COMP_SIZE[job.aspect];

  if (job.status === "done" && job.image) {
    return <ImageCard image={job.image} index={index} onOpen={onOpen} onDelete={onDelete} onRegenerate={onRegenerate} develop />;
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
  const startedAt = job.startedAt ? Date.parse(job.startedAt) : undefined;
  return (
    <div
      className="group relative w-full overflow-hidden rounded-[18px] bg-ink"
      style={{ aspectRatio: `${aspect.width} / ${aspect.height}` }}
      aria-busy="true"
      aria-label={queued ? `Image ${index + 1} is waiting in the queue` : `Generating image ${index + 1}`}
    >
      <Stage
        component={ImageDraft}
        inputProps={{
          mode: queued ? "queued" : "running",
          seed: latentSeed(job.styleId, index),
          startedAt,
        }}
        width={w}
        height={h}
        duration={LATENT_DURATION}
        className="absolute inset-0 h-full w-full"
      />
      <span
        className={`pointer-events-none absolute bottom-2.5 left-2.5 inline-flex max-w-[calc(100%-20px)] items-center gap-2 truncate rounded-full px-3 py-1.5 text-[12.5px] font-medium tabular-nums text-ink ${
          queued ? "chip" : "bg-paper"
        }`}
      >
        {queued ? (
          job.position ? `${ordinal(job.position)} in line` : "Waiting for a free slot"
        ) : (
          <>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
            Generating
            {startedAt ? (
              <span className="text-ink-faint">
                <Elapsed since={startedAt} />
              </span>
            ) : null}
          </>
        )}
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
