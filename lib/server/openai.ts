import "server-only";
import type { AspectPreset } from "../aspects";

const ENDPOINT = "https://api.openai.com/v1/images/generations";

export class ImageApiError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

export function imageModel() {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1";
}

/** Generates a single image and returns its PNG bytes. */
export async function generateImage(prompt: string, aspect: AspectPreset, signal?: AbortSignal): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new ImageApiError("OPENAI_API_KEY is not configured on the server.", 500);

  const body: Record<string, unknown> = {
    model: imageModel(),
    prompt,
    n: 1,
    size: aspect.size,
  };
  const quality = process.env.OPENAI_IMAGE_QUALITY?.trim();
  if (quality) body.quality = quality;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  const json = (await res.json().catch(() => null)) as
    | { data?: { b64_json?: string; url?: string }[]; error?: { message?: string } }
    | null;

  if (!res.ok) {
    throw new ImageApiError(json?.error?.message ?? `OpenAI request failed (${res.status}).`, res.status);
  }

  const item = json?.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item?.url) {
    const img = await fetch(item.url, { signal });
    if (!img.ok) throw new ImageApiError("Could not download the generated image.", 502);
    return Buffer.from(await img.arrayBuffer());
  }
  throw new ImageApiError("OpenAI returned no image data.", 502);
}
