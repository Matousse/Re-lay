"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { openMockSession } from "@/lib/session";

const MOCK_LATENCY_MS = 900;

/**
 * Demo-only sign-in: shows a pending state, toasts, then enters the app.
 * Swapped for real auth after the hackathon.
 */
export function useMockSignIn() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function signIn(message: string) {
    if (pending) return;
    setPending(true);
    timeoutRef.current = setTimeout(() => {
      openMockSession();
      toast.success(message);
      router.push("/");
    }, MOCK_LATENCY_MS);
  }

  return { pending, signIn };
}
