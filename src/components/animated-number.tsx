"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { formatCurrency } from "@/lib/format";

const DURATION_MS = 900;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Renders a number that counts from its previously displayed value to the new
 * one whenever `value` changes. The very first render shows the value directly
 * so page loads stay calm — unless `from` is set, in which case the component
 * counts up from it on mount (used for reveal moments like the verdict score).
 */
export function AnimatedNumber({
  value,
  kind = "plain",
  from,
}: {
  value: number;
  kind?: "plain" | "currency";
  from?: number;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [displayed, setDisplayed] = useState(from ?? value);
  const displayedRef = useRef(from ?? value);
  const mountedRef = useRef(false);

  // Keep the ref in sync after each commit so an interrupted animation
  // restarts from what the user actually sees.
  useEffect(() => {
    displayedRef.current = displayed;
  });

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      if (from == null) return;
    }
    if (value === displayedRef.current) return;

    const startValue = displayedRef.current;
    const duration = reducedMotion ? 0 : DURATION_MS;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = duration === 0 ? 1 : Math.min((now - start) / duration, 1);
      setDisplayed(Math.round(startValue + (value - startValue) * easeOutCubic(t)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reducedMotion, from]);

  return <span>{kind === "currency" ? formatCurrency(displayed) : String(displayed)}</span>;
}
