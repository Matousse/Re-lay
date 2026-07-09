import { NextResponse } from "next/server";
import { runAssistant } from "@/services/assistant";
import { AssistantInputSchema, type AssistantEvent } from "@/types/assistant";

// Chat endpoint for the in-app assistant bubble. Stateless: the client sends
// the whole visible transcript; the response is an NDJSON stream of progress
// events (thinking, tool_start/tool_end) ending with a `done` event carrying
// the assistant's turn — so the UI can animate the agent's work live.
export async function POST(request: Request) {
  const parsed = AssistantInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AssistantEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      const result = await runAssistant(parsed.data.messages, { onEvent: send });
      send({ type: "done", ...result });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
}
