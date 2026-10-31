import { connection } from "next/server";
import { clearFinished, enqueue, QueueFullError, snapshot } from "@/lib/server/queue";
import { MAX_COUNT } from "@/lib/aspects";

/** GET → queue state: limits, counts and every recent job. */
export async function GET() {
  await connection();
  return Response.json(snapshot());
}

/**
 * POST { items: [{ prompt, styleId, aspect, replaces? }], batchId? }
 *   or { prompt, styleId, aspect, count } (same prompt repeated `count` times)
 * → 201 { jobs }. Responds 429 when the jobs do not fit in GENERATION_QUEUE_SIZE.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    items?: { prompt?: string; styleId?: string; aspect?: string; replaces?: string }[];
    prompt?: string;
    styleId?: string;
    aspect?: string;
    count?: number;
    batchId?: string;
  } | null;
  if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return Response.json({ error: "OPENAI_API_KEY is not configured on the server." }, { status: 500 });
  }

  const raw: { prompt?: string; styleId?: string; aspect?: string; replaces?: string }[] = body.items?.length
    ? body.items
    : Array.from({ length: Math.min(MAX_COUNT, Math.max(1, Math.floor(body.count ?? 1))) }, () => ({
        prompt: body.prompt,
        styleId: body.styleId,
        aspect: body.aspect,
      }));

  const items = raw.map((i) => ({ prompt: i.prompt?.trim() ?? "", styleId: i.styleId ?? "", aspect: i.aspect ?? "", replaces: typeof i.replaces === "string" ? i.replaces : undefined }));
  if (!items.length) return Response.json({ error: "Nothing to queue." }, { status: 400 });
  if (items.some((i) => !i.prompt)) return Response.json({ error: "Every item needs a prompt." }, { status: 400 });
  if (items.some((i) => i.prompt.length > 4000)) return Response.json({ error: "Prompts are limited to 4000 characters." }, { status: 400 });
  if (items.length > 100) return Response.json({ error: "At most 100 items per request." }, { status: 400 });

  try {
    const batchId = typeof body.batchId === "string" ? body.batchId.slice(0, 64) : undefined;
    return Response.json({ jobs: enqueue(items, batchId) }, { status: 201 });
  } catch (err) {
    if (err instanceof QueueFullError) {
      return Response.json({ error: err.message, room: err.room, queueSize: err.queueSize }, { status: 429 });
    }
    throw err;
  }
}

/** DELETE → remove finished, failed and cancelled jobs from the list. */
export async function DELETE() {
  clearFinished();
  return Response.json(snapshot());
}
