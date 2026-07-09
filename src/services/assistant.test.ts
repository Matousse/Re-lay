import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { RelayTool } from "./relay-tools";
import { runAssistant } from "./assistant";

const USER = [{ role: "user" as const, content: "Which deals are worth reviving?" }];

function fakeTool(overrides: Partial<RelayTool> = {}): RelayTool {
  return {
    name: "list_revivable_deals",
    title: "List revivable deals",
    description: "…",
    schema: z.object({}),
    handler: vi.fn(async () => ({ text: '{"stats":{"goVerdicts":5}}' })),
    ...overrides,
  };
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("runAssistant", () => {
  it("asks for the API key instead of calling the model without one", async () => {
    const fetchImpl = vi.fn();
    const result = await runAssistant(USER, {
      apiKey: undefined,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.reply).toContain("ANTHROPIC_API_KEY");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("runs the tool-use loop: executes the tool, feeds the result back, returns the text", async () => {
    const tool = fakeTool();
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
      if (fetchImpl.mock.calls.length === 1) {
        return jsonResponse({
          stop_reason: "tool_use",
          content: [
            { type: "text", text: "Let me check." },
            { type: "tool_use", id: "tu_1", name: "list_revivable_deals", input: {} },
          ],
        });
      }
      return jsonResponse({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "5 go verdicts — Kerneos leads at 86k€." }],
      });
    });

    const events: string[] = [];
    const result = await runAssistant(USER, {
      apiKey: "sk-ant-test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      tools: [tool],
      onEvent: (event) => events.push(event.type),
    });

    expect(tool.handler).toHaveBeenCalledWith({});
    expect(result.reply).toContain("Kerneos");
    expect(result.toolCalls).toEqual([{ name: "list_revivable_deals", isError: false }]);
    // Progress events stream in order: thinking → tool lifecycle → thinking.
    expect(events).toEqual(["thinking", "tool_start", "tool_end", "thinking"]);

    // The second request must carry the tool result back to the model.
    const secondBody = JSON.parse(fetchImpl.mock.calls[1][1]!.body as string);
    const lastMessage = secondBody.messages.at(-1);
    expect(lastMessage.role).toBe("user");
    expect(lastMessage.content[0]).toMatchObject({ type: "tool_result", tool_use_id: "tu_1" });
    // And the first request authenticates properly.
    const firstHeaders = fetchImpl.mock.calls[0][1]!.headers as Record<string, string>;
    expect(firstHeaders["x-api-key"]).toBe("sk-ant-test");
    expect(firstHeaders["anthropic-version"]).toBe("2023-06-01");
  });

  it("degrades to a friendly message when the API is down", async () => {
    const down = vi.fn(async () => new Response(null, { status: 529 }));
    const result = await runAssistant(USER, {
      apiKey: "sk-ant-test",
      fetchImpl: down as unknown as typeof fetch,
    });
    expect(result.reply).toContain("try again");

    const unreachable = vi.fn(async () => {
      throw new Error("network down");
    });
    const result2 = await runAssistant(USER, {
      apiKey: "sk-ant-test",
      fetchImpl: unreachable as unknown as typeof fetch,
    });
    expect(result2.reply).toContain("unreachable");
  });

  it("marks failed tool calls in the trace and reports them to the model", async () => {
    const tool = fakeTool({
      handler: vi.fn(async () => ({ text: "The pipeline is offline.", isError: true })),
    });
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
      if (fetchImpl.mock.calls.length === 1) {
        return jsonResponse({
          stop_reason: "tool_use",
          content: [{ type: "tool_use", id: "tu_1", name: "list_revivable_deals", input: {} }],
        });
      }
      return jsonResponse({
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Connect the integrations first." }],
      });
    });

    const events: unknown[] = [];
    const result = await runAssistant(USER, {
      apiKey: "sk-ant-test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      tools: [tool],
      onEvent: (event) => events.push(event),
    });
    expect(result.toolCalls).toEqual([{ name: "list_revivable_deals", isError: true }]);
    const secondBody = JSON.parse(fetchImpl.mock.calls[1][1]!.body as string);
    expect(secondBody.messages.at(-1).content[0]).toMatchObject({ is_error: true });
    // The error text rides the tool_end event so the UI can reveal it.
    expect(events).toContainEqual({
      type: "tool_end",
      name: "list_revivable_deals",
      isError: true,
      detail: "The pipeline is offline.",
    });
  });
});
