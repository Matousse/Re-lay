import { NextResponse } from "next/server";
import { speakReply } from "@/services/voice";
import { SpeakInputSchema } from "@/types/voice";

// TTS: takes the assistant's reply text and streams back Gradium-synthesized
// audio bytes the bubble plays aloud.
export async function POST(request: Request) {
  const parsed = SpeakInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { audio, contentType } = await speakReply(parsed.data.text);
    return new Response(audio, {
      headers: { "Content-Type": contentType, "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Synthesis failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
