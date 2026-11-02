import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import sharp from "sharp";
import { cleanImageMetadata, finishImage, stripPngMetadata } from "./finish.ts";

const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const allowed = new Set(["IHDR", "PLTE", "tRNS", "IDAT", "IEND", "sRGB", "gAMA", "cHRM"]);

function chunk(type, data = Buffer.alloc(0)) {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  let crc = 0xffffffff;
  for (const byte of body) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, body, checksum]);
}

function chunks(png) {
  assert.deepEqual(png.subarray(0, 8), signature);
  const result = [];
  for (let offset = 8; offset < png.length;) {
    const end = offset + 12 + png.readUInt32BE(offset);
    assert.ok(end <= png.length);
    result.push({ type: png.toString("ascii", offset + 4, offset + 8), bytes: png.subarray(offset, end) });
    offset = end;
  }
  assert.equal(result.at(-1)?.type, "IEND");
  return result;
}

async function fixture() {
  return sharp({
    create: { width: 24, height: 16, channels: 4, background: { r: 30, g: 80, b: 140, alpha: 0.5 } },
  }).png().toBuffer();
}

test("strips embedded provenance, ancillary chunks and trailers without changing pixels", async () => {
  const original = await fixture();
  const originalChunks = chunks(original);
  const metadata = [
    chunk("tEXt", Buffer.from("Software\0AI generator")),
    chunk("iTXt", Buffer.from("XML:com.adobe.xmp\0\0\0\0\0<xmp>AI provenance</xmp>")),
    chunk("zTXt", Buffer.from("Comment\0\0metadata")),
    chunk("eXIf", Buffer.from("Exif metadata")),
    chunk("caBX", Buffer.from("C2PA JUMBF manifest")),
    chunk("tIME", Buffer.alloc(7)),
    chunk("pHYs", Buffer.alloc(9)),
    chunk("iCCP", Buffer.from("AI profile\0\0metadata")),
    chunk("prIv", Buffer.from("Private AI metadata")),
  ];
  const input = Buffer.concat([
    signature,
    originalChunks[0].bytes,
    ...metadata,
    ...originalChunks.slice(1).map(({ bytes }) => bytes),
    Buffer.from("Appended AI provenance"),
  ]);
  const output = stripPngMetadata(input);
  const expected = Buffer.concat([
    signature,
    ...originalChunks.filter(({ type }) => allowed.has(type)).map(({ bytes }) => bytes),
  ]);
  assert.deepEqual(output, expected);
  assert.deepEqual(await cleanImageMetadata(input), expected);
  assert.deepEqual(await sharp(output).raw().toBuffer(), await sharp(original).raw().toBuffer());
  assert.deepEqual(stripPngMetadata(output), output);
});

test("preserves palette, transparency and colour chunks", () => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 3;
  const png = Buffer.concat([
    signature,
    chunk("IHDR", header),
    chunk("sRGB", Buffer.from([0])),
    chunk("gAMA", Buffer.from([0, 0, 177, 143])),
    chunk("cHRM", Buffer.alloc(32)),
    chunk("PLTE", Buffer.from([30, 80, 140])),
    chunk("tRNS", Buffer.from([128])),
    chunk("IDAT"),
    chunk("IEND"),
  ]);
  assert.deepEqual(stripPngMetadata(png), png);
});

test("rejects non-PNG, truncated and incomplete images instead of returning unchecked bytes", async () => {
  const png = await fixture();
  const parts = chunks(png);
  for (const input of [
    Buffer.from("not an image"),
    signature,
    png.subarray(0, png.length - 1),
    png.subarray(0, png.length - 12),
    Buffer.concat([signature, chunk("IEND")]),
    Buffer.concat([signature, parts[0].bytes, chunk("IEND")]),
    Buffer.concat([signature, parts[0].bytes, ...parts.map(({ bytes }) => bytes)]),
    Buffer.concat([png.subarray(0, png.length - 12), chunk("IEND", Buffer.from([1]))]),
  ]) {
    assert.throws(() => stripPngMetadata(input), /PNG/);
  }
  const oversized = Buffer.from(png);
  oversized.writeUInt32BE(0xffffffff, 8);
  assert.throws(() => stripPngMetadata(oversized), /truncated PNG/);
  await assert.rejects(finishImage(Buffer.from("not an image"), { finish: "none" }));
  await assert.rejects(finishImage(png.subarray(0, 40), { finish: "natural" }));
  await assert.rejects(cleanImageMetadata(Buffer.from("not an image")));
  await assert.rejects(cleanImageMetadata(png.subarray(0, png.length - 1)));
});

test("all finish levels produce metadata-free PNGs", async () => {
  const original = await fixture();
  for (const finish of ["none", "gentle", "natural", "crisp", "ultra", undefined]) {
    const output = await finishImage(original, { finish });
    assert.deepEqual(await cleanImageMetadata(output), output);
    assert.ok(chunks(output).every(({ type }) => allowed.has(type)));
    const info = await sharp(output).metadata();
    assert.equal(info.format, "png");
    assert.equal(info.width, 24);
    assert.equal(info.height, 16);
    assert.equal(info.hasAlpha, true);
    if (finish === "none") {
      assert.deepEqual(await sharp(output).raw().toBuffer(), await sharp(original).raw().toBuffer());
    }
  }
});

test("converts PNG, JPEG and WebP with EXIF, XMP and ICC metadata into clean PNGs", async () => {
  const original = await fixture();
  for (const format of ["png", "jpeg", "webp"]) {
    const input = await sharp(original)
      .withMetadata()
      .withExif({ IFD0: { Software: "AI image generator", Artist: "AI model" } })
      .withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/">AI provenance</x:xmpmeta>')
      .toFormat(format)
      .toBuffer();
    const before = await sharp(input).metadata();
    assert.ok(before.exif);
    assert.ok(before.xmp);
    assert.ok(before.icc);
    for (const output of [await finishImage(input, { finish: "none" }), await cleanImageMetadata(input)]) {
      assert.ok(chunks(output).every(({ type }) => allowed.has(type)));
      const after = await sharp(output).metadata();
      assert.equal(after.format, "png");
      assert.equal(after.exif, undefined);
      assert.equal(after.xmp, undefined);
      assert.equal(after.icc, undefined);
      assert.equal(after.width, 24);
      assert.equal(after.height, 16);
    }
  }
});

test("delivery conversion preserves the display orientation when removing EXIF from legacy JPEGs", async () => {
  const input = await sharp(await fixture()).withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const output = await cleanImageMetadata(input);
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.width, 16);
  assert.equal(metadata.height, 24);
  assert.equal(metadata.orientation, undefined);
  assert.equal(metadata.exif, undefined);
  assert.deepEqual(await sharp(output).raw().toBuffer(), await sharp(input).autoOrient().raw().toBuffer());
});

test("library cleanup backs up original files and removes provenance without changing pixels", async () => {
  const root = await mkdtemp(join(tmpdir(), "darkroom-metadata-"));
  const images = join(root, "data", "images");
  const command = [
    "--conditions=react-server", "--experimental-strip-types",
    fileURLToPath(new URL("../../scripts/image-metadata.mjs", import.meta.url)),
  ];
  const run = promisify(execFile);
  try {
    await mkdir(images, { recursive: true });
    const clean = stripPngMetadata(await fixture());
    const original = Buffer.concat([
      clean.subarray(0, 33), chunk("caBX", Buffer.from("C2PA AI provenance")), clean.subarray(33),
    ]);
    const library = JSON.stringify([{ id: "old", file: "old.png" }, { id: "clean", file: "clean.png" }]);
    await writeFile(join(root, "data", "library.json"), library);
    await writeFile(join(images, "old.png"), original);
    await writeFile(join(images, "clean.png"), clean);

    await assert.rejects(run(process.execPath, command, { cwd: root }), (error) => {
      assert.equal(error.code, 1);
      const report = JSON.parse(error.stdout);
      assert.equal(report.checked, 2);
      assert.equal(report.pngChunks.caBX, 1);
      assert.equal(report.needsCleanup.length, 1);
      return true;
    });
    assert.deepEqual(await readFile(join(images, "old.png")), original);

    const { stdout } = await run(process.execPath, [...command, "--clean"], { cwd: root });
    const report = JSON.parse(stdout);
    assert.equal(report.cleaned, 1);
    const snapshot = join(root, "data", "backups", report.backupId);
    assert.deepEqual(await readFile(join(snapshot, "images", "old.png")), original);
    assert.equal(await readFile(join(snapshot, "library.json"), "utf8"), library);
    assert.equal(JSON.parse(await readFile(join(snapshot, "manifest.json"), "utf8")).imageCount, 2);
    assert.deepEqual(await readFile(join(images, "old.png")), clean);
    assert.deepEqual(await readFile(join(images, "clean.png")), clean);
    assert.equal(await readFile(join(root, "data", "library.json"), "utf8"), library);

    const second = JSON.parse((await run(process.execPath, [...command, "--clean"], { cwd: root })).stdout);
    assert.equal(second.cleaned, 0);
    assert.equal(second.clean, 2);
    assert.equal(second.pngChunks.caBX, undefined);
    assert.equal((await readdir(join(root, "data", "backups"))).length, 1);

    await writeFile(join(images, "broken.png"), Buffer.from("corrupt"));
    await assert.rejects(run(process.execPath, [...command, "--clean"], { cwd: root }), (error) => {
      assert.equal(error.code, 1);
      assert.equal(JSON.parse(error.stdout).invalid.length, 1);
      return true;
    });
    assert.equal((await readdir(join(root, "data", "backups"))).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
