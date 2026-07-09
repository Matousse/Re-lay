import { NextResponse } from "next/server";
import { getPipelineBridge } from "@/services/pipeline-bridge";

// Signals available to run the real pipeline on — real Sillage events when
// SILLAGE_API_KEY is set, the seeded fakes (Acme, Globex) otherwise. Feeds the
// RunLiveButton picker.
export const dynamic = "force-dynamic";

export async function GET() {
  const signals = await getPipelineBridge().listSignals();
  return NextResponse.json(signals);
}
