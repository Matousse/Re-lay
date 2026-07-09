"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Animates its children open/closed by transitioning grid-template-rows, so
 * height changes morph instead of jumping. Content stays mounted either way.
 */
export function Collapse({
  open,
  className,
  children,
}: {
  open: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden={!open}
      className={cn(
        "grid transition-[grid-template-rows,opacity,transform] duration-500 ease-out motion-reduce:transition-none",
        open
          ? "translate-y-0 grid-rows-[1fr] opacity-100"
          : "translate-y-1 grid-rows-[0fr] opacity-0",
        className,
      )}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

/**
 * A Collapse that opens right after mount — new elements grow into the layout
 * instead of pushing it down in one frame.
 */
export function Reveal({ className, children }: { className?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <Collapse open={open} className={className}>
      {children}
    </Collapse>
  );
}
