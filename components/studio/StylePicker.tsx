"use client";

import { useEffect, useId, useRef, useState } from "react";
import { STYLES, getStyle, type StyleId } from "@/lib/styles";
import { interpolate, usePresence, SPRINGS } from "@/lib/motion";
import { IconChevron, StyleIcon } from "./icons";

/**
 * Style dropdown that scales to any number of styles: a trigger showing the current
 * style, and a listbox (style icon, name, tagline) that springs open with Remotion.
 * Keyboard: ↑/↓ to move, Enter to choose, Esc to close.
 */
export function StylePicker({
  value,
  onChange,
  placement = "down",
  compact = false,
}: {
  value: StyleId;
  onChange: (id: StyleId) => void;
  placement?: "down" | "up";
  /** Smaller trigger without the tagline (for toolbars). */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Where the list opens and how tall it may be, measured against the viewport when it opens.
  const [fit, setFit] = useState<{ place: "down" | "up"; max: number }>({ place: placement, max: 440 });
  const [p, rendered] = usePresence(open, SPRINGS.snappy);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = getStyle(value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const t = setTimeout(() => root.current?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]')?.focus(), 30);
    document.addEventListener("pointerdown", onDown);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const choose = (id: StyleId) => {
    onChange(id);
    setOpen(false);
    root.current?.querySelector<HTMLButtonElement>("[data-style-trigger]")?.focus();
  };

  const onListKey = (e: React.KeyboardEvent) => {
    const options = [...(root.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    const i = options.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      options[Math.min(options.length - 1, i + 1)]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      options[Math.max(0, i - 1)]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      root.current?.querySelector<HTMLButtonElement>("[data-style-trigger]")?.focus();
    }
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        data-style-trigger
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={(e) => {
          if (!open) {
            const r = e.currentTarget.getBoundingClientRect();
            const below = window.innerHeight - r.bottom - 16;
            const above = r.top - 16;
            const wanted = Math.min(440, STYLES.length * 56 + 16);
            const place = placement === "down" ? (below >= Math.min(wanted, 300) || below >= above ? "down" : "up") : above >= Math.min(wanted, 300) || above >= below ? "up" : "down";
            setFit({ place, max: Math.max(160, Math.min(wanted, place === "down" ? below : above)) });
          }
          setOpen((o) => !o);
        }}
        className={`tile flex w-full items-center gap-3 rounded-[16px] text-left ${compact ? "h-10 rounded-full pl-1.5 pr-3" : "h-[54px] p-2 pr-3"}`}
      >
        <StyleIcon style={current} size={compact ? 28 : 38} radius={compact ? 14 : 8} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium leading-tight text-ink">{current.name}</span>
          {!compact && <span className="mt-0.5 block truncate text-[12.5px] leading-tight text-ink-soft">{current.tagline}</span>}
        </span>
        <span
          className="text-ink-soft transition-transform duration-500 ease-fluid"
          style={{ transform: `rotate(${open ? (fit.place === "down" ? -90 : 90) : 90}deg)` }}
        >
          <IconChevron />
        </span>
      </button>

      {rendered && (
        <div
          id={listId}
          role="listbox"
          aria-label="Style"
          tabIndex={-1}
          onKeyDown={onListKey}
          className={`absolute z-40 overflow-y-auto rounded-[20px] bg-paper p-1.5 shadow-[0_0_0_1px_rgba(14,14,13,0.08),0_24px_60px_-20px_rgba(14,14,13,0.4)] ${
            compact ? "w-[320px]" : "left-0 right-0"
          } ${fit.place === "down" ? "top-full mt-2 origin-top" : "bottom-full mb-2 origin-bottom"}`}
          style={{
            maxHeight: fit.max,
            opacity: p,
            transform: `translateY(${interpolate(p, [0, 1], [fit.place === "down" ? -8 : 8, 0])}px) scale(${interpolate(p, [0, 1], [0.97, 1])})`,
            pointerEvents: open ? "auto" : "none",
          }}
        >
          {STYLES.map((style, i) => {
            const selected = style.id === value;
            const local = Math.max(0, Math.min(1, (p - i * 0.05) / (1 - i * 0.05)));
            return (
              <button
                key={style.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => choose(style.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    choose(style.id);
                  }
                }}
                data-hover="off"
                className={`flex w-full items-center gap-3 rounded-[14px] p-2 pr-3 text-left transition-colors duration-500 ease-fluid focus-visible:outline-none ${
                  selected ? "bg-amber-soft" : "hover:bg-canvas focus-visible:bg-canvas"
                }`}
                style={{ opacity: local, transform: `translateY(${interpolate(local, [0, 1], [6, 0])}px)` }}
              >
                <StyleIcon style={style} size={36} radius={8} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium leading-tight text-ink">{style.name}</span>
                  <span className="mt-0.5 block truncate text-[12.5px] leading-tight text-ink-soft">{style.tagline}</span>
                </span>
                {selected && (
                  <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden className="shrink-0 text-amber">
                    <path d="M3 7.5l2.6 2.6L11 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
