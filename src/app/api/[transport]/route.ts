import { createMcpHandler } from "mcp-handler";
import { RELAY_TOOLS, runTool } from "@/services/relay-tools";

// Re:lay exposed over the Model Context Protocol (Streamable HTTP): one of
// the entry points over the same services/ layer as the HTTP routes and RSCs,
// so any MCP client (Claude, a sales-ops agent…) can drive the product — list
// revivable deals, run the pipeline up to human review, route a decision.
// The tools themselves live in services/relay-tools.ts, shared with the
// in-app assistant; this route only adapts them to the MCP wire, and every
// call goes through runTool so validation and failure behavior stay uniform
// across both entry points.

const handler = createMcpHandler(
  (server) => {
    for (const tool of RELAY_TOOLS) {
      server.registerTool(
        tool.name,
        {
          title: tool.title,
          description: tool.description,
          inputSchema: tool.schema.shape,
          ...(tool.annotations ? { annotations: tool.annotations } : {}),
        },
        async (args: Record<string, unknown>) => {
          const result = await runTool(tool, args);
          return {
            content: [{ type: "text" as const, text: result.text }],
            ...(result.isError ? { isError: true } : {}),
          };
        },
      );
    }
  },
  {
    serverInfo: { name: "relay", version: "1.0.0" },
    capabilities: { tools: {} },
  },
  {
    basePath: "/api",
    maxDuration: 60,
  },
);

export { handler as GET, handler as POST, handler as DELETE };
