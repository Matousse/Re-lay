import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { PipelineState } from "@/services/pipeline/state";
import type { CrmPort } from "@/integrations/crm/port";
import type { EnrichmentPort } from "@/integrations/enrichment/port";
import type { LlmClient } from "@/integrations/llm/client";
import { makeQualifyNode, routeOnStatus } from "@/services/pipeline/nodes/qualify";
import { makeAnalystNode } from "@/services/pipeline/nodes/analyst";
import { makeResearcherNode } from "@/services/pipeline/nodes/researcher";
import { makeStrategistNode, routeOnDecision } from "@/services/pipeline/nodes/strategist";
import { makeHumanReviewNode } from "@/services/pipeline/nodes/humanReview";
import { makeSyncCrmNode } from "@/services/pipeline/nodes/syncCrm";

export function buildGraph(deps: { crm: CrmPort; enrichment: EnrichmentPort; llm: LlmClient }) {
  return (
    new StateGraph(PipelineState)
      // Add nodes
      .addNode("qualify", makeQualifyNode(deps.crm))
      .addNode("analyst", makeAnalystNode(deps.crm, deps.llm))
      .addNode("researcher", makeResearcherNode(deps.enrichment))
      .addNode("strategist", makeStrategistNode(deps.llm))
      .addNode("humanReview", makeHumanReviewNode())
      .addNode("syncCrm", makeSyncCrmNode(deps.crm))
      // Add edges
      .addEdge(START, "qualify")
      .addConditionalEdges("qualify", routeOnStatus, ["analyst", END])
      .addEdge("analyst", "researcher")
      .addEdge("researcher", "strategist")
      .addEdge("strategist", "humanReview")
      .addConditionalEdges("humanReview", routeOnDecision, ["syncCrm", END])
      .addEdge("syncCrm", END)
      // Compile with checkpointer for persistence
      .compile({ checkpointer: new MemorySaver() })
  );
}
