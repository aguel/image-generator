"use client";

import type { ElementType, ReactNode, ComponentPropsWithoutRef } from "react";
import { useReveal, type RevealFrom, SPRINGS } from "@/lib/motion";

type RevealProps<T extends ElementType> = {
  as?: T;
  delay?: number;
  from?: RevealFrom;
  distance?: number;
  spring?: keyof typeof SPRINGS;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children">;

/** Spring-in wrapper driven by Remotion's `spring()`; delay is in 60fps frames. */
export function Reveal<T extends ElementType = "div">({
  as,
  delay = 0,
  from = "up",
  distance,
  spring = "soft",
  children,
  ...rest
}: RevealProps<T>) {
  const ref = useReveal<HTMLElement>({ delay, from, distance, config: SPRINGS[spring] });
  const Tag = (as ?? "div") as ElementType;
  return (
    <Tag ref={ref} style={{ opacity: 0 }} {...rest}>
      {children}
    </Tag>
  );
}
