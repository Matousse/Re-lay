import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { ENTER } from "@/lib/motion";
import { onboardingStatus } from "@/services/onboarding";

export const metadata: Metadata = {
  title: "Onboarding — Re:lay",
};

// Teach Re:lay the company in four steps — the guided face of the same
// onboarding brain the assistant uses.
export default async function OnboardingPage() {
  const status = await onboardingStatus();

  return (
    <main className="relative mx-auto w-full max-w-4xl px-6 py-12">
      {/* Soft radial glow behind the header — premium without being loud. */}
      <div
        aria-hidden
        className="bg-primary/10 absolute -top-24 left-1/2 -z-10 size-96 -translate-x-1/2 rounded-full blur-3xl"
      />
      <div className={`mb-10 ${ENTER}`}>
        <p className="text-primary flex items-center gap-1.5 text-sm font-medium">
          <Sparkles aria-hidden className="size-4" />
          Two minutes, once
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Teach Re:lay your company</h1>
        <p className="text-muted-foreground mt-2 max-w-xl text-sm">
          Re:lay reads your website, learns what you sell and to whom, then routes every revived
          deal to the right human. The sharper this context, the sharper every play.
        </p>
      </div>
      <div className={ENTER} style={{ animationDelay: "120ms" }}>
        <OnboardingWizard initialStatus={status} />
      </div>
    </main>
  );
}
