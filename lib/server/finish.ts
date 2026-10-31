import "server-only";
import sharp from "sharp";
import type { StylePreset } from "../styles";

/**
 * Post-processing applied to every generated image before it is saved:
 * 1. a light, style-tuned detail pass (luminance-only unsharp mask), and
 * 2. metadata removal, so no AI provenance (C2PA `caBX` / JUMBF content credentials),
 *    EXIF, XMP, text chunks, timestamps or other ancillary data survive.
 *
 * Image models render at ~1.5MP and tend to come back slightly soft at 100%; the
 * sharpen settings stay below the level that produces halos or crunch, and flat
 * areas (sky, skin, bokeh) are protected by the threshold (`m1`).
 */
const LEVELS = {
  /** Cinematic, Solitude: crisp micro-contrast. */
  crisp: { sigma: 0.9, m1: 0.6, m2: 2.4, x1: 2.2, y2: 12, y3: 18 },
  /** Most photographic styles. */
  natural: { sigma: 0.75, m1: 0.45, m2: 1.9, x1: 2.6, y2: 9, y3: 14 },
  /** Gentle: keeps a soft, photographic texture (Moonlight). */
  gentle: { sigma: 0.6, m1: 0.3, m2: 1.4, x1: 3, y2: 7, y3: 10 },
} as const;

export type FinishLevel = keyof typeof LEVELS | "none";

/** Returns the image sharpened for its style and stripped of all metadata, as PNG. */
export async function finishImage(bytes: Buffer, style: StylePreset): Promise<Buffer> {
  const level = style.finish ?? "natural";
  let out: Buffer;
  try {
    // sharp writes no metadata unless `.withMetadata()` / `.keepMetadata()` is called, and
    // re-encoding also converts any JPEG / WebP the API might return into PNG.
    const pipeline = sharp(bytes);
    if (level !== "none") pipeline.sharpen(LEVELS[level]);
    out = await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
  } catch {
    out = bytes;
  }
  // Belt and braces: drop every ancillary PNG chunk that is not needed to display the pixels.
  return stripPngMetadata(out);
}

/** Chunks kept: the image itself, its palette/transparency, and colour-accuracy chunks. */
const KEEP = new Set(["IHDR", "PLTE", "tRNS", "IDAT", "IEND", "sRGB", "gAMA", "cHRM"]);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Removes all metadata chunks from a PNG (tEXt / iTXt / zTXt, eXIf, caBX C2PA manifests,
 * tIME, pHYs, iCCP profile names, and any private chunk). Non-PNG input is returned unchanged.
 */
export function stripPngMetadata(png: Buffer): Buffer {
  if (png.length < 8 || !png.subarray(0, 8).equals(PNG_SIGNATURE)) return png;
  const parts: Buffer[] = [PNG_SIGNATURE];
  let i = 8;
  while (i + 12 <= png.length) {
    const length = png.readUInt32BE(i);
    const end = i + 12 + length;
    if (end > png.length) break;
    const type = png.toString("latin1", i + 4, i + 8);
    if (KEEP.has(type)) parts.push(png.subarray(i, end));
    i = end;
    if (type === "IEND") break;
  }
  return Buffer.concat(parts);
}
