"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageRecord, QueueJob, QueueSnapshot } from "./types";

export interface QueueItem {
  prompt: string;
  styleId: string;
  aspect: string;
}

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

/**
 * Client view of the server queue. Polls /api/queue (fast while work is active)
 * and reports each newly finished image once through `onImage`.
 */
export function useQueue(onImage: (image: ImageRecord) => void) {
  const [snap, setSnap] = useState<QueueSnapshot | null>(null);
  const seen = useRef(new Set<string>());
  const onImageRef = useRef(onImage);
  useEffect(() => {
    onImageRef.current = onImage;
  }, [onImage]);

  const apply = useCallback((next: QueueSnapshot) => {
    for (const j of next.jobs) {
      if (j.status === "done" && j.image && !seen.current.has(j.id)) {
        seen.current.add(j.id);
        onImageRef.current(j.image);
      }
    }
    setSnap(next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      apply(await json<QueueSnapshot>(await fetch("/api/queue", { cache: "no-store" })));
    } catch {
      /* transient; next poll retries */
    }
  }, [apply]);

  const active = (snap?.running ?? 0) + (snap?.queued ?? 0) > 0;
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      await refresh();
      if (alive) timer = setTimeout(loop, active ? 1000 : 5000);
    };
    loop();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [refresh, active]);

  const enqueue = useCallback(
    async (items: QueueItem[], batchId?: string): Promise<QueueJob[]> => {
      const { jobs } = await json<{ jobs: QueueJob[] }>(
        await fetch("/api/queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items, batchId }),
        }),
      );
      // Show the new jobs immediately, then let the poll catch up.
      setSnap((s) => (s ? { ...s, jobs: [...s.jobs, ...jobs] } : s));
      refresh();
      return jobs;
    },
    [refresh],
  );

  const cancel = useCallback(
    async (id: string) => {
      await json(await fetch(`/api/queue/${id}`, { method: "DELETE" }));
      refresh();
    },
    [refresh],
  );

  const clearFinished = useCallback(async () => {
    apply(await json<QueueSnapshot>(await fetch("/api/queue", { method: "DELETE" })));
  }, [apply]);

  return { snap, enqueue, cancel, clearFinished, refresh };
}
