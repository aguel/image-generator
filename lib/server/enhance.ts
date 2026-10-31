import "server-only";
import type { EnhancedPrompt } from "../types";
import { ImageApiError } from "./openai";

const ENDPOINT = "https://api.openai.com/v1/chat/completions";

export function completionModel() {
  return process.env.OPENAI_COMPLETION_MODEL?.trim() || "gpt-4.1-mini";
}

const SYSTEM = `You are a prompt writer for a photorealistic image generator.
Given a short idea, write distinct, vivid image prompts that each explore a different take on it:
vary the subject's age, action, setting, time of day, camera distance and story moment, while staying true to the idea.
Each prompt describes only the subject, action and environment in 1–3 sentences (30–70 words).
Do NOT mention camera models, lenses, film stocks, colour grading, lighting style or art style. A separate style preset adds those.
Never include text, logos, watermarks, real people's names or anything unsafe.
Respond with JSON only, matching: {"prompts":[{"title":"2–5 word title","prompt":"..."}]}`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["prompts"],
  properties: {
    prompts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "prompt"],
        properties: { title: { type: "string" }, prompt: { type: "string" } },
      },
    },
  },
} as const;

type Format = "json_schema" | "json_object";

async function call(apiKey: string, idea: string, count: number, format: Format, signal?: AbortSignal) {
  const response_format =
    format === "json_schema"
      ? { type: "json_schema", json_schema: { name: "image_prompts", strict: true, schema: SCHEMA } }
      : { type: "json_object" };
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: completionModel(),
      response_format,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Idea: ${idea}\nWrite exactly ${count} prompts.` },
      ],
    }),
    signal,
  });
  const json = (await res.json().catch(() => null)) as
    | { choices?: { message?: { content?: string | null; refusal?: string | null } }[]; error?: { message?: string } }
    | null;
  return { ok: res.ok, status: res.status, json };
}

function parse(content: string): EnhancedPrompt[] {
  // Tolerate code fences or stray text around the JSON object.
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  const data = JSON.parse(start >= 0 && end > start ? content.slice(start, end + 1) : content) as {
    prompts?: { title?: unknown; prompt?: unknown }[];
  };
  return (data.prompts ?? [])
    .map((p) => ({ title: String(p.title ?? "").trim().slice(0, 80), prompt: String(p.prompt ?? "").trim().slice(0, 4000) }))
    .filter((p) => p.prompt.length > 0)
    .map((p) => ({ ...p, title: p.title || p.prompt.split(/\s+/).slice(0, 4).join(" ") }));
}

/** Expands one idea into `count` image prompts using OPENAI_COMPLETION_MODEL, returned as structured JSON. */
export async function enhancePrompt(idea: string, count: number, signal?: AbortSignal): Promise<EnhancedPrompt[]> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new ImageApiError("OPENAI_API_KEY is not configured on the server.", 500);

  let result = await call(apiKey, idea, count, "json_schema", signal);
  // Some models don't support strict JSON schemas; fall back to plain JSON mode.
  if (!result.ok && result.status === 400) result = await call(apiKey, idea, count, "json_object", signal);
  if (!result.ok) {
    throw new ImageApiError(result.json?.error?.message ?? `OpenAI request failed (${result.status}).`, result.status);
  }

  const message = result.json?.choices?.[0]?.message;
  if (message?.refusal) throw new ImageApiError(message.refusal, 422);
  try {
    const prompts = parse(message?.content ?? "");
    if (!prompts.length) throw new Error("empty");
    return prompts.slice(0, count);
  } catch {
    throw new ImageApiError("The model did not return usable prompts. Try again or rephrase the idea.", 502);
  }
}
