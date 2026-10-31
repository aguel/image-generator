import { guardInternal } from "@/lib/server/internal";
import { restoreBackup } from "@/lib/server/backup";
import { isSafeId } from "@/lib/server/store";

/** POST → replace the live library with this snapshot. */
export async function POST(request: Request, ctx: RouteContext<"/api/backup/[id]/restore">) {
  const denied = guardInternal(request);
  if (denied) return denied;
  const { id } = await ctx.params;
  const backup = isSafeId(id) ? await restoreBackup(id) : null;
  return backup ? Response.json({ restored: backup }) : Response.json({ error: "Not found" }, { status: 404 });
}
