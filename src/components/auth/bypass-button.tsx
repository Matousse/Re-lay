"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { openMockSession } from "@/lib/session";
import { ENTER, enterDelay } from "@/lib/motion";

export function BypassButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        openMockSession();
        router.push("/");
      }}
      className={`${buttonVariants({ variant: "outline" })} ${ENTER} fixed right-6 bottom-6 h-10 px-4 shadow-md backdrop-blur transition-all duration-300 hover:scale-[1.04] hover:shadow-lg active:scale-100`}
      style={enterDelay(6)}
    >
      Skip sign-in — open Re:lay
      <ArrowRight aria-hidden />
    </button>
  );
}
