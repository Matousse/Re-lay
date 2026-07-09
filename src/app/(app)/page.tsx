import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
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
import { hasCompanyContext } from "@/services/onboarding";
import { getStats, listCases } from "@/services/reengagement";

export default async function Home() {
  const [stats, cases, missing, knowsCompany] = await Promise.all([
    getStats(),
    listCases(),
    missingConnectors(),
    hasCompanyContext(),
  ]);
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

      {!setupNeeded && !knowsCompany && (
        <Link
          href="/onboarding"
          className={`group animate-relay-cta-glow relative mb-8 flex items-center justify-between gap-4 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 px-4 py-3 text-white transition-transform duration-300 hover:scale-[1.01] ${ENTER}`}
          style={enterDelay(1)}
        >
          {/* Periodic sheen sweeping across the banner. */}
          <span
            aria-hidden
            className="animate-relay-sheen pointer-events-none absolute inset-y-0 left-0 w-24 bg-white/20 blur-md"
          />
          <div className="relative flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/30">
              <Sparkles aria-hidden className="size-4 animate-pulse text-white" />
            </span>
            <div>
              <p className="text-sm font-semibold">Teach Re:lay your company — two minutes</p>
              <p className="text-xs text-white/85">
                It reads your website, learns your ICP and routes the plays to the right human.
              </p>
            </div>
          </div>
          <span className="relative flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/30 transition-all duration-300 group-hover:bg-white/25">
            Start
            <ArrowRight
              aria-hidden
              className="size-3.5 transition-transform duration-300 group-hover:translate-x-1"
            />
          </span>
        </Link>
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
