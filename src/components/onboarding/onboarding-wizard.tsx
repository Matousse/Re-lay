"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  AtSign,
  BookOpen,
  Building2,
  Check,
  Globe,
  Loader2,
  Sparkles,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatedCheck } from "@/components/animated-check";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";
import type { OnboardingStatus, DraftContext } from "@/services/onboarding";

// The onboarding wizard: teach Re:lay the company in four animated steps.
// Same brain as the assistant's onboarding tools (services/onboarding.ts) —
// this is the guided, visual face of it.

type StepId = 0 | 1 | 2 | 3;

const STEPS = [
  { title: "Your company", detail: "Point Re:lay at your website" },
  { title: "What Re:lay understood", detail: "Confirm the offering, ICP and stakes" },
  { title: "Route the plays", detail: "Who gets pinged when a deal wakes up" },
  { title: "Ready", detail: "Your workspace, checked live" },
] as const;

// Cosmetic status line cycling while Claude reads the site.
const SCAN_PHRASES = [
  "Reading the website…",
  "Understanding the offering…",
  "Mapping who you sell to…",
  "Extracting the stakes…",
];

async function postOnboarding<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch(withBasePath("/api/onboarding"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Request failed");
  return payload as T;
}

function ProgressRail({ current }: { current: StepId }) {
  return (
    <ol className="space-y-0">
      {STEPS.map((step, index) => {
        const state = index < current ? "done" : index === current ? "active" : "todo";
        return (
          <li key={step.title} className="relative flex gap-4 pb-8 last:pb-0">
            {index < STEPS.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-8 left-[15px] h-[calc(100%-2rem)] w-px transition-colors duration-500",
                  state === "done" ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <span
              className={cn(
                "z-10 flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-all duration-500",
                state === "done" && "border-primary bg-primary text-primary-foreground",
                state === "active" &&
                  "border-primary text-primary shadow-primary/20 bg-background scale-110 shadow-lg",
                state === "todo" && "text-muted-foreground bg-background",
              )}
            >
              {state === "done" ? <Check aria-hidden className="size-4" /> : index + 1}
            </span>
            <div className="pt-1">
              <p
                className={cn(
                  "text-sm font-medium transition-colors",
                  state === "todo" && "text-muted-foreground",
                )}
              >
                {step.title}
              </p>
              <p className="text-muted-foreground text-xs">{step.detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ScanningState({ url }: { url: string }) {
  const [phrase, setPhrase] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setPhrase((value) => (value + 1) % SCAN_PHRASES.length), 1800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="animate-in fade-in flex flex-col items-center gap-4 py-10 text-center duration-300">
      <span className="relative flex size-16 items-center justify-center">
        <span className="bg-primary/20 absolute inset-0 animate-ping rounded-full [animation-duration:2s] motion-reduce:animate-none" />
        <span className="bg-primary/10 ring-primary/30 relative flex size-16 items-center justify-center rounded-full ring-1">
          <Globe aria-hidden className="text-primary size-7 animate-pulse" />
        </span>
      </span>
      <div>
        <p className="font-medium">{SCAN_PHRASES[phrase]}</p>
        <p className="text-muted-foreground mt-1 text-xs">{url}</p>
      </div>
    </div>
  );
}

const CONTEXT_FIELDS = [
  { key: "offering" as const, label: "What you sell", icon: Building2 },
  { key: "icp" as const, label: "Who you sell to", icon: Target },
  { key: "stakes" as const, label: "Why they buy", icon: BookOpen },
];

export function OnboardingWizard({ initialStatus }: { initialStatus: OnboardingStatus }) {
  const router = useRouter();
  const [step, setStep] = useState<StepId>(0);
  const [url, setUrl] = useState(initialStatus.context?.website ?? "");
  const [context, setContext] = useState({
    offering: initialStatus.context?.offering ?? "",
    icp: initialStatus.context?.icp ?? "",
    stakes: initialStatus.context?.stakes ?? "",
  });
  const [routing, setRouting] = useState({
    name: initialStatus.routing?.name ?? "",
    email: initialStatus.routing?.email ?? "",
    slackMemberId: initialStatus.routing?.slackMemberId ?? "",
  });

  // Analyze failures render inline in step 1 (with a retry), not as a toast.
  const analyze = useMutation({
    mutationFn: (website: string) =>
      postOnboarding<{ draft: DraftContext }>({ action: "analyze", url: website }),
    onSuccess: ({ draft }) => {
      setContext({ offering: draft.offering, icp: draft.icp, stakes: draft.stakes });
      setStep(1);
    },
  });

  const saveContext = useMutation({
    mutationFn: () =>
      postOnboarding({ action: "save_context", ...context, website: url || undefined }),
    onSuccess: () => setStep(2),
    onError: () => toast.error("Could not save the context — try again."),
  });

  const saveRouting = useMutation({
    mutationFn: () =>
      postOnboarding({
        action: "save_routing",
        name: routing.name,
        email: routing.email || undefined,
        slackMemberId: routing.slackMemberId || undefined,
      }),
    onSuccess: () => setStep(3),
    onError: (error) => toast.error(error.message),
  });

  const contextComplete = CONTEXT_FIELDS.every((field) => context[field.key].trim() !== "");

  // Scroll back to the top of the wizard on every step change — step CTAs
  // otherwise end up below the fold on laptop heights.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  // Honest states only: a checkmark means it really happened (saved this
  // session or already present). Unfinished local steps are clickable and
  // jump back to where they can be fixed.
  const contextSaved = saveContext.isSuccess || initialStatus.context !== null;
  const playsRouted = saveRouting.isSuccess || initialStatus.routing !== null;

  const checklist: { label: string; done: boolean; fixStep?: StepId }[] = [
    { label: "Company context memorized", done: contextSaved, fixStep: 1 },
    { label: "Sillage persona configured", done: initialStatus.sillage?.personaSet ?? false },
    { label: "Accounts under watch", done: initialStatus.sillage?.listUploaded ?? false },
    {
      label: `${initialStatus.sillage?.agents ?? 0} signal agents running`,
      done: (initialStatus.sillage?.agents ?? 0) > 0,
    },
    { label: "Plays routed to a human", done: playsRouted, fixStep: 2 },
  ];

  return (
    <div className="grid gap-10 md:grid-cols-[240px_1fr]">
      <ProgressRail current={step} />

      <div className="min-h-[380px]">
        {step === 0 && (
          <div key="s0" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="text-lg font-semibold">Point Re:lay at your company</h2>
            <p className="text-muted-foreground mt-1 mb-6 text-sm">
              Claude reads your website and learns what you sell, to whom, and why it matters —
              every autopsy, verdict and email gets sharper.
            </p>
            {analyze.isPending ? (
              <ScanningState url={url} />
            ) : (
              <>
                <form
                  className="flex max-w-md gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (url.trim()) analyze.mutate(url.trim());
                  }}
                >
                  <Input
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://your-company.com"
                    aria-label="Company website"
                    type="url"
                    autoFocus
                  />
                  <Button type="submit" disabled={url.trim() === ""}>
                    <Sparkles aria-hidden />
                    Analyze
                  </Button>
                </form>
                {analyze.isError && (
                  <div
                    role="alert"
                    className="border-destructive/30 bg-destructive/[0.04] animate-in fade-in slide-in-from-bottom-1 mt-4 max-w-md rounded-xl border p-4 duration-300"
                  >
                    <p className="text-destructive flex items-center gap-1.5 text-sm font-medium">
                      <AlertTriangle aria-hidden className="size-4" />
                      Couldn&apos;t read the site
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">{analyze.error.message}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => analyze.mutate(url.trim())}
                      >
                        Retry
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setStep(1)}>
                        Describe it myself
                        <ArrowRight aria-hidden />
                      </Button>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-muted-foreground hover:text-foreground mt-6 block text-xs underline-offset-2 hover:underline"
                >
                  Skip — I&apos;ll describe the company myself
                </button>
              </>
            )}
          </div>
        )}

        {step === 1 && (
          <div key="s1" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="text-lg font-semibold">Here&apos;s what Re:lay understood</h2>
            <p className="text-muted-foreground mt-1 mb-6 text-sm">
              Edit anything that&apos;s off — this becomes the agent&apos;s working memory.
            </p>
            <div className="space-y-4">
              {CONTEXT_FIELDS.map((field, index) => (
                <div
                  key={field.key}
                  className="animate-in fade-in slide-in-from-bottom-1 fill-mode-both rounded-xl border p-4 shadow-sm duration-500"
                  style={{ animationDelay: `${index * 120}ms` }}
                >
                  <label
                    htmlFor={`ctx-${field.key}`}
                    className="mb-2 flex items-center gap-1.5 text-sm font-medium"
                  >
                    <field.icon aria-hidden className="text-primary size-3.5" />
                    {field.label}
                  </label>
                  <textarea
                    id={`ctx-${field.key}`}
                    value={context[field.key]}
                    onChange={(event) =>
                      setContext((current) => ({ ...current, [field.key]: event.target.value }))
                    }
                    rows={2}
                    className="border-input placeholder:text-muted-foreground focus-visible:ring-ring w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm focus-visible:ring-1 focus-visible:outline-none"
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-3">
              <Button
                onClick={() => saveContext.mutate()}
                disabled={!contextComplete || saveContext.isPending}
              >
                {saveContext.isPending ? (
                  <Loader2 aria-hidden className="animate-spin" />
                ) : (
                  <Check aria-hidden />
                )}
                Looks right — memorize it
              </Button>
              <Button variant="ghost" onClick={() => setStep(0)}>
                Back
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div key="s2" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="text-lg font-semibold">Who owns the plays?</h2>
            <p className="text-muted-foreground mt-1 mb-6 text-sm">
              They get @-mentioned on Slack and emailed when a deal wakes up or a play ships.
            </p>
            <div className="max-w-md space-y-3">
              <Input
                value={routing.name}
                onChange={(event) =>
                  setRouting((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Name — e.g. Sam"
                aria-label="Owner name"
                autoFocus
              />
              <Input
                value={routing.email}
                onChange={(event) =>
                  setRouting((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="Email (optional)"
                aria-label="Owner email"
                type="email"
              />
              <div>
                <Input
                  value={routing.slackMemberId}
                  onChange={(event) =>
                    setRouting((current) => ({ ...current, slackMemberId: event.target.value }))
                  }
                  placeholder="Slack member ID (optional) — e.g. U0123ABCD"
                  aria-label="Slack member ID"
                />
                <p className="text-muted-foreground mt-1 flex items-center gap-1 text-[11px]">
                  <AtSign aria-hidden className="size-3" />
                  Slack → profile → three dots → “Copy member ID”
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <Button
                onClick={() => saveRouting.mutate()}
                disabled={
                  routing.name.trim() === "" ||
                  (routing.email.trim() === "" && routing.slackMemberId.trim() === "") ||
                  saveRouting.isPending
                }
              >
                {saveRouting.isPending ? (
                  <Loader2 aria-hidden className="animate-spin" />
                ) : (
                  <ArrowRight aria-hidden />
                )}
                Route the plays
              </Button>
              <Button variant="ghost" onClick={() => setStep(3)}>
                Skip for now
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div key="s3" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="text-lg font-semibold">Re:lay is ready</h2>
            <p className="text-muted-foreground mt-1 mb-6 text-sm">
              Checked live against your workspace:
            </p>
            <ul className="max-w-md space-y-2.5">
              {checklist.map((item, index) => {
                const fixable = !item.done && item.fixStep !== undefined;
                const row = (
                  <>
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full",
                        item.done
                          ? "bg-emerald-600/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {item.done ? <AnimatedCheck className="size-3" /> : <span>·</span>}
                    </span>
                    <span className={cn("flex-1 text-left", !item.done && "text-muted-foreground")}>
                      {item.label}
                    </span>
                    {fixable && (
                      <span className="text-primary flex items-center gap-1 text-xs font-medium">
                        Fix
                        <ArrowRight aria-hidden className="size-3" />
                      </span>
                    )}
                  </>
                );
                return (
                  <li
                    key={item.label}
                    className="animate-in fade-in slide-in-from-left-2 fill-mode-both duration-500"
                    style={{ animationDelay: `${index * 150}ms` }}
                  >
                    {fixable ? (
                      <button
                        type="button"
                        onClick={() => setStep(item.fixStep as StepId)}
                        className="hover:border-primary/40 flex w-full cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm shadow-sm transition-colors"
                      >
                        {row}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm shadow-sm">
                        {row}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="text-muted-foreground mt-4 max-w-md text-xs">
              Want more signal agents or a sharper persona? Ask Re:lay — the bubble can configure
              Sillage for you.
            </p>
            <Button className="mt-6" onClick={() => router.push("/")}>
              Open the dashboard
              <ArrowRight aria-hidden />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
