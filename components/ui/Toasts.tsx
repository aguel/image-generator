"use client";

import { useEffect, useState } from "react";
import { interpolate, usePresence, SPRINGS } from "@/lib/motion";

export interface Toast {
  id: number;
  message: string;
  tone: "info" | "error" | "success";
}

function ToastItem({ toast, onDone }: { toast: Toast; onDone: (id: number) => void }) {
  const [visible, setVisible] = useState(true);
  const [p, rendered] = usePresence(visible, SPRINGS.bouncy, 0);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), toast.tone === "error" ? 6000 : 3200);
    return () => clearTimeout(t);
  }, [toast.tone]);

  useEffect(() => {
    if (!rendered) onDone(toast.id);
  }, [rendered, onDone, toast.id]);

  const dot = toast.tone === "error" ? "bg-danger" : toast.tone === "success" ? "bg-teal" : "bg-amber";
  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      onClick={() => setVisible(false)}
      className="pointer-events-auto flex max-w-[min(92vw,460px)] cursor-pointer items-center gap-3 rounded-full bg-ink py-2.5 pl-4 pr-5 text-[14px] text-paper shadow-[0_20px_50px_-18px_rgba(14,14,13,0.6)]"
      style={{
        opacity: Math.min(1, p * 1.3),
        transform: `translateY(${interpolate(p, [0, 1], [24, 0])}px) scale(${interpolate(p, [0, 1], [0.9, 1])})`,
      }}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <span className="line-clamp-2">{toast.message}</span>
    </div>
  );
}

export function Toasts({ toasts, onDone }: { toasts: Toast[]; onDone: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[95] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDone={onDone} />
      ))}
    </div>
  );
}
