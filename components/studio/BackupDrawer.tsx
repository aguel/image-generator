"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { interpolate, usePresence, SPRINGS } from "@/lib/motion";
import { Activity } from "@/components/ui/Activity";
import { Reveal } from "@/components/ui/Reveal";
import type { BackupSummary } from "@/lib/types";
import { IconArchive, IconClose, IconRestore, IconTrash } from "./icons";

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function BackupDrawer({
  open,
  backups,
  loading,
  creating,
  onClose,
  onCreate,
  onRestore,
  onDelete,
}: {
  open: boolean;
  backups: BackupSummary[] | null;
  loading: boolean;
  creating: boolean;
  onClose: () => void;
  onCreate: () => void;
  onRestore: (b: BackupSummary) => void;
  onDelete: (b: BackupSummary) => void;
}) {
  const [p, rendered] = usePresence(open, SPRINGS.snappy);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector('[role="alertdialog"][data-open="true"]')) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!rendered || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70]" style={{ pointerEvents: open ? "auto" : "none" }}>
      <div className="absolute inset-0 bg-ink/15 backdrop-blur-[2px]" style={{ opacity: p }} onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Backups"
        className="bezel absolute bottom-3 right-3 top-3 flex w-[calc(100%-1.5rem)] max-w-[440px] [--r:32px] shadow-[0_40px_120px_-40px_rgba(14,14,13,0.5)]"
        style={{ transform: `translateX(${interpolate(p, [0, 1], [110, 0])}%)` }}
      >
        <div className="bezel-core flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-start justify-between gap-4 border-b border-hair px-6 pb-5 pt-6">
          <div>
            <span className="label">Internal backup API</span>
            <h2 className="mt-1 text-[28px] font-semibold leading-tight tracking-[-0.03em] text-ink">
              Backups
            </h2>
            <p className="mt-2 max-w-[320px] text-[14px] leading-relaxed text-ink-soft">
              Snapshots of every image and its details, saved in <code className="font-mono text-[12px] text-ink">data/backups</code>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close backups"
            className="chip grid h-9 w-9 place-items-center rounded-full"
          >
            <IconClose />
          </button>
        </header>

        <div className="px-6 py-5">
          <button
            type="button"
            onClick={onCreate}
            disabled={creating}
            className="flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-ink text-[14px] font-medium text-paper shadow-[0_16px_36px_-16px_rgba(14,14,13,0.7)] transition-transform duration-500 ease-fluid active:scale-[0.98] disabled:cursor-wait disabled:opacity-80"
          >
            {creating ? <Activity size={18} tone="#ffffff" blade="#0e0e0d" label="Creating backup" /> : <IconArchive />}
            {creating ? "Creating backup…" : "Create backup"}
          </button>
        </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-6 pb-8">
          {loading && !backups ? (
            <div className="flex items-center gap-3 py-8 text-[13px] text-ink-soft">
              <Activity size={22} label="Loading backups" /> Loading backups…
            </div>
          ) : backups && backups.length === 0 ? (
            <p className="py-8 text-[14px] text-ink-soft">No backups yet. Create one before making big changes.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {backups?.map((b, i) => (
                <Reveal
                  as="li"
                  key={b.id}
                  delay={i * 3}
                  from="right"
                  className="group flex items-center gap-4 rounded-[18px] bg-ink/[0.025] p-4 transition-colors duration-500 ease-fluid hover:bg-ink/[0.05]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium text-ink">
                      {new Date(b.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                    <p className="label mt-0.5 truncate">
                      {b.imageCount} image{b.imageCount === 1 ? "" : "s"} · {formatBytes(b.bytes)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRestore(b)}
                    className="flex h-9 items-center gap-1.5 rounded-full bg-teal/10 px-3.5 text-[13px] font-medium text-teal transition-colors duration-500 ease-fluid hover:bg-teal hover:text-paper"
                  >
                    <IconRestore size={14} /> Restore
                  </button>
                  <button
                    type="button"
                    aria-label="Delete backup"
                    onClick={() => onDelete(b)}
                    className="grid h-8 w-8 place-items-center rounded-full text-ink-faint transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <IconTrash size={14} />
                  </button>
                </Reveal>
              ))}
            </ol>
          )}
        </div>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
