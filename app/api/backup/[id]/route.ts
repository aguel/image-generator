import { guardInternal } from "@/lib/server/internal";
import { deleteBackup, getBackup } from "@/lib/server/backup";
import { isSafeId } from "@/lib/server/store";

export async function GET(request: Request, ctx: RouteContext<"/api/backup/[id]">) {
  const denied = guardInternal(request);
  if (denied) return denied;
  const { id } = await ctx.params;
  const backup = isSafeId(id) ? await getBackup(id) : null;
  return backup ? Response.json({ backup }) : Response.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/backup/[id]">) {
  const denied = guardInternal(request);
  if (denied) return denied;
  const { id } = await ctx.params;
  const ok = isSafeId(id) && (await deleteBackup(id));
  return ok ? Response.json({ ok: true }) : Response.json({ error: "Not found" }, { status: 404 });
}
