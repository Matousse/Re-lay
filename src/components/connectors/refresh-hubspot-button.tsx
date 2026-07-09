"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Re-runs the server component (and its live HubSpot probe) so the card drops
// anything deleted in the portal since the last render — companies, deals,
// contacts. No client cache to bust: router.refresh() re-fetches server-side.
export function RefreshHubspotButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending) toast.success("HubSpot connection refreshed.");
    wasPending.current = isPending;
  }, [isPending]);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground h-7 gap-1.5 px-2 text-xs"
      disabled={isPending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RefreshCw aria-hidden className={cn("size-3.5", isPending && "animate-spin")} />
      Refresh
    </Button>
  );
}
