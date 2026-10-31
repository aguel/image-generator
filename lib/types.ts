import type { AspectId } from "./aspects";
import type { StyleId } from "./styles";

/** A short inspirational line shown as the image's title. */
export interface ImageTitle {
  text: string;
  /** Bible reference, person's name or proverb origin; empty for an original line. */
  source: string;
  kind: "verse" | "quote" | "proverb" | "original";
}

export interface ImageRecord {
  id: string;
  prompt: string;
  styleId: StyleId;
  aspect: AspectId;
  width: number;
  height: number;
  model: string;
  file: string;
  createdAt: string;
  title?: ImageTitle;
  /** Earlier title texts (newest first), kept so "New quote" never repeats one. */
  pastTitles?: string[];
}

export interface BackupSummary {
  id: string;
  createdAt: string;
  imageCount: number;
  bytes: number;
  label?: string;
}

export type QueueStatus = "queued" | "running" | "done" | "error" | "cancelled";

export interface QueueJob {
  id: string;
  batchId?: string;
  prompt: string;
  styleId: StyleId;
  aspect: AspectId;
  status: QueueStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  /** 1-based place in line while queued. */
  position?: number;
  image?: ImageRecord;
  error?: string;
}

export interface QueueSnapshot {
  concurrency: number;
  queueSize: number;
  running: number;
  queued: number;
  jobs: QueueJob[];
}

export interface EnhancedPrompt {
  title: string;
  prompt: string;
}
