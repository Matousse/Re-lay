import {
  makeSillageWriteClient,
  SillageOfflineError,
  type SillageWriteClient,
} from "@/integrations/signals/sillage-write";
import { getPipelineBridge } from "@/services/pipeline-bridge";
import type { Signal } from "@/types/pipeline";

// Orchestration point for the "Run on a signal" gesture: trigger every Sillage
// agent (write side), wait for the runs to finish, then read the fresh
// detections back (read side via the pipeline bridge). The two sides are
// distinct dependencies — this service is the only place that chains them, so
// the route stays a thin pass-through.
type RefreshDeps = {
  sillage?: SillageWriteClient;
  listSignals?: () => Promise<Signal[]>;
};

export async function refreshSignals(deps: RefreshDeps = {}): Promise<Signal[]> {
  const sillage = deps.sillage ?? makeSillageWriteClient();
  const listSignals = deps.listSignals ?? (() => getPipelineBridge().listSignals());

  try {
    await sillage.runAllAgents();
  } catch (error) {
    // No key → nothing to run and nothing fresh to show; degrade to empty
    // rather than crash. Live errors (402/403/429) still propagate to the route.
    if (error instanceof SillageOfflineError) return [];
    throw error;
  }

  return listSignals();
}
