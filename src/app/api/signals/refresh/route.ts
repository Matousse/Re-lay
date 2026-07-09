import { NextResponse } from "next/server";
import { refreshSignals } from "@/services/sillage-signals";

// Side-effecting counterpart to GET /api/signals: triggers the Sillage agents,
// waits for the runs to finish, and returns the fresh detections. Powers the
// "Run on a signal" dialog. Offline degrades to an empty list inside the
// service; live Sillage errors (402/403/429) surface as a message for a toast.
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const signals = await refreshSignals();
    return NextResponse.json(signals);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to refresh signals.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
