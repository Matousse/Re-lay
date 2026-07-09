import { cn } from "@/lib/utils";

/**
 * A check mark whose stroke draws itself in (CSS `draw-check` keyframes,
 * disabled under prefers-reduced-motion — see globals.css).
 */
export function AnimatedCheck({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("size-4", className)}
    >
      <path d="M20 6 9 17l-5-5" pathLength={1} className="animate-draw-check" />
    </svg>
  );
}
