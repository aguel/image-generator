"use client";

import { useEffect, useMemo, useState } from "react";
import { STYLES, type StyleId } from "@/lib/styles";
import type { ImageRecord } from "@/lib/types";
import { Reveal } from "@/components/ui/Reveal";
import { Activity } from "@/components/ui/Activity";
import { ImageCard } from "./Tile";
import { IconArrow, IconChevron, IconSpark } from "./icons";

const PAGE_SIZE = 9;

// Bento layouts keyed by how many images are on the page. Full pages use a
// 4×3 grid (one 2×2 hero plus eight singles); sparse pages tighten the grid
// so the frames always fill the view. Class names are static for Tailwind.
function bentoFor(n: number, heroRight: boolean) {
  if (n <= 1) return { grid: "md:grid-cols-1 md:grid-rows-1", hero: "" };
  if (n === 2) return { grid: "md:grid-cols-2 md:grid-rows-1", hero: "" };
  if (n === 3) return { grid: "md:grid-cols-3 md:grid-rows-2", hero: "md:col-span-2 md:row-span-2" };
  const side = heroRight ? "md:col-start-3 md:row-start-1" : "md:col-start-1 md:row-start-1";
  if (n <= 5) return { grid: "md:grid-cols-4 md:grid-rows-2", hero: `md:col-span-2 md:row-span-2 ${side}` };
  return { grid: "md:grid-cols-4 md:grid-rows-3", hero: `md:col-span-2 md:row-span-2 ${side}` };
}

type StyleFilter = "all" | StyleId;

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="seg flex items-center rounded-full p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`h-9 rounded-full px-3.5 text-[13.5px] transition-[background-color,color,box-shadow] duration-500 ease-fluid ${
            value === o.id ? "bg-ink text-paper shadow-[0_6px_16px_-8px_rgba(14,14,13,0.6)]" : "text-ink-soft hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Gallery({
  library,
  onOpen,
  onDelete,
  onRegenerate,
  regenerating,
  onGoStudio,
  onWriteTitles,
  writingTitles,
}: {
  library: ImageRecord[] | null;
  onOpen: (image: ImageRecord, list: ImageRecord[]) => void;
  onDelete: (image: ImageRecord) => void;
  onRegenerate: (image: ImageRecord) => void;
  /** Ids of images a job is currently replacing. */
  regenerating: Set<string>;
  onGoStudio: () => void;
  /** Write quote titles for every image that has none. */
  onWriteTitles: () => void;
  writingTitles: boolean;
}) {
  const [style, setStyle] = useState<StyleFilter>("all");
  const [page, setPage] = useState(0);

  const filtered = useMemo(
    () => (library ?? []).filter((r) => style === "all" || r.styleId === style),
    [library, style],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const untitled = (library ?? []).filter((r) => !r.title).length;
  const current = Math.min(page, pages - 1);
  const items = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const bento = bentoFor(items.length, current % 2 === 1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"], [role="alertdialog"][data-open="true"]')) return;
      if ((e.target as HTMLElement)?.closest("input, textarea")) return;
      if (e.key === "ArrowRight") setPage((p) => Math.min(p + 1, pages - 1));
      if (e.key === "ArrowLeft") setPage((p) => Math.max(p - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pages]);

  const filterStyle = (v: StyleFilter) => {
    setStyle(v);
    setPage(0);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Toolbar */}
      <Reveal className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-1">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-ink md:text-[32px]">Gallery</h1>
          <p className="label mt-0.5 !text-[13px]">
            {library ? (filtered.length === library.length ? `${library.length} images` : `Showing ${filtered.length} of ${library.length} images`) : "Loading…"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {library && (untitled > 0 || writingTitles) && (
            <button type="button" onClick={onWriteTitles} disabled={writingTitles} className="chip action-pill disabled:opacity-80">
              <span className="disc bg-amber-soft text-amber">
                {writingTitles ? <Activity size={16} tone="#d9822b" blade="#fbf1e6" label="Writing titles" /> : <IconSpark size={13} />}
              </span>
              {writingTitles ? "Writing titles…" : `Add titles to ${untitled} image${untitled === 1 ? "" : "s"}`}
            </button>
          )}
          <Segmented
            label="Filter by style"
            value={style}
            onChange={filterStyle}
            options={[{ id: "all", label: "All styles" }, ...STYLES.map((s) => ({ id: s.id, label: s.name }))]}
          />
          <div className="seg flex items-center gap-1 rounded-full p-1">
            <button
              type="button"
              aria-label="Previous page"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
              className="grid h-9 w-9 place-items-center rounded-full text-ink transition-colors duration-500 ease-fluid hover:bg-ink/[0.05] disabled:text-ink-faint/50 disabled:hover:bg-transparent"
            >
              <IconChevron dir="left" />
            </button>
            <span className="min-w-[88px] text-center text-[13px] tabular-nums text-ink-soft">
              Page {current + 1} of {pages}
            </span>
            <button
              type="button"
              aria-label="Next page"
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
              className="grid h-9 w-9 place-items-center rounded-full text-ink transition-colors duration-500 ease-fluid hover:bg-ink/[0.05] disabled:text-ink-faint/50 disabled:hover:bg-transparent"
            >
              <IconChevron dir="right" />
            </button>
          </div>
        </div>
      </Reveal>

      {/* Bento */}
      {library === null ? (
        <div className="flex flex-1 items-center justify-center gap-3 text-[13px] text-ink-soft">
          <Activity size={22} label="Loading gallery" /> Loading your images…
        </div>
      ) : filtered.length === 0 ? (
        <Reveal from="scale" className="bezel flex flex-1">
          <div className="bezel-core flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="max-w-[420px] text-[26px] font-semibold leading-tight tracking-[-0.025em] text-ink">
              {library.length ? "No images in this style" : "No images yet"}
            </p>
            <p className="-mt-2 max-w-[380px] text-[15px] text-ink-soft">
              {library.length ? "Pick another style, or show them all." : "Images you generate in the Studio are saved here."}
            </p>
            <button
              type="button"
              onClick={library.length ? () => filterStyle("all") : onGoStudio}
              className="group flex items-center gap-3 rounded-full bg-ink py-1.5 pl-5 pr-1.5 text-[13.5px] font-medium text-paper transition-transform duration-500 ease-fluid active:scale-[0.98]"
            >
              {library.length ? "Show all styles" : "Go to Studio"}
              <span className="grid h-8 w-8 place-items-center rounded-full bg-paper/10 transition-transform duration-500 ease-fluid group-hover:-translate-y-px group-hover:translate-x-0.5 group-hover:scale-105">
                <IconArrow />
              </span>
            </button>
          </div>
        </Reveal>
      ) : (
        <div
          key={`${current}-${style}`}
          className={`grid min-h-0 flex-1 grid-cols-2 gap-3 ${bento.grid}`}
        >
          {items.map((image, i) => {
            const hero = i === 0;
            return (
              <Reveal
                key={image.id}
                delay={i * 3}
                from={hero ? "blur" : "scale"}
                spring="snappy"
                className={`bezel !p-1 [--r:22px] ${
                  hero ? `col-span-2 aspect-[4/3] md:col-span-1 md:aspect-auto ${bento.hero}` : "aspect-square md:aspect-auto"
                } min-h-0`}
              >
                <ImageCard
                  image={image}
                  fill
                  featured={hero}
                  onOpen={() => onOpen(image, filtered)}
                  onDelete={() => onDelete(image)}
                  onRegenerate={() => onRegenerate(image)}
                  regenerating={regenerating.has(image.id)}
                />
              </Reveal>
            );
          })}
        </div>
      )}
    </div>
  );
}
