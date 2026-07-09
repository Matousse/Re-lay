import { NextResponse } from "next/server";
import { Command } from "@langchain/langgraph";
import { pipeline } from "@/services/pipeline";
import { ResumePipelineInputSchema } from "@/types/pipeline";

export async function POST(req: Request) {
  const parsed = ResumePipelineInputSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { threadId, decision } = parsed.data;
  const state = await pipeline.invoke(new Command({ resume: decision }), {
    configurable: { thread_id: threadId },
  });
  return NextResponse.json({ state });
}
