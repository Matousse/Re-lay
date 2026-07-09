"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, Check, Loader2, Plug, X } from "lucide-react";
import { toast } from "sonner";
import { AnimatedCheck } from "@/components/animated-check";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { withBasePath } from "@/lib/base-path";
import { formatCurrency } from "@/lib/format";
import { CONNECTOR_LOGOS } from "@/lib/logos";
import { cn } from "@/lib/utils";
import type { ClosedLostAccount } from "@/types/pipeline";
import type {
  ClosedLostSyncData,
  DerivedPersona,
  SillageSyncEvent,
  SyncStep,
  SyncSummary,
} from "@/types/sillage-sync";

const SUCCESS_CLOSE_MS = 2200;

type Phase = "select" | "run" | "done";
type LiveStep = {
  step: SyncStep;
  label: string;
  status: "running" | "done" | "error";
  detail?: string;
};

async function fetchClosedLost(): Promise<ClosedLostSyncData> {
  const response = await fetch(withBasePath("/api/sillage/accounts"));
  if (!response.ok) throw new Error("Couldn't load closed-lost accounts from the CRM.");
  return response.json();
}

// Reads the NDJSON sync stream: step events feed the live timeline; the terminal
// `done` resolves with the summary, `error` rejects with the typed message.
async function streamSync(
  body: { domains: string[]; persona: DerivedPersona },
  onEvent: (event: SillageSyncEvent) => void,
): Promise<SyncSummary> {
  const response = await fetch(withBasePath("/api/sillage/sync"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok || !response.body) throw new Error("The Sillage sync request failed.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let summary: SyncSummary | null = null;
  let failure: string | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const event = JSON.parse(line) as SillageSyncEvent;
      if (event.type === "done") summary = event.summary;
      else if (event.type === "error") failure = event.message;
      else onEvent(event);
    }
  }
  if (failure) throw new Error(failure);
  if (!summary) throw new Error("The Sillage sync ended early.");
  return summary;
}

export function SillageConnectDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("select");
  const [discarded, setDiscarded] = useState<Set<string>>(new Set());
  const [personaEdits, setPersonaEdits] = useState<DerivedPersona | null>(null);
  const [steps, setSteps] = useState<LiveStep[]>([]);
  const [summary, setSummary] = useState<SyncSummary | null>(null);

  const query = useQuery({
    queryKey: ["sillage", "closed-lost"],
    queryFn: fetchClosedLost,
    enabled: open,
  });

  const accounts = query.data?.accounts ?? [];
  const persona = personaEdits ?? query.data?.persona ?? null;
  const keptDomains = accounts
    .filter((account) => !discarded.has(account.domain))
    .map((account) => account.domain);

  const sync = useMutation({
    mutationFn: () => {
      if (!persona) throw new Error("Persona not ready.");
      return streamSync({ domains: keptDomains, persona }, handleSyncEvent);
    },
    onSuccess: (result) => {
      setSummary(result);
      setPhase("done");
      router.refresh();
      window.setTimeout(() => setOpen(false), SUCCESS_CLOSE_MS);
    },
    onError: (error) => {
      setSteps((current) =>
        current.map((step) => (step.status === "running" ? { ...step, status: "error" } : step)),
      );
      toast.error(error instanceof Error ? error.message : "The Sillage sync failed.");
    },
  });

  function handleSyncEvent(event: SillageSyncEvent) {
    if (event.type === "step_start") {
      setSteps((current) => [
        ...current,
        { step: event.step, label: event.label, status: "running" },
      ]);
    }
    if (event.type === "step_end") {
      setSteps((current) =>
        current.map((step) =>
          step.step === event.step && step.status === "running"
            ? { ...step, status: event.ok ? "done" : "error", detail: event.detail }
            : step,
        ),
      );
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setPhase("select");
      setDiscarded(new Set());
      setPersonaEdits(null);
      setSteps([]);
      setSummary(null);
    }
  }

  function toggle(domain: string) {
    setDiscarded((current) => {
      const next = new Set(current);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  function startSync() {
    setSteps([]);
    setPhase("run");
    sync.mutate();
  }

  return (
    <>
      <Button size="sm" onClick={() => handleOpenChange(true)}>
        <Plug aria-hidden />
        Connect
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-md border bg-white shadow-sm">
                <Image src={CONNECTOR_LOGOS.sillage} alt="" width={16} height={16} />
              </span>
              Connect Sillage
            </DialogTitle>
            <DialogDescription>
              {phase === "done"
                ? "Your closed-lost accounts are now watched for revival signals."
                : "Review the closed-lost accounts from your CRM, then sync them to Sillage."}
            </DialogDescription>
          </DialogHeader>

          {phase === "select" && (
            <SelectStep
              query={query}
              accounts={accounts}
              discarded={discarded}
              persona={persona}
              onToggle={toggle}
              onPersona={setPersonaEdits}
              keptCount={keptDomains.length}
              onSync={startSync}
            />
          )}

          {phase === "run" && <RunStep steps={steps} />}

          {phase === "done" && summary && <DoneStep summary={summary} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SelectStep({
  query,
  accounts,
  discarded,
  persona,
  onToggle,
  onPersona,
  keptCount,
  onSync,
}: {
  query: ReturnType<typeof useQuery<ClosedLostSyncData>>;
  accounts: ClosedLostAccount[];
  discarded: Set<string>;
  persona: DerivedPersona | null;
  onToggle: (domain: string) => void;
  onPersona: (persona: DerivedPersona) => void;
  keptCount: number;
  onSync: () => void;
}) {
  if (query.isLoading) {
    return (
      <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
        <Loader2 aria-hidden className="size-4 animate-spin" />
        Reading closed-lost accounts…
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="space-y-3 py-6 text-center">
        <p className="text-destructive text-sm">{(query.error as Error).message}</p>
        <Button size="sm" variant="outline" onClick={() => query.refetch()}>
          Retry
        </Button>
      </div>
    );
  }
  if (accounts.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">
        No closed-lost accounts with a domain were found in your CRM.
      </p>
    );
  }

  // Sillage 422s the keyword agent without a persona, so require both axes here.
  const personaReady = Boolean(
    persona && persona.job_title.length > 0 && persona.location.length > 0,
  );

  return (
    <>
      <div className="-mx-1 flex-1 space-y-4 overflow-y-auto px-1">
        <div className="space-y-1.5">
          {accounts.map((account) => (
            <CompanyRow
              key={account.domain}
              account={account}
              kept={!discarded.has(account.domain)}
              onToggle={() => onToggle(account.domain)}
            />
          ))}
        </div>

        {persona && (
          <div className="bg-muted/30 space-y-3 rounded-lg border p-3">
            <p className="text-xs font-medium">
              Persona <span className="text-muted-foreground">— the ICP Sillage will target</span>
            </p>
            <ChipField
              label="Job titles"
              values={persona.job_title}
              onChange={(job_title) => onPersona({ ...persona, job_title })}
            />
            <ChipField
              label="Locations"
              values={persona.location}
              onChange={(location) => onPersona({ ...persona, location })}
            />
          </div>
        )}
      </div>

      {!personaReady && (
        <p className="text-muted-foreground mt-1 text-center text-xs">
          Add at least one job title and one location to the persona.
        </p>
      )}
      <Button className="mt-1 w-full" disabled={keptCount === 0 || !personaReady} onClick={onSync}>
        <Plug aria-hidden />
        Sync {keptCount} {keptCount === 1 ? "company" : "companies"} to Sillage
      </Button>
    </>
  );
}

function CompanyRow({
  account,
  kept,
  onToggle,
}: {
  account: ClosedLostAccount;
  kept: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={kept}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
        kept ? "border-primary/30 bg-primary/[0.03]" : "opacity-55 hover:opacity-100",
      )}
    >
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-md border",
          kept ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
        )}
      >
        {kept && <Check aria-hidden className="size-3.5" />}
      </span>
      <Building2 aria-hidden className="text-muted-foreground size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{account.company}</span>
        <span className="text-muted-foreground block truncate text-xs">{account.domain}</span>
      </span>
      {account.amount != null && (
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {formatCurrency(account.amount)}
        </span>
      )}
    </button>
  );
}

function ChipField({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const value = draft.trim();
    if (value && !values.includes(value)) onChange([...values, value]);
    setDraft("");
  }

  return (
    <div className="space-y-1.5">
      <label className="text-muted-foreground text-xs font-medium">{label}</label>
      <div className="flex flex-wrap items-center gap-1.5">
        {values.map((value) => (
          <Badge key={value} variant="secondary" className="gap-1 pr-1">
            {value}
            <button
              type="button"
              aria-label={`Remove ${value}`}
              onClick={() => onChange(values.filter((item) => item !== value))}
              className="hover:text-foreground text-muted-foreground"
            >
              <X aria-hidden className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add();
          }
        }}
        placeholder={`Add a ${label.slice(0, -1).toLowerCase()}…`}
        className="border-input focus-visible:ring-ring/50 h-8 w-full rounded-md border bg-transparent px-2.5 text-xs shadow-xs focus-visible:ring-[3px] focus-visible:outline-none"
      />
    </div>
  );
}

function RunStep({ steps }: { steps: LiveStep[] }) {
  return (
    <div className="space-y-2 py-2">
      {steps.map((step) => (
        <div
          key={step.step}
          className={cn(
            "flex items-center gap-2.5 rounded-lg border px-3 py-2",
            step.status === "running" && "border-primary/25",
            step.status === "error" && "border-destructive/25",
          )}
        >
          <StepStatus status={step.status} />
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                "block text-sm font-medium",
                step.status === "running" ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
            {step.detail && (
              <span className="text-muted-foreground block truncate text-xs">{step.detail}</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function StepStatus({ status }: { status: LiveStep["status"] }) {
  if (status === "running") {
    return <Loader2 aria-hidden className="text-primary size-4 animate-spin" />;
  }
  return (
    <span
      className={cn(
        "flex size-5 items-center justify-center rounded-full",
        status === "error"
          ? "bg-destructive/15 text-destructive"
          : "bg-emerald-600/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-400",
      )}
    >
      {status === "error" ? (
        <X aria-hidden className="size-3" />
      ) : (
        <Check aria-hidden className="size-3" />
      )}
    </span>
  );
}

function DoneStep({ summary }: { summary: SyncSummary }) {
  const runs = summary.runs.reduce((sum, run) => sum + run.signalRequestIds.length, 0);
  return (
    <div className="space-y-3 py-2 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400">
        <AnimatedCheck className="size-6" />
      </span>
      <div className="space-y-1">
        <p className="text-base font-medium">Sillage is live</p>
        <p className="text-muted-foreground text-sm">
          {summary.accounts.resolved} accounts watched · {summary.agents.length} agents · {runs}{" "}
          runs launched
        </p>
      </div>
    </div>
  );
}
