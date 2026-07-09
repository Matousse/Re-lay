import { NextResponse } from "next/server";
import { resetDemoState, simulateIncomingSignal } from "@/services/reengagement";
import { DemoInputSchema } from "@/types/reengagement";

export async function POST(request: Request) {
  const parsed = DemoInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.action === "reset") {
    await resetDemoState();
    return NextResponse.json({ ok: true });
  }

  const simulatedCase = await simulateIncomingSignal();
  if (!simulatedCase) {
    return NextResponse.json(
      { error: "Connect all integrations before simulating a signal" },
      { status: 409 },
    );
  }
  return NextResponse.json(simulatedCase);
}
