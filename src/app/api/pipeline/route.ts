import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { pipeline, signalSource } from "@/services/pipeline";
import { StartPipelineInputSchema } from "@/types/pipeline";
import type { PipelineStateType } from "@/services/pipeline/state";

type WithInterrupt = PipelineStateType & {
  __interrupt__?: Array<{ value: unknown }>;
};

export async function POST(req: Request) {
  const parsed = StartPipelineInputSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const signal = await signalSource.getById(parsed.data.signalId);
  if (!signal) return NextResponse.json({ error: "Signal inconnu" }, { status: 404 });

  const threadId = randomUUID();
  const result = (await pipeline.invoke(
    { signal },
    { configurable: { thread_id: threadId } },
  )) as WithInterrupt;

  if (result.__interrupt__) {
    return NextResponse.json({ threadId, interrupt: result.__interrupt__[0].value });
  }
  return NextResponse.json({ threadId, done: true, state: result });
}
