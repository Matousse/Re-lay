import { NextResponse } from "next/server";
import { runPipelineForSignal } from "@/services/reengagement";
import { StartPipelineInputSchema } from "@/types/pipeline";

// Runs the LangGraph pipeline on a signal and returns the resulting case in
// the front's ReengagementCase shape (unlike POST /api/pipeline, which
// returns the raw graph state).
export async function POST(request: Request) {
  const parsed = StartPipelineInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await runPipelineForSignal(parsed.data.signalId);
  if (!result.ok) {
    if (result.reason === "offline") {
      return NextResponse.json(
        { error: "Connect all integrations before running the pipeline" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Unknown signal, or the matched account has nothing to revive" },
      { status: 422 },
    );
  }
  return NextResponse.json(result.case);
}
