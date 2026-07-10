import { env } from "@/lib/env";

// Gradium has no JS SDK, so we hit its REST endpoints directly from the server —
// GRADIUM_API_KEY never reaches the browser. Both calls throw on a missing key
// or a failed request; the caller turns that into a graceful text fallback, per
// the ROADMAP voice tiers ("the voice tiers fall back to text").

const GRADIUM_BASE_URL = "https://api.gradium.ai/api";

// Fallback voice from the Gradium docs' examples; override per account with
// GRADIUM_VOICE_ID in .env.
const DEFAULT_VOICE_ID = "YTpq7expH9539ERJ";

type GradiumOptions = { apiKey?: string; fetchImpl?: typeof fetch };

class GradiumError extends Error {}

function requireKey(apiKey: string | undefined): string {
  if (!apiKey) throw new GradiumError("GRADIUM_API_KEY is not set");
  return apiKey;
}

/**
 * Mints a short-lived token so the browser can open Gradium's STT WebSocket
 * directly (`?token=…`) without ever seeing GRADIUM_API_KEY. Called server-side.
 */
export async function mintStreamToken({
  apiKey = env.GRADIUM_API_KEY,
  fetchImpl = fetch,
}: GradiumOptions = {}): Promise<{ token: string; expiresAt: string }> {
  const key = requireKey(apiKey);
  const response = await fetchImpl(`${GRADIUM_BASE_URL}/api-keys/token`, {
    method: "GET",
    headers: { "x-api-key": key },
  });
  if (!response.ok) {
    throw new GradiumError(`Gradium token mint failed (${response.status})`);
  }
  const data = (await response.json()) as { token: string; expires_at: string };
  return { token: data.token, expiresAt: data.expires_at };
}

/**
 * One-shot text-to-speech. Returns the synthesized WAV bytes (`only_audio`) so
 * the browser can play them straight from an object URL.
 */
export async function synthesizeSpeech(
  text: string,
  {
    apiKey = env.GRADIUM_API_KEY,
    voiceId = env.GRADIUM_VOICE_ID ?? DEFAULT_VOICE_ID,
    fetchImpl = fetch,
  }: GradiumOptions & { voiceId?: string } = {},
): Promise<{ audio: ArrayBuffer; contentType: string }> {
  const key = requireKey(apiKey);
  const response = await fetchImpl(`${GRADIUM_BASE_URL}/post/speech/tts`, {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      voice_id: voiceId,
      output_format: "wav",
      only_audio: true,
    }),
  });
  if (!response.ok) {
    throw new GradiumError(`Gradium TTS failed (${response.status})`);
  }
  return {
    audio: await response.arrayBuffer(),
    contentType: response.headers.get("Content-Type") ?? "audio/wav",
  };
}
