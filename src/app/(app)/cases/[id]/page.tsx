import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, Radar, Sparkles, UserRound } from "lucide-react";
import {
  LOSS_REASON_LABELS,
  SignalBadge,
  StatusBadge,
  VerdictBadge,
} from "@/components/cases/badges";
import { DecisionPanel } from "@/components/cases/decision-panel";
import { ScoreBreakdown } from "@/components/cases/score-breakdown";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate, formatEnrichment } from "@/lib/format";
import { ENTER, enterDelay } from "@/lib/motion";
import { getCase } from "@/services/reengagement";
import type { OutreachAngle, Plan } from "@/types/reengagement";

// Normalizes a plan into the angle list the decision panel switches between:
// the recommended angle first (mirrored in plan.angle/emailDraft), then any
// alternatives the strategist surfaced.
function angleOptions(plan: Plan): OutreachAngle[] {
  return [
    {
      id: "recommended",
      label: plan.angleLabel ?? "Recommended angle",
      rationale: plan.angle,
      emailDraft: plan.emailDraft,
    },
    ...(plan.altAngles ?? []),
  ];
}

function NodeLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground font-mono text-[11px] tracking-widest uppercase">
      {children}
    </p>
  );
}

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reengagementCase = await getCase(id);
  if (!reengagementCase) notFound();

  const { deal, signal, autopsy, verdict, plan, status } = reengagementCase;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link
        href="/"
        className={`text-muted-foreground hover:text-foreground group mb-6 inline-flex items-center gap-1.5 text-sm transition-colors ${ENTER}`}
      >
        <ArrowLeft
          aria-hidden
          className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5"
        />
        All opportunities
      </Link>

      <div className={`mb-8 flex flex-wrap items-start justify-between gap-4 ${ENTER}`}>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{deal.company.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {formatCurrency(deal.amount)} · {LOSS_REASON_LABELS[deal.lossReason]} ·{" "}
            {formatDate(deal.lostAt)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <VerdictBadge verdict={verdict} />
          <StatusBadge status={status} />
        </div>
      </div>

      <div className="space-y-6">
        <Card className={ENTER} style={enterDelay(1)}>
          <CardHeader>
            <NodeLabel>signal · sillage</NodeLabel>
            <CardTitle className="flex items-center gap-2 text-base">
              <Radar aria-hidden className="size-4" />
              {signal.title}
            </CardTitle>
            <CardDescription>
              {signal.source} · {formatDate(signal.detectedAt)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{signal.description}</p>
            <SignalBadge type={signal.type} />
          </CardContent>
        </Card>

        <Card className={ENTER} style={enterDelay(2)}>
          <CardHeader>
            <NodeLabel>analyst · why was this deal lost?</NodeLabel>
            <CardTitle className="text-base">Deal autopsy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{autopsy.summary}</p>
            <ul className="text-muted-foreground list-disc space-y-1 pl-5">
              {autopsy.lossFactors.map((factor) => (
                <li key={factor}>{factor}</li>
              ))}
            </ul>
            <Separator />
            <p className="text-muted-foreground">
              Previous contact: <span className="text-foreground">{deal.previousContact.name}</span>{" "}
              ({deal.previousContact.role}) — “{deal.lossNotes}”
            </p>
          </CardContent>
        </Card>

        <Card className={ENTER} style={enterDelay(3)}>
          <CardHeader>
            <NodeLabel>go / no-go · signal × loss reason</NodeLabel>
            <CardTitle className="text-base">Re-engagement verdict</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>{verdict.reasoning}</p>
            <Separator />
            <ScoreBreakdown verdict={verdict} />
          </CardContent>
        </Card>

        {plan && (
          <Card className={ENTER} style={enterDelay(4)}>
            <CardHeader>
              <NodeLabel>researcher + strategist · the play</NodeLabel>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles aria-hidden className="size-4" />
                Re-engagement plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="bg-muted/50 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border p-4">
                <span className="inline-flex items-center gap-2 font-medium">
                  <UserRound aria-hidden className="text-muted-foreground size-4" />
                  {plan.targetContact.name} · {plan.targetContact.role}
                </span>
                <span className="text-muted-foreground inline-flex items-center gap-1.5">
                  <Mail aria-hidden className="size-3.5" />
                  {plan.targetContact.email}
                </span>
                {plan.targetContact.phone && (
                  <span className="text-muted-foreground inline-flex items-center gap-1.5">
                    <Phone aria-hidden className="size-3.5" />
                    {plan.targetContact.phone}
                  </span>
                )}
                <span className="text-muted-foreground w-full text-xs">
                  Enriched via {formatEnrichment(plan.targetContact.enrichment.providersTried)}
                </span>
              </div>

              <div>
                <p className="mb-1 font-medium">Talking points</p>
                <ul className="text-muted-foreground list-disc space-y-1 pl-5">
                  {plan.talkingPoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>

              <DecisionPanel
                caseId={reengagementCase.id}
                status={status}
                angles={angleOptions(plan)}
                editedEmail={reengagementCase.editedEmail}
                approvedAngleLabel={reengagementCase.approvedAngleLabel}
                companyName={deal.company.name}
                contactName={plan.targetContact.name}
                opportunityId={deal.id}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
