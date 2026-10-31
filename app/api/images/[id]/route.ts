import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { IMAGES_DIR, isSafeId, readLibrary, removeImage } from "@/lib/server/store";
import { forgetImage } from "@/lib/server/queue";

export async function GET(request: Request, ctx: RouteContext<"/api/images/[id]">) {
  const { id } = await ctx.params;
  if (!isSafeId(id)) return new Response("Not found", { status: 404 });
  const record = (await readLibrary()).find((r) => r.id === id);
  if (!record) return new Response("Not found", { status: 404 });
  try {
    const bytes = await readFile(join(IMAGES_DIR, record.file));
    const download = new URL(request.url).searchParams.has("download");
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
        ...(download ? { "Content-Disposition": `attachment; filename="darkroom-${id}.png"` } : {}),
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/images/[id]">) {
  const { id } = await ctx.params;
  if (!isSafeId(id)) return Response.json({ error: "Invalid id" }, { status: 400 });
  const ok = await removeImage(id);
  // Also drop it from the queue history, whether or not it was still in the library.
  forgetImage(id);
  return ok ? Response.json({ ok: true }) : Response.json({ error: "Not found" }, { status: 404 });
}
