import "server-only";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { BackupSummary } from "../types";
import { BACKUPS_DIR, IMAGES_DIR, ensureDirs, readLibrary, withLock, writeLibrary, isSafeId } from "./store";

// Snapshot layout: data/backups/<id>/{manifest.json, library.json, images/*}

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = join(dir, entry.name);
    total += entry.isDirectory() ? await dirSize(p) : (await stat(p)).size;
  }
  return total;
}

function backupDir(id: string) {
  if (!isSafeId(id)) throw new Error("Invalid backup id");
  return join(BACKUPS_DIR, id);
}

export async function listBackups(): Promise<BackupSummary[]> {
  await ensureDirs();
  const out: BackupSummary[] = [];
  for (const entry of await readdir(BACKUPS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      out.push(JSON.parse(await readFile(join(BACKUPS_DIR, entry.name, "manifest.json"), "utf8")));
    } catch {
      /* skip incomplete snapshots */
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getBackup(id: string): Promise<BackupSummary | null> {
  try {
    return JSON.parse(await readFile(join(backupDir(id), "manifest.json"), "utf8"));
  } catch {
    return null;
  }
}

export async function createBackup(label?: string): Promise<BackupSummary> {
  return withLock(async () => {
    await ensureDirs();
    const createdAt = new Date().toISOString();
    const id = `${createdAt.replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomUUID().slice(0, 6)}`;
    const dir = backupDir(id);
    await mkdir(join(dir, "images"), { recursive: true });
    const library = await readLibrary();
    await writeFile(join(dir, "library.json"), JSON.stringify(library, null, 2));
    for (const r of library) {
      await cp(join(IMAGES_DIR, r.file), join(dir, "images", r.file)).catch(() => undefined);
    }
    const manifest: BackupSummary = {
      id,
      createdAt,
      imageCount: library.length,
      bytes: await dirSize(dir),
      ...(label ? { label: label.slice(0, 80) } : {}),
    };
    await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
    return manifest;
  });
}

/** Replaces the live library with the snapshot. Images not in the snapshot are kept on disk but unlisted. */
export async function restoreBackup(id: string): Promise<BackupSummary | null> {
  const manifest = await getBackup(id);
  if (!manifest) return null;
  return withLock(async () => {
    const dir = backupDir(id);
    const library = JSON.parse(await readFile(join(dir, "library.json"), "utf8"));
    await mkdir(IMAGES_DIR, { recursive: true });
    await cp(join(dir, "images"), IMAGES_DIR, { recursive: true, force: true });
    await writeLibrary(library);
    return manifest;
  });
}

export async function deleteBackup(id: string): Promise<boolean> {
  if (!(await getBackup(id))) return false;
  await rm(backupDir(id), { recursive: true, force: true });
  return true;
}
