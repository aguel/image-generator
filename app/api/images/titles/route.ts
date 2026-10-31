import { readLibrary, updateImage } from "@/lib/server/store";
import { titleForRecord } from "@/lib/server/quote";
import { refreshImage } from "@/lib/server/queue";

export const maxDuration = 300;

const PARALLEL = 3;

/**
 * POST → writes quote titles for every image that has none yet (older images made before
 * titles existed). Returns { updated, failed, remaining }.
 */
export async function POST(request: Request) {
  const missing = (await readLibrary()).filter((r) => !r.title);
  let updated = 0;
  let failed = 0;
  let next = 0;

  const worker = async () => {
    while (next < missing.length && !request.signal.aborted) {
      const record = missing[next++];
      const title = await titleForRecord(record, request.signal);
      const image = title ? await updateImage(record.id, { title }) : null;
      if (image) {
        refreshImage(image);
        updated++;
      } else failed++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, missing.length) }, worker));

  const remaining = (await readLibrary()).filter((r) => !r.title).length;
  return Response.json({ updated, failed, remaining });
}
