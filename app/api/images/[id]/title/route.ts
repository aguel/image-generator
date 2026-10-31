import { isSafeId, readLibrary, updateImage } from "@/lib/server/store";
import { TITLE_MEMORY, titleForRecord } from "@/lib/server/quote";
import { refreshImage } from "@/lib/server/queue";

export const maxDuration = 60;

/** POST → writes a new inspirational title for the image (replacing any existing one). */
export async function POST(request: Request, ctx: RouteContext<"/api/images/[id]/title">) {
  const { id } = await ctx.params;
  if (!isSafeId(id)) return Response.json({ error: "Invalid id" }, { status: 400 });
  const record = (await readLibrary()).find((r) => r.id === id);
  if (!record) return Response.json({ error: "Not found" }, { status: 404 });
  const title = await titleForRecord(record, request.signal);
  if (!title) return Response.json({ error: "Could not write a title right now. Try again." }, { status: 502 });
  const pastTitles = [record.title?.text ?? "", ...(record.pastTitles ?? [])].filter(Boolean).slice(0, TITLE_MEMORY);
  const image = await updateImage(id, { title, pastTitles });
  if (image) refreshImage(image);
  return Response.json({ image });
}
