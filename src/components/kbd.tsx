import { cn } from "@/lib/utils";

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "bg-muted text-muted-foreground inline-flex h-4.5 min-w-4.5 items-center justify-center rounded border px-1 font-mono text-[10px]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
