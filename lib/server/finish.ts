import "server-only";
import sharp from "sharp";
import type { StylePreset } from "../styles";

/**
 * Post-processing applied to every generated image before it is saved:
 * 1. a light, style-tuned detail pass (luminance-only unsharp mask), and
 * 2. metadata removal, so no embedded provenance (C2PA `caBX` / JUMBF content credentials),
 *    EXIF, XMP, text chunks, timestamps or other ancillary data survive.
 * Pixel-level watermarks and visible logos are not removed by metadata stripping.
 *
 * Image models render at ~1.5MP and tend to come back slightly soft at 100%; the
 * sharpen settings stay below the level that produces halos or crunch, and flat
 * areas (sky, skin, bokeh) are protected by the threshold (`m1`).
 */
const LEVELS = {
  /** Portrait: ultra-sharp facial contours. Tight radius, so edges gain definition without wide halos. */
  ultra: { sigma: 0.8, m1: 0.9, m2: 3.2, x1: 1.8, y2: 14, y3: 22 },
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
  // Never fall back to the original bytes: a failed conversion must fail the job,
  // rather than saving an unchecked image with its original metadata.
  const pipeline = sharp(bytes);
  if (level !== "none") pipeline.sharpen(LEVELS[level]);
  const out = await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
  // Belt and braces: drop every ancillary PNG chunk that is not needed to display the pixels.
  return stripPngMetadata(out);
}

/** Cleans legacy/restored files on delivery without applying the style's sharpening again. */
export async function cleanImageMetadata(bytes: Buffer): Promise<Buffer> {
  // PNG chunk removal is lossless and avoids recompressing already-finished images.
  if (bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return stripPngMetadata(bytes);
  const png = await sharp(bytes).autoOrient().png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
  return stripPngMetadata(png);
}

/** Chunks kept: the image itself, its palette/transparency, and colour-accuracy chunks. */
const KEEP = new Set(["IHDR", "PLTE", "tRNS", "IDAT", "IEND", "sRGB", "gAMA", "cHRM"]);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Removes all metadata chunks from a PNG (tEXt / iTXt / zTXt, eXIf, caBX C2PA manifests,
 * tIME, pHYs, iCCP profile names, and any private chunk). Reject invalid chunk framing
 * rather than returning unchecked or partial bytes; image decoding belongs to sharp.
 */
export function stripPngMetadata(png: Buffer): Buffer {
  if (png.length < 8 || !png.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("Metadata removal requires a PNG image.");
  }
  const parts: Buffer[] = [PNG_SIGNATURE];
  let i = 8;
  let hasImageData = false;
  while (i + 12 <= png.length) {
    const length = png.readUInt32BE(i);
    const end = i + 12 + length;
    if (end > png.length) throw new Error("Cannot strip metadata from a truncated PNG.");
    const type = png.toString("latin1", i + 4, i + 8);
    if (i === 8 ? type !== "IHDR" || length !== 13 : type === "IHDR") {
      throw new Error("Cannot strip metadata from a PNG with an invalid header.");
    }
    if (type === "IDAT") hasImageData = true;
    if (KEEP.has(type)) parts.push(png.subarray(i, end));
    i = end;
    if (type === "IEND") {
      if (length !== 0 || !hasImageData) throw new Error("Cannot strip metadata from an incomplete PNG.");
      // Discard anything appended after the image, including metadata trailers.
      return Buffer.concat(parts);
    }
  }
  throw new Error("Cannot strip metadata from a PNG without an end marker.");
}
