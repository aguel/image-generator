#!/usr/bin/env node
// Generates every favicon asset from one aperture SVG:
//   app/icon.svg            – modern browsers (Chrome, Firefox, Safari 26+)
//   app/favicon.ico         – 16/32/48 multi-size ICO (Safari, legacy, bookmarks)
//   app/apple-icon.png      – 180×180 apple-touch-icon (Safari / iOS home screen)
//   public/icon-192.png, public/icon-512.png – web manifest icons
// Run with: npm run icons
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function apertureSvg({ rounded = true } = {}) {
  const c = 32;
  const R = 21; // outer ring
  const a = 7.5; // hexagon apothem (aperture opening)
  const rv = a / Math.cos(Math.PI / 6);
  const verts = Array.from({ length: 6 }, (_, i) => {
    const t = (Math.PI / 3) * i - Math.PI / 2;
    return [c + rv * Math.cos(t), c + rv * Math.sin(t)];
  });
  // Extend each hexagon edge until it meets the outer ring → classic iris blades.
  const blades = verts.map(([x1, y1], i) => {
    const [x2, y2] = verts[(i + 1) % 6];
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;
    const fx = x1 - c, fy = y1 - c;
    const b = fx * ux + fy * uy;
    const cc = fx * fx + fy * fy - R * R;
    const t = -b + Math.sqrt(b * b - cc);
    return `M${x1.toFixed(2)} ${y1.toFixed(2)}L${(x1 + ux * t).toFixed(2)} ${(y1 + uy * t).toFixed(2)}`;
  });
  const hex = verts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join("") + "Z";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <radialGradient id="g" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffd9a6"/>
      <stop offset="45%" stop-color="#e8a050"/>
      <stop offset="100%" stop-color="#e8a050" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a1613"/>
      <stop offset="100%" stop-color="#0a0908"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="${rounded ? 14 : 0}" fill="url(#bg)"/>
  <circle cx="32" cy="32" r="${R}" fill="#16120f"/>
  <circle cx="32" cy="32" r="14" fill="url(#g)" opacity="0.55"/>
  <path d="${hex}" fill="#ffc27a"/>
  <path d="${blades.join("")}" stroke="#e8a050" stroke-width="2" stroke-linecap="round" fill="none"/>
  <circle cx="32" cy="32" r="${R}" fill="none" stroke="#e8a050" stroke-width="2.6"/>
</svg>
`;
}

function ico(pngs) {
  // ICO container with embedded PNG frames (supported by every modern browser incl. Safari).
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + dir.length;
  pngs.forEach(({ size, buf }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(buf.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += buf.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.buf)]);
}

const svg = apertureSvg();
const square = apertureSvg({ rounded: false }); // iOS applies its own mask
const render = (src, size) => sharp(Buffer.from(src), { density: 72 * (size / 64) * 2 }).resize(size, size).png().toBuffer();

await writeFile(resolve(root, "app/icon.svg"), svg);
const icoFrames = await Promise.all([16, 32, 48].map(async (size) => ({ size, buf: await render(svg, size) })));
await writeFile(resolve(root, "app/favicon.ico"), ico(icoFrames));
await writeFile(resolve(root, "app/apple-icon.png"), await render(square, 180));
await writeFile(resolve(root, "public/icon-192.png"), await render(svg, 192));
await writeFile(resolve(root, "public/icon-512.png"), await render(svg, 512));
console.log("✓ icons written: app/icon.svg, app/favicon.ico, app/apple-icon.png, public/icon-{192,512}.png");
