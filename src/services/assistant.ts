import { z } from "zod";
import { env } from "@/lib/env";
import { RELAY_TOOLS, type RelayTool } from "@/services/relay-tools";
import type { AssistantEvent, AssistantReply, ChatMessage, ToolCallTrace } from "@/types/assistant";

// The in-app assistant: Claude with its hands on the same tool registry the
// MCP server exposes (services/relay-tools.ts). Runs the standard tool-use
// loop against the Anthropic Messages API — the model asks for tools, we
// execute them against our services, feed the results back, and return the
// final text plus a trace of every tool call for the transcript.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
// Model routing: the chat loop is orchestration (pick a tool, summarize its
// JSON), so it defaults to Haiku for snappy turns — the deep reasoning
// (autopsy, verdict, email) happens inside run_reengagement, where the
// pipeline keeps Sonnet (integrations/llm/client.ts). Override with
// ASSISTANT_MODEL to trade speed for depth.
const FAST_MODEL = "claude-haiku-4-5";
const MAX_ROUNDS = 6;
// Generous: the model spends output budget on internal reasoning before the
// visible text — 1024 produced empty replies after heavy tool results.
const MAX_TOKENS = 4096;

const SYSTEM_PROMPT = `You are the Re:lay assistant, embedded in the Re:lay app — an agentic GTM product that revives closed-lost CRM deals when a buying signal fires (job change, funding, site revisit…).

Use your tools to answer from live data; never invent deals, scores or contacts. Amounts are in euros. Tools are for data questions and actions ONLY — for greetings, small talk or "what can you do?", answer directly in one or two sentences without calling any tool.

The human-review gate is the product's core: run_reengagement only *proposes* a play. Approving is consequential (CRM write + team announcement) — before calling approve_play, restate which case and angle you are about to approve and get an explicit yes from the user in this conversation.

When the user asks you to run or revive something, don't stop at reconnaissance: pick the best signal and call run_reengagement in the same turn, then report the proposed play. Signals can be near-duplicates (same company, several postings) — pick one, don't enumerate them all.

Be concise and concrete: short sentences, name companies, amounts and scores. You are talking to a sales rep, not a developer.

Formatting: your replies render in a ~300px-wide chat panel that supports **bold**, \`code\` and simple pipe tables. Prefer short bullet lists. Tables: 3 columns MAXIMUM with short values (e.g. Company | € | Score) or they clip — when in doubt, use a list instead. No headings, no links, no nested markdown.`;

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

type AnthropicResponse = {
  content: AnthropicContentBlock[];
  stop_reason: string;
};

type AnthropicMessage = { role: "user" | "assistant"; content: unknown };

function toAnthropicTools(tools: RelayTool[]) {
  return tools.map((tool) => {
    // Zod v4 emits a $schema key Anthropic does not expect.
    const { $schema: _discarded, ...schema } = z.toJSONSchema(tool.schema);
    return { name: tool.name, description: tool.description, input_schema: schema };
  });
}

export type AssistantOptions = {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  tools?: RelayTool[];
  model?: string;
  // Live progress feed for the UI; never throws back into the loop.
  onEvent?: (event: AssistantEvent) => void;
};

export async function runAssistant(
  messages: ChatMessage[],
  {
    apiKey = env.ANTHROPIC_API_KEY,
    fetchImpl = fetch,
    tools = RELAY_TOOLS,
    model = env.ASSISTANT_MODEL ?? FAST_MODEL,
    onEvent,
  }: AssistantOptions = {},
): Promise<AssistantReply> {
  const emit = (event: AssistantEvent) => {
    try {
      onEvent?.(event);
    } catch {
      // A broken listener must never break the answer.
    }
  };
  if (!apiKey) {
    return {
      reply:
        "The assistant needs an ANTHROPIC_API_KEY to think. Add it to .env and restart — every tool is already wired.",
      toolCalls: [],
    };
  }

  const conversation: AnthropicMessage[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const toolCalls: ToolCallTrace[] = [];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    emit({ type: "thinking" });
    let response: Response;
    try {
      response = await fetchImpl(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: MAX_TOKENS,
          system: SYSTEM_PROMPT,
          tools: toAnthropicTools(tools),
          messages: conversation,
        }),
      });
    } catch {
      return { reply: "The model is unreachable right now — try again in a moment.", toolCalls };
    }
    if (!response.ok) {
      return { reply: "The model refused the request — try again in a moment.", toolCalls };
    }

    const data = (await response.json()) as AnthropicResponse;
    const toolUses = data.content.filter(
      (block): block is Extract<AnthropicContentBlock, { type: "tool_use" }> =>
        block.type === "tool_use",
    );

    if (data.stop_reason !== "tool_use" || toolUses.length === 0) {
      const reply = data.content
        .filter(
          (block): block is Extract<AnthropicContentBlock, { type: "text" }> =>
            block.type === "text",
        )
        .map((block) => block.text)
        .join("\n")
        .trim();
      // An empty turn (all budget burned on reasoning) or a truncated one
      // should read as something actionable, never as "…".
      if (!reply) {
        return { reply: "I came back without an answer — ask me to continue.", toolCalls };
      }
      return {
        reply:
          data.stop_reason === "max_tokens"
            ? `${reply}\n\n(cut short — ask me to continue)`
            : reply,
        toolCalls,
      };
    }

    // Execute every requested tool and hand the results back to the model.
    conversation.push({ role: "assistant", content: data.content });
    const results = await Promise.all(
      toolUses.map(async (use) => {
        emit({ type: "tool_start", name: use.name });
        const tool = tools.find((t) => t.name === use.name);
        const result = tool
          ? await tool.handler(use.input ?? {})
          : { text: `Unknown tool "${use.name}".`, isError: true };
        const isError = result.isError === true;
        toolCalls.push({ name: use.name, isError });
        // Errors expose their message; successes their one-line summary.
        const detail = isError ? result.text : result.summary;
        emit({ type: "tool_end", name: use.name, isError, ...(detail ? { detail } : {}) });
        return {
          type: "tool_result" as const,
          tool_use_id: use.id,
          content: result.text,
          ...(result.isError ? { is_error: true } : {}),
        };
      }),
    );
    conversation.push({ role: "user", content: results });
  }

  return {
    reply: "I hit my tool-call budget for one answer — ask me to continue.",
    toolCalls,
  };
}
