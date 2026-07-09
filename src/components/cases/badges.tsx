import {
  ArrowLeftRight,
  Ban,
  Banknote,
  Check,
  Clock,
  MousePointerClick,
  ShieldAlert,
  Target,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CaseStatus, LossReason, SignalType, Verdict } from "@/types/reengagement";

const SIGNAL_META: Record<SignalType, { label: string; icon: typeof Banknote }> = {
  job_change: { label: "Job change", icon: ArrowLeftRight },
  funding: { label: "Funding", icon: Banknote },
  competitor_issue: { label: "Competitor issue", icon: ShieldAlert },
  hiring_surge: { label: "Hiring surge", icon: Users },
  exec_change: { label: "Exec change", icon: UserCog },
  site_revisit: { label: "Site revisit", icon: MousePointerClick },
};

export const LOSS_REASON_LABELS: Record<LossReason, string> = {
  price: "Price",
  competitor: "Lost to competitor",
  no_budget: "No budget",
  no_need: "No need",
  blocked_by_stakeholder: "Blocked by stakeholder",
  timing: "Bad timing",
};

const STATUS_META: Record<CaseStatus, { label: string; icon: typeof Check; className: string }> = {
  pending_review: {
    label: "Pending review",
    icon: Clock,
    className: "bg-amber-600/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400",
  },
  approved: {
    label: "Approved",
    icon: Check,
    className: "bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400",
  },
  rejected: {
    label: "Rejected",
    icon: X,
    className: "bg-muted text-muted-foreground",
  },
  no_go: {
    label: "No go",
    icon: Ban,
    className: "bg-muted text-muted-foreground",
  },
};

export function SignalBadge({ type }: { type: SignalType }) {
  const { label, icon: Icon } = SIGNAL_META[type];
  return (
    <Badge variant="outline">
      <Icon aria-hidden />
      {label}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: CaseStatus }) {
  const { label, icon: Icon, className } = STATUS_META[status];
  return (
    <Badge variant="secondary" className={className}>
      <Icon aria-hidden />
      {label}
    </Badge>
  );
}

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const go = verdict.decision === "go";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-sm font-semibold tabular-nums">{verdict.score}</span>
      <Badge
        variant="secondary"
        className={cn(
          go
            ? "bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400"
            : "bg-muted text-muted-foreground",
        )}
      >
        {go ? <Target aria-hidden /> : <Ban aria-hidden />}
        {go ? "GO" : "NO GO"}
      </Badge>
    </span>
  );
}
