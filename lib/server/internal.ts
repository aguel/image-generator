import "server-only";

const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\]|::1)(:\d+)?$/i;

/**
 * Guards internal endpoints (backup API).
 * - If BACKUP_TOKEN is set, callers must send `Authorization: Bearer <token>` or `x-backup-token`.
 * - Otherwise only requests addressed to a loopback host are allowed.
 * Returns a Response to short-circuit with, or null when the caller is allowed.
 */
export function guardInternal(request: Request): Response | null {
  const token = process.env.BACKUP_TOKEN?.trim();
  if (token) {
    const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const header = request.headers.get("x-backup-token");
    if (auth === token || header === token) return null;
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const host = request.headers.get("host") ?? "";
  if (LOOPBACK.test(host)) return null;
  return Response.json(
    { error: "Backup API is internal. Call it via localhost or set BACKUP_TOKEN." },
    { status: 403 },
  );
}
