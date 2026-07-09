import { z } from "zod";

export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const AssistantInputSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(30),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type AssistantInput = z.infer<typeof AssistantInputSchema>;

// One entry per tool call the assistant made while answering — surfaced in
// the transcript as chips so the agentic work is visible.
export type ToolCallTrace = { name: string; isError: boolean };

export type AssistantReply = { reply: string; toolCalls: ToolCallTrace[] };

// Progress events streamed to the bubble while the assistant works (NDJSON,
// one per line): the model thinking, each tool starting/finishing, and the
// final turn. The UI animates these live instead of a mute spinner.
export type AssistantEvent =
  | { type: "thinking" }
  | { type: "tool_start"; name: string }
  // detail carries what happened in clear text — the tool's error message on
  // failure, its one-line summary on success — revealed when the step is
  // clicked.
  | { type: "tool_end"; name: string; isError: boolean; detail?: string }
  | ({ type: "done" } & AssistantReply);
