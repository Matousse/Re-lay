import { cn } from "@/lib/utils";
import { initialsOf } from "@/types/workspace";

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
