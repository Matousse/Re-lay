import { NextResponse } from "next/server";
import { runSillageSync } from "@/services/sillage-sync";
import { SillageSyncInputSchema, type SillageSyncEvent } from "@/types/sillage-sync";

// Runs the Sillage sync and streams its progress as NDJSON — one event per line,
// the modal animating each step live — ending with a `done` (summary) or an
// `error` event. Same transport as the assistant chat (api/assistant/route.ts).
export async function POST(request: Request) {
  const parsed = SillageSyncInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SillageSyncEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        const summary = await runSillageSync({ ...parsed.data, onEvent: send });
        send({ type: "done", summary });
      } catch (error) {
        send({ type: "error", message: error instanceof Error ? error.message : "Sync failed." });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
}
