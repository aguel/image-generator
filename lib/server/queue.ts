import "server-only";
import { randomUUID } from "node:crypto";
import { getAspect, type AspectId } from "../aspects";
import { getStyle, type StyleId } from "../styles";
import type { ImageRecord, QueueJob, QueueSnapshot } from "../types";
import { addImage } from "./store";
import { generateImage, imageModel } from "./openai";

/**
 * In-memory generation queue.
 * - GENERATION_CONCURRENCY: how many images are generated at the same time (default 2).
 * - GENERATION_QUEUE_SIZE: how many jobs may wait in line, not counting running ones (default 20).
 * State lives on globalThis so dev hot-reloads don't spawn a second queue.
 */

interface Internal extends QueueJob {
  controller?: AbortController;
  waiters: ((job: QueueJob) => void)[];
}

interface QueueState {
  jobs: Map<string, Internal>;
  order: string[];
}

const KEEP_FINISHED = 200;
const g = globalThis as unknown as { __darkroomQueue?: QueueState };
const state: QueueState = (g.__darkroomQueue ??= { jobs: new Map(), order: [] });

function intEnv(name: string, fallback: number, min: number, max: number) {
  const n = Number.parseInt(process.env[name]?.trim() ?? "", 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export function limits() {
  return {
    concurrency: intEnv("GENERATION_CONCURRENCY", 2, 1, 32),
    queueSize: intEnv("GENERATION_QUEUE_SIZE", 20, 1, 1000),
  };
}

function publicJob(j: Internal): QueueJob {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { controller, waiters, ...rest } = j;
  return rest;
}

function counts() {
  let running = 0;
  let queued = 0;
  for (const j of state.jobs.values()) {
    if (j.status === "running") running++;
    else if (j.status === "queued") queued++;
  }
  return { running, queued };
}

function prune() {
  const finished = state.order.filter((id) => {
    const s = state.jobs.get(id)?.status;
    return s === "done" || s === "error" || s === "cancelled";
  });
  for (const id of finished.slice(0, Math.max(0, finished.length - KEEP_FINISHED))) {
    state.jobs.delete(id);
  }
  state.order = state.order.filter((id) => state.jobs.has(id));
}

function settle(job: Internal) {
  const snapshot = publicJob(job);
  job.waiters.splice(0).forEach((resolve) => resolve(snapshot));
}

async function run(job: Internal) {
  job.status = "running";
  job.startedAt = new Date().toISOString();
  job.controller = new AbortController();
  try {
    const aspect = getAspect(job.aspect);
    const style = getStyle(job.styleId);
    const bytes = await generateImage(style.build(job.prompt), aspect, job.controller.signal);
    // Cancelled while the request was in flight: drop the result.
    if (job.status !== "running") return;
    const id = randomUUID().replace(/-/g, "").slice(0, 16);
    const record: ImageRecord = {
      id,
      prompt: job.prompt,
      styleId: style.id,
      aspect: aspect.id,
      width: aspect.width,
      height: aspect.height,
      model: imageModel(),
      file: `${id}.png`,
      createdAt: new Date().toISOString(),
    };
    await addImage(record, bytes);
    if (job.status === "running") {
      job.status = "done";
      job.image = record;
    }
  } catch (err) {
    if (job.status === "running") {
      job.status = "error";
      job.error = err instanceof Error ? err.message : "Generation failed.";
    }
  } finally {
    job.finishedAt = new Date().toISOString();
    job.controller = undefined;
    settle(job);
    pump();
  }
}

/** Starts queued jobs (oldest first) until the concurrency limit is reached. */
function pump() {
  const { concurrency } = limits();
  let { running } = counts();
  for (const id of state.order) {
    if (running >= concurrency) break;
    const job = state.jobs.get(id);
    if (job?.status === "queued") {
      running++;
      void run(job);
    }
  }
  prune();
}

export class QueueFullError extends Error {
  constructor(public room: number, public queueSize: number) {
    super(
      room <= 0
        ? `The queue is full (${queueSize} waiting). Wait for some images to finish, or cancel queued ones.`
        : `Only ${room} more ${room === 1 ? "image fits" : "images fit"} right now (${queueSize} can wait in line).`,
    );
  }
}

export interface EnqueueItem {
  prompt: string;
  styleId: string;
  aspect: string;
}

/** Adds jobs atomically: either all fit in the waiting line, or none are added. */
export function enqueue(items: EnqueueItem[], batchId?: string): QueueJob[] {
  const { concurrency, queueSize } = limits();
  const { running, queued } = counts();
  // Jobs that can start immediately never occupy a waiting slot.
  const freeWorkers = Math.max(0, concurrency - running);
  const room = queueSize - queued + freeWorkers;
  if (items.length > room) throw new QueueFullError(Math.max(0, room), queueSize);

  const now = new Date().toISOString();
  const created = items.map((item) => {
    const job: Internal = {
      id: randomUUID().replace(/-/g, "").slice(0, 16),
      batchId,
      prompt: item.prompt.trim(),
      styleId: getStyle(item.styleId).id as StyleId,
      aspect: getAspect(item.aspect).id as AspectId,
      status: "queued",
      createdAt: now,
      waiters: [],
    };
    state.jobs.set(job.id, job);
    state.order.push(job.id);
    return job;
  });
  pump();
  return created.map(publicJob);
}

/** Resolves when the job finishes (done, error or cancelled). */
export function waitFor(id: string): Promise<QueueJob | null> {
  const job = state.jobs.get(id);
  if (!job) return Promise.resolve(null);
  if (job.status !== "queued" && job.status !== "running") return Promise.resolve(publicJob(job));
  return new Promise((resolve) => job.waiters.push(resolve));
}

export function cancel(id: string): QueueJob | null {
  const job = state.jobs.get(id);
  if (!job) return null;
  if (job.status === "queued" || job.status === "running") {
    const wasRunning = job.status === "running";
    job.status = "cancelled";
    job.finishedAt = new Date().toISOString();
    job.controller?.abort();
    if (!wasRunning) settle(job);
    pump();
  }
  return publicJob(job);
}

export function clearFinished() {
  for (const id of state.order) {
    const s = state.jobs.get(id)?.status;
    if (s === "done" || s === "error" || s === "cancelled") state.jobs.delete(id);
  }
  state.order = state.order.filter((id) => state.jobs.has(id));
}

export function snapshot(): QueueSnapshot {
  const { concurrency, queueSize } = limits();
  const { running, queued } = counts();
  const jobs = state.order.map((id) => publicJob(state.jobs.get(id)!));
  // Position in line for queued jobs (1 = next to start).
  let pos = 0;
  for (const j of jobs) if (j.status === "queued") j.position = ++pos;
  return { concurrency, queueSize, running, queued, jobs };
}
