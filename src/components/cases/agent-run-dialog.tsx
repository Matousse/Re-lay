"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  Ban,
  Check,
  Database,
  FileText,
  Mail,
  Radar,
  Search,
  Sparkles,
  Split,
  Target,
  X,
} from "lucide-react";
import { AnimatedCheck } from "@/components/animated-check";
import { AnimatedNumber } from "@/components/animated-number";
import { LOSS_REASON_LABELS } from "@/components/cases/badges";
import { PipelineGraph } from "@/components/cases/pipeline-graph";
import { Collapse, Reveal } from "@/components/collapse";
import { Typewriter } from "@/components/typewriter";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { formatCurrency, formatDate } from "@/lib/format";
import { withBasePath } from "@/lib/base-path";
import { CONNECTOR_LOGOS } from "@/lib/logos";
import { SCORE_FORMULA } from "@/lib/score";
import { cn } from "@/lib/utils";
import type { ReengagementCase } from "@/types/reengagement";

const WATERFALL_TICK_MS = 650;

type Tool = { logo?: string; label: string };

type StepDef = {
  title: string;
  tool: Tool;
  icon: typeof Radar;
  runningLabel: string;
  /** Rich steps (score count-up, waterfall, typewriter) render while running; plain text steps only reveal once done. */
  revealDuringRun?: boolean;
  render: (phase: "running" | "done") => React.ReactNode;
};

/**
 * Per-step run durations in ms; `undefined` marks the strategist step, which
 * advances when its typewriter finishes instead of on a timer.
 */
function getStepDurations(c: ReengagementCase): (number | undefined)[] {
  const providersTried = c.plan?.targetContact.enrichment.providersTried ?? 1;
  return [1100, 1400, 1900, 1800, providersTried * WATERFALL_TICK_MS + 900, undefined];
}

/**
 * Timeline tile: the tool the node talks to (real vendor logo, sparkles for
 * the LLM) with the node's own icon as a small sub-badge, bottom right.
 */
function StepIcon({
  tool,
  icon: Icon,
  running,
}: {
  tool: Tool;
  icon: typeof Radar;
  running: boolean;
}) {
  return (
    <span
      className={cn(
        "bg-background relative z-10 mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl shadow-xs ring-1 transition-all duration-500",
        running ? "ring-primary/40" : "ring-border",
      )}
    >
      {tool.logo ? (
        <Image src={tool.logo} alt={tool.label} width={18} height={18} className="rounded-[4px]" />
      ) : (
        <Sparkles aria-hidden className="text-primary size-4.5" />
      )}
      <span
        aria-hidden
        className={cn(
          "bg-background absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full ring-1 transition-colors duration-500",
          running ? "ring-primary/40 text-primary" : "ring-border text-muted-foreground",
        )}
      >
        <Icon className="size-2.5" />
      </span>
    </span>
  );
}

/** Right-hand status of a step card: spinner while running, check once done. */
function StepStatus({ running }: { running: boolean }) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full transition-colors duration-500",
        running
          ? "text-primary"
          : "bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400",
      )}
    >
      {running ? (
        <span
          aria-hidden
          className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        <AnimatedCheck className="size-3" />
      )}
    </span>
  );
}

function WaterfallChips({
  providersTried,
  phase,
}: {
  providersTried: number;
  phase: "running" | "done";
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [shown, setShown] = useState(phase === "done" || reducedMotion ? providersTried : 0);

  useEffect(() => {
    if (phase === "done" || reducedMotion) {
      const frame = requestAnimationFrame(() => setShown(providersTried));
      return () => cancelAnimationFrame(frame);
    }
    const interval = setInterval(() => {
      setShown((count) => {
        const next = Math.min(count + 1, providersTried);
        if (next >= providersTried) clearInterval(interval);
        return next;
      });
    }, WATERFALL_TICK_MS);
    return () => clearInterval(interval);
  }, [phase, providersTried, reducedMotion]);

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {Array.from({ length: shown }, (_, index) => {
        const found = index + 1 === providersTried;
        return (
          <Badge
            key={index}
            variant="secondary"
            className={cn(
              "animate-in fade-in slide-in-from-left-1 motion-reduce:animate-none",
              found
                ? "bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400"
                : "bg-muted text-muted-foreground",
            )}
          >
            {found ? <Check aria-hidden /> : <X aria-hidden />}
            Provider {index + 1}
            {found && " · email + mobile found"}
          </Badge>
        );
      })}
    </span>
  );
}

function buildSteps(c: ReengagementCase, onEmailDrafted: () => void): StepDef[] {
  const providersTried = c.plan?.targetContact.enrichment.providersTried ?? 1;
  return [
    {
      title: "Signal",
      tool: { logo: CONNECTOR_LOGOS.sillage, label: "Sillage" },
      icon: Radar,
      runningLabel: "Listening to Sillage…",
      render: () => (
        <p>
          {c.signal.title} — {c.signal.source}
        </p>
      ),
    },
    {
      title: "Qualify",
      tool: { logo: CONNECTOR_LOGOS.hubspot, label: "HubSpot" },
      icon: Database,
      runningLabel: "Searching the CRM for this account…",
      render: () => (
        <p>
          {c.deal.company.name} found in CRM — closed-lost {formatDate(c.deal.lostAt)} ·{" "}
          {formatCurrency(c.deal.amount)} · {LOSS_REASON_LABELS[c.deal.lossReason].toLowerCase()}
        </p>
      ),
    },
    {
      title: "Analyst",
      tool: { label: "LLM" },
      icon: FileText,
      runningLabel: "Reading the deal history — why was it lost?",
      render: () => <p>{c.autopsy.summary}</p>,
    },
    {
      title: "Go / no-go",
      tool: { label: "LLM" },
      icon: Split,
      runningLabel: "Scoring the match between signal and loss reason…",
      revealDuringRun: true,
      render: () => {
        const go = c.verdict.decision === "go";
        return (
          <span className="block space-y-1">
            <span className="flex items-center gap-3">
              <span className="text-3xl font-semibold tracking-tight tabular-nums">
                <AnimatedNumber from={0} value={c.verdict.score} />
                <span className="text-muted-foreground text-sm font-normal">/100</span>
              </span>
              <Badge
                variant="secondary"
                className={cn(
                  "animate-in fade-in zoom-in-75 fill-mode-both delay-700 duration-500 motion-reduce:animate-none",
                  go
                    ? "bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {go ? <Target aria-hidden /> : <Ban aria-hidden />}
                {go ? "GO" : "NO GO"}
              </Badge>
            </span>
            <span className="text-muted-foreground/80 animate-in fade-in fill-mode-both block font-mono text-[10px] delay-1000 duration-500 motion-reduce:animate-none">
              {SCORE_FORMULA}
            </span>
          </span>
        );
      },
    },
    {
      title: "Researcher",
      tool: { logo: CONNECTOR_LOGOS.fullenrich, label: "FullEnrich" },
      icon: Search,
      runningLabel: "Running the enrichment waterfall…",
      revealDuringRun: true,
      render: (phase) =>
        c.plan ? (
          <span className="space-y-1.5">
            <WaterfallChips providersTried={providersTried} phase={phase} />
            {phase === "done" && (
              <p className="animate-in fade-in motion-reduce:animate-none">
                {c.plan.targetContact.name} ({c.plan.targetContact.role}) —{" "}
                {c.plan.targetContact.email}
              </p>
            )}
          </span>
        ) : (
          <p>No outreach target — case closed as no-go.</p>
        ),
    },
    {
      title: "Strategist",
      tool: { label: "LLM" },
      icon: Sparkles,
      runningLabel: "Drafting the re-engagement play…",
      revealDuringRun: true,
      render: (phase) =>
        c.plan ? (
          <span className="bg-background/80 block overflow-hidden rounded-lg border shadow-xs">
            <span className="text-muted-foreground bg-muted/40 flex items-center gap-1.5 border-b px-3 py-1.5 font-mono text-[10px] tracking-wide">
              <Mail aria-hidden className="size-3" />
              To · {c.plan.targetContact.name} — {c.plan.targetContact.email}
            </span>
            <span className="block p-3">
              <span className="mb-1 block font-medium">{c.plan.emailDraft.subject}</span>
              {phase === "running" ? (
                <Typewriter
                  text={c.plan.emailDraft.body}
                  onDone={onEmailDrafted}
                  className="text-muted-foreground"
                />
              ) : (
                <span className="text-muted-foreground whitespace-pre-wrap">
                  {c.plan.emailDraft.body}
                </span>
              )}
            </span>
          </span>
        ) : (
          <p>Skipped.</p>
        ),
    },
  ];
}

export function AgentRunDialog({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const simulation = useMutation({
    mutationFn: async (): Promise<ReengagementCase> => {
      const response = await fetch(withBasePath("/api/demo"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "simulate" }),
      });
      if (!response.ok) throw new Error("Simulation failed");
      return response.json();
    },
    onSuccess: () => router.refresh(),
  });

  const steps = simulation.data
    ? buildSteps(simulation.data, () => setProgress((value) => Math.max(value, 6)))
    : [];
  const finished = steps.length > 0 && progress >= steps.length;

  // Fixed-duration steps advance on their own timer; the strategist step
  // (undefined duration) advances through the typewriter's onDone callback.
  const simulatedCase = simulation.data;
  useEffect(() => {
    if (!open || !simulatedCase) return;
    const duration = getStepDurations(simulatedCase)[progress];
    if (duration == null) return;
    const timeout = setTimeout(() => setProgress((value) => value + 1), duration);
    return () => clearTimeout(timeout);
  }, [open, simulatedCase, progress]);

  // Follow the bottom while cards grow in (typewriter included); hand the
  // scroll back to the user once the run is over.
  useEffect(() => {
    if (!open || finished) return;
    const interval = setInterval(() => {
      const element = scrollRef.current;
      element?.scrollTo({
        top: element.scrollHeight,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    }, 400);
    return () => clearInterval(interval);
  }, [open, finished, reducedMotion]);

  function start() {
    setProgress(0);
    simulation.reset();
    setOpen(true);
    simulation.mutate();
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) router.refresh();
  }

  return (
    <>
      <Button
        onClick={start}
        disabled={disabled}
        title={disabled ? "Connect your integrations first" : undefined}
        className="hover:shadow-primary/25 transition-all duration-300 hover:scale-[1.03] hover:shadow-lg active:scale-100"
      >
        <Radar aria-hidden />
        Simulate incoming signal
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
                <Radar aria-hidden className="size-4" />
              </span>
              Incoming signal
            </DialogTitle>
            <DialogDescription>
              Re:lay agent pipeline — every node below is a LangGraph node, live.
            </DialogDescription>
          </DialogHeader>

          <div className="from-muted/60 to-muted/10 rounded-xl border bg-gradient-to-b px-3 pt-2 pb-1">
            <div className="text-muted-foreground flex items-center justify-between px-1 pt-1 font-mono text-[10px] tracking-widest uppercase">
              <span>Agent pipeline</span>
              <span className="flex items-center gap-1.5 normal-case">
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 rounded-full",
                    finished
                      ? "bg-emerald-500"
                      : "bg-primary animate-pulse motion-reduce:animate-none",
                  )}
                />
                {finished ? "run complete" : "executing"}
              </span>
            </div>
            <PipelineGraph currentStep={progress} />
          </div>

          <div ref={scrollRef} className="max-h-[46vh] space-y-4 overflow-y-auto">
            <ol className="before:bg-border/70 relative space-y-2 before:absolute before:top-3 before:bottom-3 before:left-[21.5px] before:w-px">
              {steps.slice(0, progress + 1).map((step, index) => {
                const running = index === progress;
                return (
                  <li key={step.title}>
                    <Reveal>
                      {/* px-1: Reveal clips overflow for its height animation,
                          the padding keeps the tile's ring inside the clip box. */}
                      <div className="flex gap-3 px-1">
                        <StepIcon tool={step.tool} icon={step.icon} running={running} />
                        <div
                          className={cn(
                            "min-w-0 flex-1 rounded-xl border px-3.5 py-3 transition-colors duration-500",
                            running ? "border-primary/40 bg-primary/[0.03]" : "bg-card",
                          )}
                        >
                          <p className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">
                              {step.title}
                              <span className="text-muted-foreground font-normal">
                                {" "}
                                · {step.tool.label}
                              </span>
                            </span>
                            <StepStatus running={running} />
                          </p>
                          <Collapse open={running}>
                            <p className="text-muted-foreground animate-pulse pt-1 text-sm italic">
                              {step.runningLabel}
                            </p>
                          </Collapse>
                          <Collapse open={!running || step.revealDuringRun === true}>
                            <div className="pt-1 text-sm leading-relaxed">
                              {step.render(running ? "running" : "done")}
                            </div>
                          </Collapse>
                        </div>
                      </div>
                    </Reveal>
                  </li>
                );
              })}
            </ol>
          </div>

          {simulation.isPending && (
            <Reveal>
              <p className="text-muted-foreground text-sm">Listening to Sillage…</p>
            </Reveal>
          )}
          {simulation.isError && (
            <Reveal>
              <p className="text-destructive text-sm">Simulation failed — try again.</p>
            </Reveal>
          )}

          {finished && simulation.data && (
            <Reveal>
              <div className="flex items-center justify-between gap-3 border-t pt-4">
                <Badge
                  variant="secondary"
                  className="bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400"
                >
                  <Check aria-hidden />
                  Play ready — waiting for human review
                </Badge>
                <Link href={`/cases/${simulation.data.id}`} className={buttonVariants()}>
                  Open the play
                  <ArrowRight aria-hidden />
                </Link>
              </div>
            </Reveal>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
