import "server-only";
import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { ImageRecord } from "../types";

export const DATA_DIR = join(process.cwd(), "data");
export const IMAGES_DIR = join(DATA_DIR, "images");
export const BACKUPS_DIR = join(DATA_DIR, "backups");
const LIBRARY_FILE = join(DATA_DIR, "library.json");

// Serialises library mutations so parallel generations never clobber each other.
let queue: Promise<unknown> = Promise.resolve();
export function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

export async function ensureDirs() {
  await mkdir(IMAGES_DIR, { recursive: true });
  await mkdir(BACKUPS_DIR, { recursive: true });
}

export async function readLibrary(): Promise<ImageRecord[]> {
  try {
    return JSON.parse(await readFile(LIBRARY_FILE, "utf8")) as ImageRecord[];
  } catch {
    return [];
  }
}

export async function writeLibrary(records: ImageRecord[]) {
  await ensureDirs();
  const tmp = `${LIBRARY_FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(records, null, 2));
  await rename(tmp, LIBRARY_FILE);
}

export async function addImage(record: ImageRecord, bytes: Buffer) {
  await ensureDirs();
  await writeFile(join(IMAGES_DIR, record.file), bytes);
  return withLock(async () => {
    const lib = await readLibrary();
    lib.unshift(record);
    await writeLibrary(lib);
    return record;
  });
}

export async function removeImage(id: string) {
  return withLock(async () => {
    const lib = await readLibrary();
    const record = lib.find((r) => r.id === id);
    if (!record) return false;
    await writeLibrary(lib.filter((r) => r.id !== id));
    await unlink(join(IMAGES_DIR, record.file)).catch(() => undefined);
    return true;
  });
}

/** Merges `patch` into one library record. Returns the updated record, or null if it doesn't exist. */
export async function updateImage(id: string, patch: Partial<Omit<ImageRecord, "id" | "file">>) {
  return withLock(async () => {
    const lib = await readLibrary();
    const i = lib.findIndex((r) => r.id === id);
    if (i < 0) return null;
    lib[i] = { ...lib[i], ...patch };
    await writeLibrary(lib);
    return lib[i];
  });
}

export function isSafeId(id: string) {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}
