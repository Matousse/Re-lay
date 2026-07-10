import { mintStreamToken, synthesizeSpeech } from "@/integrations/voice/gradium";

// Business rules for the voice bubble: the routes stay thin transport shells and
// the guards (TTS length cap) live here.

const MAX_TTS_CHARS = 4000;

// Short-lived token the browser uses to open Gradium's STT WebSocket directly.
export async function getStreamToken(): Promise<{ token: string; expiresAt: string }> {
  return mintStreamToken();
}

export async function speakReply(
  text: string,
): Promise<{ audio: ArrayBuffer; contentType: string }> {
  // Gradium caps TTS input; trim long assistant answers so a verbose reply still
  // gets spoken rather than rejected outright.
  return synthesizeSpeech(text.slice(0, MAX_TTS_CHARS));
}
