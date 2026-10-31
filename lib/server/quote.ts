import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ImageRecord, ImageTitle } from "../types";
import { getStyle } from "../styles";
import { chatJson } from "./enhance";
import { IMAGES_DIR, readLibrary } from "./store";

/** Titles aim for 3–10 words; anything over MAX_WORDS is sent back once for a shorter pick. */
const MAX_WORDS = 12;
/** How many tries a title gets to land on a line no other image uses. */
const ATTEMPTS = 4;
/** How many used lines are listed to the model, newest first. Every used line is still checked afterwards. */
const LISTED_LINES = 300;

/** Lines handed out but perhaps not saved yet, so parallel jobs can't pick the same one. Kept on globalThis like the queue. */
const g = globalThis as unknown as { __darkroomTitles?: Set<string> };
const claimed: Set<string> = (g.__darkroomTitles ??= new Set());

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/** The same line, ignoring case and punctuation, or one that is a shortened form of the other. */
const sameLine = (a: string, b: string) => a === b || a.includes(b) || b.includes(a);

/** Every title in the library, current and earlier, newest image first. */
async function usedLines() {
  const lines = (await readLibrary()).flatMap((r) => [r.title?.text ?? "", ...(r.pastTitles ?? [])]);
  return [...new Set(lines.filter(Boolean))];
}

const SYSTEM = `You give photographs a title: one short, concise, inspirational line that fits what the photo shows.
Look at the photo itself (and its description): who is in it, what they are doing, where, the light and the mood.
Then choose, in this order of preference:
1. The words of a famous person (kind "quote"; source is their full name, e.g. "Maya Angelou").
   Use this whenever a genuine, well-known quote truly fits the scene.
2. Otherwise, a Bible verse (kind "verse"; source is the reference, e.g. "Psalm 46:10").
Rules:
- The line must be uplifting: hope, courage, perseverance, dignity of work, love, gratitude, rest, faith, wonder.
  Never bleak, cynical or sarcastic, even when the photo is dark or melancholy; find the hope in it.
- It must connect to something concrete in the photo (the work being done, the place, the light, the people, the time of day).
  A generic motivational line that would fit any photo is wrong.
- Every photo gets its own line, never one already used. Draw on the whole range of famous people and the whole Bible,
  not only the most-quoted names and lines.
- Keep it short: ideally 3 to 10 words, never more than ${MAX_WORDS}. Prefer the shortest fitting line, like a caption,
  e.g. "Be still, and know that I am God" or "Well done is better than well said".
  For a longer verse, use one complete phrase of it that stands on its own, word for word (never reworded).
- Plain text, no quotation marks, no emoji.
- Use only wording you are certain is genuine and correctly attributed. Never invent, paraphrase or misattribute.
  If no famous quote fits with certainty, use a Bible verse you can quote exactly (a common English translation such as NIV, ESV or KJV).
Respond with JSON only: {"text":"...","source":"...","kind":"quote|verse"}`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["text", "source", "kind"],
  properties: {
    text: { type: "string" },
    source: { type: "string" },
    kind: { type: "string", enum: ["quote", "verse"] },
  },
};

function mimeOf(bytes: Buffer) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes.subarray(0, 4).toString("ascii") === "RIFF") return "image/webp";
  return "image/png";
}

/**
 * Writes a short inspirational title for an image: a famous person's quote when one fits,
 * otherwise a Bible verse. When `image` bytes are given, the model sees the photo itself;
 * if that request fails (a model without vision), it retries from the prompt alone.
 * The line is unique across the library: it is checked against every title in use and every line another job has
 * just claimed, and a repeat is sent back. Returns null on failure or if every try repeats a line, so a missing
 * title never blocks an image and a repeated one is never saved.
 */
export async function titleFor(
  prompt: string,
  styleName: string,
  { image, signal }: { image?: Buffer; signal?: AbortSignal } = {},
): Promise<ImageTitle | null> {
  const used = await usedLines().catch(() => [] as string[]);
  const takenInLibrary = used.map(norm);
  const rejected: string[] = [];
  const isTaken = (text: string) => {
    const line = norm(text);
    return takenInLibrary.some((t) => sameLine(t, line)) || [...claimed].some((t) => sameLine(t, line));
  };
  /** Takes the line if it is still free. Checking and claiming happen together, so parallel jobs can't both win. */
  const claim = (title: ImageTitle) => {
    if (isTaken(title.text)) return null;
    claimed.add(norm(title.text));
    return title;
  };
  const avoidLine = () => {
    const lines = [...rejected, ...used.slice(0, LISTED_LINES)];
    return lines.length
      ? `\nThese lines are already used on other photos. Choose a different line (a different person or verse), not any of these or a shortened form of them:\n${lines.map((t) => `- ${t}`).join("\n")}`
      : "";
  };
  const ask = (withImage: boolean, tooLong?: string) =>
    chatJson<{ text?: unknown; source?: unknown; kind?: unknown }>({
      system: SYSTEM,
      user: `${withImage ? "The photo is attached. " : ""}Description of the photo: ${prompt}\nVisual style: ${styleName}${avoidLine()}${
        tooLong ? `\nYour last pick was too long (${words(tooLong)} words): "${tooLong}". Choose a different, shorter line of at most ${MAX_WORDS} words.` : ""
      }`,
      name: "image_title",
      schema: SCHEMA,
      image: withImage && image ? `data:${mimeOf(image)};base64,${image.toString("base64")}` : undefined,
      signal,
    });

  let vision = Boolean(image);
  const pick = async (tooLong?: string): Promise<ImageTitle | null> => {
    let data: Awaited<ReturnType<typeof ask>>;
    try {
      data = await ask(vision, tooLong);
    } catch (err) {
      if (!vision || signal?.aborted) throw err;
      vision = false;
      data = await ask(false, tooLong);
    }
    const text = String(data.text ?? "")
      .trim()
      .replace(/^["“”'‘’]+|["“”'‘’]+$/g, "")
      .slice(0, 180);
    const source = String(data.source ?? "").trim().slice(0, 80);
    if (!text || !source) return null;
    return { text, source, kind: data.kind === "verse" ? "verse" : "quote" };
  };

  try {
    let tooLong: ImageTitle | null = null;
    for (let attempt = 0; attempt < ATTEMPTS && !signal?.aborted; attempt++) {
      const next = await pick(tooLong?.text);
      if (!next) continue;
      if (isTaken(next.text)) {
        rejected.unshift(next.text);
        continue;
      }
      if (words(next.text) <= MAX_WORDS) {
        const won = claim(next);
        if (won) return won;
        rejected.unshift(next.text);
        continue;
      }
      // Too long: ask once for a shorter line, and keep whichever of the two is shorter.
      if (tooLong) return claim(words(next.text) < words(tooLong.text) ? next : tooLong);
      tooLong = next;
    }
    return tooLong ? claim(tooLong) : null;
  } catch {
    return null;
  }
}

function words(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

/** How many earlier titles an image remembers. They stay off limits for every image, so "New quote" never brings one back. */
export const TITLE_MEMORY = 8;

/**
 * Titles a stored library image, sending its file so the line matches the photo.
 * Its current and earlier titles are in the library, so `titleFor` avoids them and a rewrite always changes.
 */
export async function titleForRecord(record: ImageRecord, signal?: AbortSignal) {
  const image = await readFile(join(IMAGES_DIR, record.file)).catch(() => undefined);
  return titleFor(record.prompt, getStyle(record.styleId).name, { image, signal });
}
