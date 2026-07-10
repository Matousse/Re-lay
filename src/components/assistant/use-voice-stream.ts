"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { withBasePath } from "@/lib/base-path";

export type StreamStatus = "idle" | "connecting" | "recording";

const STT_WS_URL = "wss://api.gradium.ai/api/speech/asr";
const STT_LANGUAGE = "fr";
const TARGET_SAMPLE_RATE = 24000;
const CHUNK_SIZE = 2048; // ~85 ms at 24 kHz — low latency, still efficient
const SUPPORTED_PCM_RATES = new Set([8000, 16000, 22050, 24000, 44100, 48000]);
const FINAL_TEXT_GRACE_MS = 600;

type Options = {
  // Called with the cumulative transcript each time a new segment lands.
  onTranscript: (text: string) => void;
  onError?: () => void;
};

// Live speech-to-text: streams mic PCM to Gradium's WebSocket over a short-lived
// token and reports the transcript as it grows, word by word. `start` opens the
// mic + socket (push-to-talk down); `stop` flushes and closes (push-to-talk up).
export function useVoiceStream({ onTranscript, onError }: Options) {
  const [status, setStatus] = useState<StreamStatus>("idle");
  const wsRef = useRef<WebSocket | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const teardown = useCallback(() => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const ctx = ctxRef.current;
    ctxRef.current = null;
    if (ctx && ctx.state !== "closed") void ctx.close();
  }, []);

  const start = useCallback(async () => {
    if (status !== "idle" || wsRef.current) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Voice input isn't supported in this browser.");
      return;
    }
    setStatus("connecting");

    // Create the AudioContext synchronously, inside the click gesture, so it
    // starts "running" instead of blocked; then fetch token + mic in parallel.
    const ctx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
    ctxRef.current = ctx;
    const tokenPromise = fetch(withBasePath("/api/voice/token"), { method: "POST" });

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      teardown();
      setStatus("idle");
      toast.error("Microphone access denied — enable it to talk to Re:lay.");
      onError?.();
      return;
    }
    streamRef.current = stream;

    let token: string;
    try {
      const response = await tokenPromise;
      if (!response.ok) throw new Error("token");
      token = ((await response.json()) as { token: string }).token;
    } catch {
      teardown();
      setStatus("idle");
      toast.error("Couldn't start voice — try again.");
      onError?.();
      return;
    }

    const segments: string[] = [];
    const url = new URL(STT_WS_URL);
    url.searchParams.set("token", token);
    const ws = new WebSocket(url);

    ws.onopen = () => {
      if (ctx.state === "suspended") void ctx.resume();
      const rate = ctx.sampleRate;
      const inputFormat = SUPPORTED_PCM_RATES.has(rate) ? `pcm_${rate}` : "pcm";
      ws.send(
        JSON.stringify({
          type: "setup",
          model_name: "default",
          input_format: inputFormat,
          json_config: { language: STT_LANGUAGE },
        }),
      );

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(CHUNK_SIZE, 1, 1);
      processor.onaudioprocess = (event) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        ws.send(
          JSON.stringify({
            type: "audio",
            audio: pcmToBase64(event.inputBuffer.getChannelData(0)),
          }),
        );
      };
      source.connect(processor);
      processor.connect(ctx.destination); // required for onaudioprocess to fire
      sourceRef.current = source;
      processorRef.current = processor;
      setStatus("recording");
    };

    ws.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      let msg: { type?: string; text?: string; message?: string };
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type === "text" && msg.text) {
        segments.push(msg.text);
        onTranscript(segments.join(" ").replace(/\s+/g, " ").trim());
      }
    };

    ws.onerror = () => {
      toast.error("Voice connection failed — try again.");
      onError?.();
    };

    ws.onclose = () => {
      wsRef.current = null;
      teardown();
      setStatus("idle");
    };

    wsRef.current = ws;
  }, [status, onTranscript, onError, teardown]);

  const stop = useCallback(() => {
    const ws = wsRef.current;
    // Stop feeding audio immediately, but keep the socket open briefly so the
    // last words still arrive; onclose does the teardown.
    processorRef.current?.disconnect();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "end_of_stream" }));
      setTimeout(() => ws.close(), FINAL_TEXT_GRACE_MS);
    } else {
      ws?.close();
      teardown();
      setStatus("idle");
    }
  }, [teardown]);

  return { status, start, stop };
}

// Float32 [-1,1] → 16-bit little-endian PCM → base64, the frame shape Gradium's
// STT WebSocket expects.
function pcmToBase64(float32: Float32Array): string {
  const pcm = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const sample = Math.max(-1, Math.min(1, float32[i]));
    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  const bytes = new Uint8Array(pcm.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
