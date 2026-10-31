import { connection } from "next/server";
import { guardInternal } from "@/lib/server/internal";
import { createBackup, listBackups } from "@/lib/server/backup";

/** GET → list snapshots (newest first). */
export async function GET(request: Request) {
  await connection();
  const denied = guardInternal(request);
  if (denied) return denied;
  return Response.json({ backups: await listBackups() });
}

/** POST { label? } → snapshot the library and every image file. */
export async function POST(request: Request) {
  const denied = guardInternal(request);
  if (denied) return denied;
  const body = (await request.json().catch(() => ({}))) as { label?: string };
  const backup = await createBackup(body?.label?.trim() || undefined);
  return Response.json({ backup }, { status: 201 });
}
