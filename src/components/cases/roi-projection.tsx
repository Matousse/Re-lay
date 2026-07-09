"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { AnimatedNumber } from "@/components/animated-number";
import { formatCurrency } from "@/lib/format";

const DEFAULT_RATE = 15;

// Turns the revivable pipeline into the number a CRO actually cares about:
// recovered revenue at a given win-back rate. The rep drags the rate; the
// recovered figure counts to the new total.
export function RoiProjection({ revivablePipeline }: { revivablePipeline: number }) {
  const [rate, setRate] = useState(DEFAULT_RATE);
  const recovered = Math.round((revivablePipeline * rate) / 100);

  return (
    <div className="from-primary/[0.07] mb-8 rounded-xl border bg-gradient-to-br to-transparent p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-5">
        <div>
          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <TrendingUp aria-hidden className="text-primary size-4" />
            Recoverable revenue
          </p>
          <p className="text-primary mt-1 text-4xl font-semibold tracking-tight tabular-nums">
            <AnimatedNumber value={recovered} kind="currency" />
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            at a {rate}% win-back on {formatCurrency(revivablePipeline)} of pipeline Re:lay revived
          </p>
        </div>

        <div className="w-full max-w-xs">
          <div className="mb-1.5 flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Win-back rate</span>
            <span className="text-foreground font-semibold tabular-nums">{rate}%</span>
          </div>
          <input
            type="range"
            min={5}
            max={40}
            step={5}
            value={rate}
            onChange={(event) => setRate(Number(event.target.value))}
            aria-label="Win-back rate"
            className="accent-primary h-1.5 w-full cursor-pointer"
          />
          <div className="text-muted-foreground/70 mt-1 flex justify-between text-[10px]">
            <span>5%</span>
            <span>conservative</span>
            <span>40%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
