"use client";

import { useEffect } from "react";
import { spring } from "remotion";
import { FPS } from "@/lib/motion";

/**
 * App-wide Remotion hover physics, installed once.
 * Every interactive element (buttons, tabs, radios, checkboxes, links) springs
 * up on hover, leans slightly toward the cursor, and presses in on click. It
 * animates the individual `scale` / `translate` CSS properties, so it composes
 * with any `transform` an element already uses for its own animation.
 * Opt out with `data-hover="off"` (e.g. image cards with their own hover).
 */

const SELECTOR =
  'button, a[href], [role="button"], [role="tab"], [role="radio"], [role="checkbox"], [data-hover]';
const CONFIG = { damping: 16, mass: 0.6, stiffness: 220 };

type Pose = { s: number; x: number; y: number };
interface Motion {
  from: Pose;
  to: Pose;
  cur: Pose;
  start: number;
  raf: number;
  hovered: boolean;
  pressed: boolean;
  lean: { x: number; y: number };
}

const REST: Pose = { s: 1, x: 0, y: 0 };
const motions = new WeakMap<HTMLElement, Motion>();

/**
 * Bigger elements move less, so wide cards stay calm and small icons feel lively.
 * Wide cards often sit in scrolling lists, so they only lift 1px and barely scale;
 * those lists keep a few pixels of inner padding so nothing is clipped.
 */
function intensity(el: HTMLElement) {
  const w = el.offsetWidth;
  if (w <= 48) return { scale: 0.08, lift: 1, lean: 2 };
  if (w <= 160) return { scale: 0.035, lift: 1, lean: 2.5 };
  if (w <= 320) return { scale: 0.018, lift: 1.5, lean: 3 };
  return { scale: 0.006, lift: 1, lean: 1.5 };
}

function targetFor(el: HTMLElement, m: Motion): Pose {
  if (!m.hovered && !m.pressed) return REST;
  const k = intensity(el);
  const hoverScale = 1 + k.scale;
  return {
    s: m.pressed ? hoverScale - k.scale * 2 - 0.02 : hoverScale,
    x: m.lean.x * k.lean,
    y: m.lean.y * k.lean - (m.pressed ? 0 : k.lift),
  };
}

function animate(el: HTMLElement, m: Motion) {
  const to = targetFor(el, m);
  m.from = { ...m.cur };
  m.to = to;
  m.start = performance.now();
  if (m.raf) return;
  const tick = (now: number) => {
    const p = spring({ frame: ((now - m.start) / 1000) * FPS, fps: FPS, config: CONFIG });
    m.cur = {
      s: m.from.s + (m.to.s - m.from.s) * p,
      x: m.from.x + (m.to.x - m.from.x) * p,
      y: m.from.y + (m.to.y - m.from.y) * p,
    };
    el.style.scale = m.cur.s.toFixed(4);
    el.style.translate = `${m.cur.x.toFixed(2)}px ${m.cur.y.toFixed(2)}px`;
    const settled = Math.abs(p - 1) < 0.001;
    if (!settled) {
      m.raf = requestAnimationFrame(tick);
      return;
    }
    m.raf = 0;
    if (m.to === REST || (m.to.s === 1 && m.to.x === 0 && m.to.y === 0)) {
      el.style.scale = "";
      el.style.translate = "";
    }
  };
  m.raf = requestAnimationFrame(tick);
}

function motionFor(el: HTMLElement): Motion {
  let m = motions.get(el);
  if (!m) {
    m = { from: REST, to: REST, cur: { ...REST }, start: 0, raf: 0, hovered: false, pressed: false, lean: { x: 0, y: 0 } };
    motions.set(el, m);
  }
  return m;
}

function interactive(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest<HTMLElement>(SELECTOR);
  if (!el || el.dataset.hover === "off") return null;
  if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return null;
  return el;
}

export function HoverFX() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let current: HTMLElement | null = null;

    const leave = (el: HTMLElement) => {
      const m = motionFor(el);
      m.hovered = false;
      m.pressed = false;
      m.lean = { x: 0, y: 0 };
      animate(el, m);
    };

    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const el = interactive(e.target);
      if (el === current) return;
      if (current) leave(current);
      current = el;
      if (el) {
        const m = motionFor(el);
        m.hovered = true;
        animate(el, m);
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!current || e.pointerType !== "mouse") return;
      const r = current.getBoundingClientRect();
      const m = motionFor(current);
      // Normalised lean toward the cursor, -1..1 on each axis.
      const nx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      const ny = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
      if (Math.abs(nx - m.lean.x) + Math.abs(ny - m.lean.y) < 0.12) return;
      m.lean = { x: nx, y: ny };
      animate(current, m);
    };

    const onOut = (e: PointerEvent) => {
      if (!current) return;
      const to = e.relatedTarget as Node | null;
      if (to && current.contains(to)) return;
      leave(current);
      current = null;
    };

    const onDown = (e: PointerEvent) => {
      const el = interactive(e.target);
      if (!el) return;
      const m = motionFor(el);
      m.pressed = true;
      animate(el, m);
    };

    const onUp = () => {
      if (!current) return;
      const m = motionFor(current);
      if (!m.pressed) return;
      m.pressed = false;
      animate(current, m);
    };

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onOut);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    return () => {
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return null;
}
