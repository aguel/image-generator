import { randomUUID } from "node:crypto";
import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { cleanImageMetadata, stripPngMetadata } from "../lib/server/finish.ts";

// Structural audit by default; --clean creates a restorable snapshot before changing files.
// Neither mode runs an AI classifier or detects pixel watermarks.
const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--clean")) throw new Error("Usage: image-metadata.mjs [--clean]");
const apply = args.includes("--clean");
const dataDirectory = join(process.cwd(), "data");
const directory = join(dataDirectory, "images");
const entries = await readdir(directory, { withFileTypes: true });
const report = {
  checked: 0,
  clean: 0,
  needsCleanup: [],
  invalid: [],
  pngChunks: {},
  pixelWatermarks: "not checked",
  aiClassification: "not checked",
};

for (const entry of entries) {
  if (!entry.isFile() || !/\.(png|jpe?g|webp)$/i.test(entry.name)) continue;
  report.checked++;
  try {
    const bytes = await readFile(join(directory, entry.name));
    const metadata = await sharp(bytes).metadata();
    // Decode to ensure that a seemingly clean PNG is also a readable image.
    await sharp(bytes).raw().toBuffer();
    if (metadata.format !== "png") {
      report.needsCleanup.push({ file: entry.name, reason: "Non-PNG file requires conversion before delivery" });
    } else {
      const cleaned = stripPngMetadata(bytes);
      for (let offset = 8; offset + 12 <= bytes.length;) {
        const type = bytes.toString("ascii", offset + 4, offset + 8);
        report.pngChunks[type] = (report.pngChunks[type] ?? 0) + 1;
        offset += 12 + bytes.readUInt32BE(offset);
        if (type === "IEND") break;
      }
      if (!cleaned.equals(bytes)) {
        report.needsCleanup.push({ file: entry.name, reason: "Ancillary chunks or trailing bytes present" });
      } else {
        report.clean++;
      }
    }
  } catch (error) {
    report.invalid.push({ file: entry.name, error: error instanceof Error ? error.message : "Unreadable image" });
  }
}

let backupId;
let cleaned = 0;
if (apply && report.needsCleanup.length && !report.invalid.length) {
  const createdAt = new Date().toISOString();
  backupId = `${createdAt.replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomUUID().slice(0, 6)}`;
  const snapshot = join(dataDirectory, "backups", backupId);
  const library = await readFile(join(dataDirectory, "library.json"));
  const records = JSON.parse(library.toString("utf8"));
  if (!Array.isArray(records)) throw new Error("Invalid library; no images were modified.");
  await mkdir(snapshot, { recursive: true });
  await writeFile(join(snapshot, "library.json"), library, { flag: "wx" });
  await cp(directory, join(snapshot, "images"), { recursive: true, force: false, errorOnExist: true });
  let bytes = library.length;
  for (const entry of await readdir(join(snapshot, "images"), { withFileTypes: true })) {
    if (entry.isFile()) bytes += (await stat(join(snapshot, "images", entry.name))).size;
  }
  await writeFile(join(snapshot, "manifest.json"), JSON.stringify({
    id: backupId,
    createdAt,
    imageCount: records.length,
    bytes,
    label: "Before image metadata cleanup",
  }, null, 2), { flag: "wx" });

  for (const { file } of report.needsCleanup) {
    const path = join(directory, file);
    const original = await readFile(path);
    const output = await cleanImageMetadata(original);
    // PNG cleanup must preserve the decoded pixels exactly, not merely their dimensions.
    if ((await sharp(original).metadata()).format === "png") {
      const before = await sharp(original).raw().toBuffer();
      const after = await sharp(output).raw().toBuffer();
      if (!before.equals(after)) throw new Error(`Pixel verification failed for ${file}; original retained.`);
    }
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, output, { flag: "wx" });
      await rename(temporary, path);
    } finally {
      await rm(temporary, { force: true });
    }
    cleaned++;
  }
}

console.log(JSON.stringify({ ...report, ...(apply ? { cleaned, backupId } : {}) }, null, 2));
if (report.invalid.length || (!apply && report.needsCleanup.length)) process.exitCode = 1;
