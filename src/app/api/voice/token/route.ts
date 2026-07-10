import { NextResponse } from "next/server";
import { getStreamToken } from "@/services/voice";

// Mints a short-lived Gradium token so the bubble can open the STT WebSocket
// straight from the browser — GRADIUM_API_KEY never leaves the server.
export async function POST() {
  try {
    const token = await getStreamToken();
    return NextResponse.json(token, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Token mint failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
