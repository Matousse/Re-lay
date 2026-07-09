"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, PartyPopper, Radar, SearchX } from "lucide-react";
import {
  LOSS_REASON_LABELS,
  SignalBadge,
  StatusBadge,
  VerdictBadge,
} from "@/components/cases/badges";
import { ScoreBreakdown } from "@/components/cases/score-breakdown";
import { Collapse } from "@/components/collapse";
import { Kbd } from "@/components/kbd";
import { Card, CardContent } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { formatCurrency, formatDate } from "@/lib/format";
import { ENTER, enterDelay } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { CaseStatus, ReengagementCase } from "@/types/reengagement";

const NEW_ROW_HIGHLIGHT_MS = 2500;

const STATUS_FILTERS: { value: CaseStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending_review", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "no_go", label: "No go" },
];

// Shared column template so the header and every row stay aligned.
const ROW_GRID = "grid grid-cols-[1.5fr_0.7fr_1.2fr_1fr_0.95fr_1fr_2rem] items-center gap-3";

export function CasesTable({
  cases,
  setupNeeded = false,
}: {
  cases: ReengagementCase[];
  setupNeeded?: boolean;
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<CaseStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [newCaseId, setNewCaseId] = useState<string | null>(null);
  const knownIdsRef = useRef<Set<string> | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  const matches = (c: ReengagementCase) =>
    (statusFilter === "all" || c.status === statusFilter) &&
    c.deal.company.name.toLowerCase().includes(search.toLowerCase().trim());

  // Every case stays mounted; filtering only collapses rows, so surviving rows
  // never re-run their entrance animation.
  const visible = cases.filter(matches);
  const selected = Math.min(selectedIndex, visible.length - 1);
  const selectedId = selected >= 0 ? visible[selected]?.id : undefined;

  const inboxZero = cases.length > 0 && cases.every((c) => c.status !== "pending_review");

  // Flash a case that just landed (e.g. from a live signal run).
  useEffect(() => {
    const ids = new Set(cases.map((c) => c.id));
    const previous = knownIdsRef.current;
    knownIdsRef.current = ids;
    if (!previous) return;
    const fresh = cases.find((c) => !previous.has(c.id));
    if (!fresh) return;
    const frame = requestAnimationFrame(() => setNewCaseId(fresh.id));
    const timeout = setTimeout(() => setNewCaseId(null), NEW_ROW_HIGHLIGHT_MS);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [cases]);

  useShortcuts({
    j: () => setSelectedIndex(Math.min(selected + 1, visible.length - 1)),
    k: () => setSelectedIndex(Math.max(selected - 1, 0)),
    enter: () => {
      const current = visible[selected];
      if (current) router.push(`/cases/${current.id}`);
    },
  });

  useEffect(() => {
    if (selectedId) rowRefs.current.get(selectedId)?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  if (cases.length === 0) {
    return (
      <Card className={`py-14 ${ENTER}`} style={enterDelay(6)}>
        <CardContent className="flex flex-col items-center gap-3 text-center">
          <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
            <Radar aria-hidden className="size-5" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {setupNeeded ? "Your pipeline is offline." : "No signals matched yet."}
            </p>
            <p className="text-muted-foreground max-w-sm text-sm">
              {setupNeeded
                ? "Finish connecting your stack above — matched signals will land here the moment Re:lay is online."
                : "Re:lay is watching your closed-lost accounts. The next opening will show up here."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {inboxZero && (
        <Card className="animate-in fade-in slide-in-from-top-1 border-emerald-600/30 bg-emerald-600/5 py-4 duration-500 motion-reduce:animate-none dark:border-emerald-400/20 dark:bg-emerald-400/5">
          <CardContent className="flex items-center gap-3">
            <PartyPopper aria-hidden className="size-5 text-emerald-700 dark:text-emerald-400" />
            <div>
              <p className="text-sm font-medium">All signals handled.</p>
              <p className="text-muted-foreground text-sm">
                Re:lay keeps watching your closed-lost accounts — the next opening will show up
                here.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div
        className={`flex flex-wrap items-center justify-between gap-3 ${ENTER}`}
        style={enterDelay(5)}
      >
        <Tabs
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as CaseStatus | "all")}
        >
          <TabsList>
            {STATUS_FILTERS.map((filter) => (
              <TabsTrigger key={filter.value} value={filter.value}>
                {filter.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search company…"
          aria-label="Search company"
          className="max-w-52"
        />
      </div>

      <Card className={`gap-0 overflow-hidden py-0 ${ENTER}`} style={enterDelay(6)}>
        <div className={`${ROW_GRID} text-muted-foreground border-b px-6 py-3 text-sm font-medium`}>
          <span>Company</span>
          <span>Deal</span>
          <span>Lost</span>
          <span>Signal</span>
          <span>Verdict</span>
          <span>Status</span>
          <span />
        </div>

        {cases.map((c, index) => {
          const open = matches(c);
          return (
            <div
              key={c.id}
              className={ENTER}
              style={{ animationDelay: `${640 + Math.min(index * 45, 360)}ms` }}
            >
              <Collapse open={open}>
                <div
                  ref={(row) => {
                    if (row) rowRefs.current.set(c.id, row);
                    else rowRefs.current.delete(c.id);
                  }}
                  onMouseEnter={() => {
                    const visibleIndex = visible.findIndex((v) => v.id === c.id);
                    if (visibleIndex >= 0) setSelectedIndex(visibleIndex);
                  }}
                  className={cn(
                    ROW_GRID,
                    "group relative border-b px-6 py-3 transition-colors duration-700",
                    c.id === selectedId && "bg-muted/50 duration-150",
                    c.id === newCaseId && "bg-primary/5",
                  )}
                >
                  <span>
                    <Link
                      href={`/cases/${c.id}`}
                      className="font-medium after:absolute after:inset-0"
                    >
                      {c.deal.company.name}
                    </Link>
                    <span className="text-muted-foreground block text-xs">
                      {c.deal.company.industry}
                    </span>
                  </span>
                  <span className="text-sm tabular-nums">{formatCurrency(c.deal.amount)}</span>
                  <span>
                    <span className="block text-sm">{LOSS_REASON_LABELS[c.deal.lossReason]}</span>
                    <span className="text-muted-foreground block text-xs">
                      {formatDate(c.deal.lostAt)}
                    </span>
                  </span>
                  <span>
                    <SignalBadge type={c.signal.type} />
                  </span>
                  <span>
                    <HoverCard>
                      <HoverCardTrigger
                        render={
                          <button
                            type="button"
                            aria-label={`Score breakdown for ${c.deal.company.name}`}
                            className="relative z-10 cursor-help rounded-md"
                          />
                        }
                      >
                        <VerdictBadge verdict={c.verdict} />
                      </HoverCardTrigger>
                      <HoverCardContent className="w-72">
                        <ScoreBreakdown verdict={c.verdict} compact />
                      </HoverCardContent>
                    </HoverCard>
                  </span>
                  <span>
                    <StatusBadge status={c.status} />
                  </span>
                  <span className="text-right">
                    <ChevronRight
                      aria-hidden
                      className="text-muted-foreground inline size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    />
                  </span>
                </div>
              </Collapse>
            </div>
          );
        })}

        <Collapse open={visible.length === 0}>
          <div className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-sm">
            <SearchX aria-hidden className="size-5" />
            No opportunity matches these filters.
          </div>
        </Collapse>
      </Card>

      <p className={`text-muted-foreground text-right text-xs ${ENTER}`} style={enterDelay(10)}>
        <Kbd>J</Kbd> <Kbd>K</Kbd> to navigate · <Kbd>↵</Kbd> to open · hover a score for the
        breakdown
      </p>
    </div>
  );
}
