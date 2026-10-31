import { connection } from "next/server";
import { readLibrary } from "@/lib/server/store";

export async function GET() {
  await connection();
  return Response.json({ images: await readLibrary() });
}
