import { cancel } from "@/lib/server/queue";
import { isSafeId } from "@/lib/server/store";

/** DELETE → cancel a queued or running job. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/queue/[id]">) {
  const { id } = await ctx.params;
  const job = isSafeId(id) ? cancel(id) : null;
  return job ? Response.json({ job }) : Response.json({ error: "Not found" }, { status: 404 });
}
