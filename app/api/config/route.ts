import { connection } from "next/server";
import { imageModel } from "@/lib/server/openai";
import { completionModel } from "@/lib/server/enhance";
import { limits } from "@/lib/server/queue";

/** Non-secret runtime info for the UI. */
export async function GET() {
  await connection();
  return Response.json({
    model: imageModel(),
    completionModel: completionModel(),
    keyConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    ...limits(),
  });
}
