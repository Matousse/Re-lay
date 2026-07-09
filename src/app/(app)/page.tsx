import { AnimatedNumber } from "@/components/animated-number";
import { AgentRunDialog } from "@/components/cases/agent-run-dialog";
import { CasesTable } from "@/components/cases/cases-table";
import { ResetDemoButton } from "@/components/cases/reset-demo-button";
import { RunLiveButton } from "@/components/cases/run-live-button";
import { RoiProjection } from "@/components/cases/roi-projection";
import { SetupBanner } from "@/components/connectors/setup-banner";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { ENTER, enterDelay } from "@/lib/motion";
import { missingConnectors } from "@/services/connectors";
import { getStats, listCases } from "@/services/reengagement";

export default async function Home() {
  const [stats, cases, missing] = await Promise.all([getStats(), listCases(), missingConnectors()]);
  const setupNeeded = missing.length > 0;

  const tiles = [
    { label: "Revivable pipeline", value: stats.revivablePipeline, kind: "currency" as const },
    { label: "Signals matched", value: stats.signalsMatched, kind: "plain" as const },
    { label: "Go verdicts", value: stats.goVerdicts, kind: "plain" as const },
    { label: "Pending review", value: stats.pendingReview, kind: "plain" as const },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className={`mb-8 flex flex-wrap items-end justify-between gap-4 ${ENTER}`}>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lost deals, second chances</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Closed-lost opportunities matched with live Sillage signals, scored and ready to
            re-engage.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RunLiveButton disabled={setupNeeded} />
          <AgentRunDialog disabled={setupNeeded} />
        </div>
      </div>

      {setupNeeded && (
        <div className="mb-8">
          <SetupBanner missing={missing} />
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((tile, index) => (
          <Card
            key={tile.label}
            className={`gap-1 py-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${ENTER}`}
            style={enterDelay(index + 1)}
          >
            <CardHeader className="pb-0">
              <CardDescription>{tile.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">
                <AnimatedNumber value={tile.value} kind={tile.kind} />
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.revivablePipeline > 0 && <RoiProjection revivablePipeline={stats.revivablePipeline} />}

      <CasesTable cases={cases} setupNeeded={setupNeeded} />

      <div className="mt-8 flex justify-end">
        <ResetDemoButton />
      </div>
    </main>
  );
}
