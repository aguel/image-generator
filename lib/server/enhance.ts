import "server-only";
import type { EnhancedPrompt } from "../types";
import { ImageApiError } from "./openai";

const ENDPOINT = "https://api.openai.com/v1/chat/completions";

export function completionModel() {
  return process.env.OPENAI_COMPLETION_MODEL?.trim() || "gpt-4.1-mini";
}

type Format = "json_schema" | "json_object";

/**
 * Calls OPENAI_COMPLETION_MODEL and returns its reply parsed as JSON.
 * Uses a strict `json_schema` response format, falls back to `json_object` on a 400
 * (models without strict-schema support), and tolerates stray text around the JSON.
 */
export async function chatJson<T>({
  system,
  user,
  name,
  schema,
  image,
  signal,
}: {
  system: string;
  user: string;
  name: string;
  schema: Record<string, unknown>;
  /** Optional image (a data: or https URL) sent alongside the text, for vision-capable models. */
  image?: string;
  signal?: AbortSignal;
}): Promise<T> {
  const userContent = image
    ? [
        { type: "text", text: user },
        { type: "image_url", image_url: { url: image, detail: "low" } },
      ]
    : user;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new ImageApiError("OPENAI_API_KEY is not configured on the server.", 500);

  const call = async (format: Format) => {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: completionModel(),
        response_format: format === "json_schema" ? { type: "json_schema", json_schema: { name, strict: true, schema } } : { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
      }),
      signal,
    });
    const json = (await res.json().catch(() => null)) as
      | { choices?: { message?: { content?: string | null; refusal?: string | null } }[]; error?: { message?: string } }
      | null;
    return { ok: res.ok, status: res.status, json };
  };

  let result = await call("json_schema");
  if (!result.ok && result.status === 400) result = await call("json_object");
  if (!result.ok) {
    throw new ImageApiError(result.json?.error?.message ?? `OpenAI request failed (${result.status}).`, result.status);
  }
  const message = result.json?.choices?.[0]?.message;
  if (message?.refusal) throw new ImageApiError(message.refusal, 422);
  const content = message?.content ?? "";
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  try {
    return JSON.parse(start >= 0 && end > start ? content.slice(start, end + 1) : content) as T;
  } catch {
    throw new ImageApiError("The model did not return valid JSON.", 502);
  }
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
};

/** Expands one idea into `count` image prompts using OPENAI_COMPLETION_MODEL, returned as structured JSON. */
export async function enhancePrompt(idea: string, count: number, signal?: AbortSignal): Promise<EnhancedPrompt[]> {
  const data = await chatJson<{ prompts?: { title?: unknown; prompt?: unknown }[] }>({
    system: SYSTEM,
    user: `Idea: ${idea}\nWrite exactly ${count} prompts.`,
    name: "image_prompts",
    schema: SCHEMA,
    signal,
  });
  const prompts = (data.prompts ?? [])
    .map((p) => ({ title: String(p.title ?? "").trim().slice(0, 80), prompt: String(p.prompt ?? "").trim().slice(0, 4000) }))
    .filter((p) => p.prompt.length > 0)
    .map((p) => ({ ...p, title: p.title || p.prompt.split(/\s+/).slice(0, 4).join(" ") }));
  if (!prompts.length) throw new ImageApiError("The model did not return usable prompts. Try again or rephrase the idea.", 502);
  return prompts.slice(0, count);
}
