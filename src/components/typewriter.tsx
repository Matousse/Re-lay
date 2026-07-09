"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

const TICK_MS = 30;
const CHARS_PER_TICK = 4;

/**
 * Streams `text` in character by character, LLM style. Calls `onDone` once
 * fully revealed. With reduced motion, reveals instantly.
 */
export function Typewriter({
  text,
  onDone,
  className,
}: {
  text: string;
  onDone?: () => void;
  className?: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [visibleChars, setVisibleChars] = useState(0);
  const onDoneRef = useRef(onDone);
  const done = visibleChars >= text.length;

  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    if (reducedMotion) {
      const frame = requestAnimationFrame(() => setVisibleChars(text.length));
      return () => cancelAnimationFrame(frame);
    }
    const interval = setInterval(() => {
      setVisibleChars((count) => {
        const next = Math.min(count + CHARS_PER_TICK, text.length);
        if (next >= text.length) clearInterval(interval);
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [text, reducedMotion]);

  useEffect(() => {
    if (done) onDoneRef.current?.();
  }, [done]);

  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      {text.slice(0, visibleChars)}
      {!done && (
        <span
          aria-hidden
          className="bg-foreground/70 ml-px inline-block h-[1em] w-[2px] animate-pulse align-text-bottom"
        />
      )}
    </span>
  );
}
