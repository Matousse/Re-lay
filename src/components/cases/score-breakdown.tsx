import { SCORE_FACTORS, SCORE_FORMULA } from "@/lib/score";
import { cn } from "@/lib/utils";
import type { Verdict } from "@/types/reengagement";

/**
 * Why this score: one row per weighted factor, with a magnitude meter.
 * `compact` drops the notes for tight surfaces like the table hover card.
 */
export function ScoreBreakdown({
  verdict,
  compact = false,
}: {
  verdict: Verdict;
  compact?: boolean;
}) {
  return (
    <div className={cn("space-y-3", compact && "space-y-2.5")}>
      {SCORE_FACTORS.map((factor) => {
        const { score, note } = verdict.factors[factor.key];
        return (
          <div key={factor.key} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className={cn("font-medium", compact ? "text-xs" : "text-sm")}>
                {factor.label}
                <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                  ×{factor.weight.toFixed(1).replace("0.", ".")}
                </span>
              </p>
              <p className={cn("tabular-nums", compact ? "text-xs" : "text-sm")}>{score}</p>
            </div>
            <div
              role="meter"
              aria-valuenow={score}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${factor.label}: ${score} out of 100`}
              className="bg-primary/15 h-1.5 overflow-hidden rounded-full"
            >
              <div className="bg-primary h-full rounded-full" style={{ width: `${score}%` }} />
            </div>
            {!compact && <p className="text-muted-foreground text-xs">{note}</p>}
          </div>
        );
      })}
      <p className="text-muted-foreground text-xs">Score = {SCORE_FORMULA}.</p>
    </div>
  );
}
