import { enqueue, QueueFullError, waitFor } from "@/lib/server/queue";

export const maxDuration = 300;

/**
 * POST { prompt, styleId, aspect } → generates ONE image and waits for it.
 * Goes through the queue, so GENERATION_CONCURRENCY and GENERATION_QUEUE_SIZE still apply.
 * The UI uses /api/queue instead; this endpoint stays for scripts.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { prompt?: string; styleId?: string; aspect?: string }
    | null;

  const prompt = body?.prompt?.trim();
  if (!prompt) return Response.json({ error: "Prompt is required." }, { status: 400 });
  if (prompt.length > 4000) return Response.json({ error: "Prompt is too long (max 4000)." }, { status: 400 });

  try {
    const [job] = enqueue([{ prompt, styleId: body?.styleId ?? "", aspect: body?.aspect ?? "" }]);
    const done = await waitFor(job.id);
    if (done?.status === "done" && done.image) return Response.json({ image: done.image });
    return Response.json({ error: done?.error ?? "Generation was cancelled." }, { status: 502 });
  } catch (err) {
    if (err instanceof QueueFullError) return Response.json({ error: err.message }, { status: 429 });
    throw err;
  }
}
