import type { z } from "zod";
import { ChatAnthropic } from "@langchain/anthropic";
import { env } from "@/lib/env";

export interface LlmClient {
  structured<T>(input: { system: string; user: string; schema: z.ZodType<T> }): Promise<T>;
}

export function makeAnthropicClient(): LlmClient {
  // No `temperature`: the Claude 5 family rejects the param (API 400,
  // "`temperature` is deprecated for this model").
  const model = new ChatAnthropic({
    model: "claude-sonnet-5",
    apiKey: env.ANTHROPIC_API_KEY,
  });
  return {
    async structured({ system, user, schema }) {
      const structured = model.withStructuredOutput(schema);
      const result = await structured.invoke([
        { role: "system", content: system },
        { role: "user", content: user },
      ]);
      return result as z.infer<typeof schema>;
    },
  };
}
