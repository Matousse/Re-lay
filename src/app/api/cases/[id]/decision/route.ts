import { NextResponse } from "next/server";
import { decideCase } from "@/services/reengagement";
import { DecisionInputSchema } from "@/types/reengagement";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = DecisionInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const outcome = await decideCase(id, parsed.data);
  if (!outcome) {
    return NextResponse.json({ error: "Case not found or already decided" }, { status: 404 });
  }

  // { case, effects } — the panel reads effects to show the sync receipt and
  // the Slack toast.
  return NextResponse.json(outcome);
}
