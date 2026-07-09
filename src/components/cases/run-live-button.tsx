"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, Loader2, Radar } from "lucide-react";
import { toast } from "sonner";
import { withBasePath } from "@/lib/base-path";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Signal } from "@/types/pipeline";
import type { ReengagementCase } from "@/types/reengagement";

const SIGNAL_TYPE_LABELS: Record<Signal["type"], string> = {
  new_decision_maker: "New decision maker",
  funding: "Funding round",
  site_revisit: "Website revisit",
  job_posting: "Key hire",
};

// Runs the real LangGraph pipeline (CRM + enrichment + LLM) on a chosen signal,
// then jumps to the generated case. This is the live counterpart to the
// AgentRunDialog, which replays a curated demo case.
export function RunLiveButton({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const signals = useQuery({
    queryKey: ["signals"],
    queryFn: async (): Promise<Signal[]> => {
      const res = await fetch(withBasePath("/api/signals"));
      if (!res.ok) throw new Error("Failed to load signals");
      return res.json();
    },
    enabled: open,
  });

  const run = useMutation({
    mutationFn: async (signalId: string): Promise<ReengagementCase> => {
      const res = await fetch(withBasePath("/api/pipeline/run"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signalId }),
      });
      if (res.status === 409)
        throw new Error("Connect every integration before running the agent.");
      if (res.status === 422)
        throw new Error("No matching closed-lost account for this signal — nothing to revive.");
      if (!res.ok) throw new Error("The pipeline run failed.");
      return res.json();
    },
    onSuccess: (data) => {
      setOpen(false);
      toast.success(
        `Agent ran on ${data.deal.company.name} — verdict: ${data.verdict.decision.toUpperCase()} (${data.verdict.score}).`,
      );
      router.push(withBasePath(`/cases/${data.id}`));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Run failed"),
  });

  return (
    <>
      <Button variant="outline" disabled={disabled} onClick={() => setOpen(true)}>
        <Radar aria-hidden />
        Run on a signal
      </Button>

      <Dialog open={open} onOpenChange={(next) => !run.isPending && setOpen(next)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Run the agent on a live signal</DialogTitle>
            <DialogDescription>
              The real pipeline qualifies the account in your CRM, analyses the loss, enriches the
              new contact and drafts the play.
            </DialogDescription>
          </DialogHeader>

          {signals.isLoading && (
            <p className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
              <Loader2 aria-hidden className="size-4 animate-spin" />
              Loading signals…
            </p>
          )}

          {signals.isError && (
            <p className="py-6 text-sm text-red-600 dark:text-red-400">
              Couldn&apos;t load signals. Is the signal source reachable?
            </p>
          )}

          {signals.data?.length === 0 && (
            <p className="text-muted-foreground py-6 text-sm">No signals available right now.</p>
          )}

          {signals.data && signals.data.length > 0 && (
            <ul className="space-y-2">
              {signals.data.map((signal) => {
                const running = run.isPending && run.variables === signal.id;
                return (
                  <li key={signal.id}>
                    <button
                      type="button"
                      disabled={run.isPending}
                      onClick={() => run.mutate(signal.id)}
                      className={cn(
                        "hover:border-ring hover:bg-accent/50 flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors disabled:opacity-60",
                        running && "border-ring bg-accent/50",
                      )}
                    >
                      <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-md">
                        {running ? (
                          <Loader2 aria-hidden className="size-4 animate-spin" />
                        ) : (
                          <Building2 aria-hidden className="text-muted-foreground size-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{signal.company}</span>
                          <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-xs">
                            {SIGNAL_TYPE_LABELS[signal.type]}
                          </span>
                        </span>
                        <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                          {signal.detail}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
