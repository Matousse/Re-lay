"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { withBasePath } from "@/lib/base-path";
import { Button } from "@/components/ui/button";
import { closeMockSession } from "@/lib/session";

export function ResetDemoButton() {
  const router = useRouter();

  const reset = useMutation({
    mutationFn: async () => {
      const response = await fetch(withBasePath("/api/demo"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      if (!response.ok) throw new Error("Reset failed");
    },
    onSuccess: () => {
      closeMockSession();
      toast("Demo reset — back to the start.");
      router.push("/login");
    },
  });

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground"
      onClick={() => reset.mutate()}
      disabled={reset.isPending}
    >
      <RotateCcw aria-hidden />
      Reset demo
    </Button>
  );
}
