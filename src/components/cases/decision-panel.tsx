"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { FileDiff, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { AnimatedCheck } from "@/components/animated-check";
import { SyncReceipt } from "@/components/cases/sync-receipt";
import { Kbd } from "@/components/kbd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { diffWords } from "@/lib/diff";
import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";
import type {
  CaseStatus,
  DecisionEffects,
  DecisionInput,
  EmailDraft,
  OutreachAngle,
} from "@/types/reengagement";

type DecisionResponse = { effects: DecisionEffects };

async function postDecision(caseId: string, input: DecisionInput): Promise<DecisionResponse> {
  const response = await fetch(withBasePath(`/api/cases/${caseId}/decision`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error("Decision failed");
  return response.json();
}

function DiffText({ before, after }: { before: string; after: string }) {
  return (
    <>
      {diffWords(before, after).map((segment, index) => {
        if (segment.type === "added") {
          return (
            <ins
              key={index}
              className="rounded-sm bg-emerald-600/15 text-emerald-800 no-underline dark:bg-emerald-400/15 dark:text-emerald-300"
            >
              {segment.text}
            </ins>
          );
        }
        if (segment.type === "removed") {
          return (
            <del key={index} className="bg-destructive/10 text-destructive rounded-sm">
              {segment.text}
            </del>
          );
        }
        return <span key={index}>{segment.text}</span>;
      })}
    </>
  );
}

function DraftView({
  original,
  subject,
  body,
  showDiff,
  muted = false,
}: {
  original: EmailDraft;
  subject: string;
  body: string;
  showDiff: boolean;
  muted?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border p-4", muted ? "bg-muted/30 opacity-70" : "bg-muted/50")}>
      <p className="mb-2 text-sm font-medium">
        {showDiff ? <DiffText before={original.subject} after={subject} /> : subject}
      </p>
      <p className="text-muted-foreground text-sm whitespace-pre-wrap">
        {showDiff ? <DiffText before={original.body} after={body} /> : body}
      </p>
    </div>
  );
}

export function DecisionPanel({
  caseId,
  status,
  angles,
  editedEmail,
  approvedAngleLabel,
  companyName,
  contactName,
  opportunityId,
}: {
  caseId: string;
  status: CaseStatus;
  /** Angle options; the first is the recommended one. At least one is present. */
  angles: OutreachAngle[];
  editedEmail?: EmailDraft;
  approvedAngleLabel?: string;
  companyName: string;
  contactName: string;
  opportunityId: string;
}) {
  const router = useRouter();
  const hasChoice = angles.length > 1;

  const initialAngle = angles.find((a) => a.label === approvedAngleLabel) ?? angles[0];
  const [selectedAngleId, setSelectedAngleId] = useState(initialAngle.id);
  const selectedAngle = angles.find((a) => a.id === selectedAngleId) ?? angles[0];

  const [subject, setSubject] = useState(editedEmail?.subject ?? initialAngle.emailDraft.subject);
  const [body, setBody] = useState(editedEmail?.body ?? initialAngle.emailDraft.body);
  const [editing, setEditing] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  // Optimistic: flip the UI as soon as the rep clicks, server state catches up
  // via router.refresh().
  const [localStatus, setLocalStatus] = useState<CaseStatus | null>(null);
  const [receipt, setReceipt] = useState<{ syncedAt: string; slackNotified: boolean } | null>(null);

  const decision = useMutation({
    mutationFn: (input: DecisionInput) => postDecision(caseId, input),
    onMutate: (input) => {
      setEditing(false);
      setLocalStatus(input.action === "approve" ? "approved" : "rejected");
    },
    onSuccess: (data, input) => {
      if (input.action === "approve") {
        setReceipt({ syncedAt: data.effects.syncedAt, slackNotified: data.effects.slackNotified });
        toast.success("Approved — contact and note synced to HubSpot.");
        if (data.effects.slackNotified) toast("Posted to #sales-signals.");
      } else {
        toast("Rejected — signal archived, no outreach sent.");
      }
      router.refresh();
    },
    onError: () => {
      setLocalStatus(null);
      toast.error("Something went wrong — the decision was not saved.");
    },
  });

  const effectiveStatus = localStatus ?? status;
  const pending = effectiveStatus === "pending_review";
  const isEdited =
    subject !== selectedAngle.emailDraft.subject || body !== selectedAngle.emailDraft.body;
  const canSubmit = !decision.isPending && subject.trim() !== "" && body.trim() !== "";

  function selectAngle(id: string) {
    if (!pending) return;
    const angle = angles.find((a) => a.id === id);
    if (!angle || angle.id === selectedAngleId) return;
    // Switching angle is a fresh start from that angle's draft.
    setSelectedAngleId(id);
    setSubject(angle.emailDraft.subject);
    setBody(angle.emailDraft.body);
    setShowDiff(false);
    setEditing(false);
  }

  const approve = () => {
    if (pending && canSubmit) {
      decision.mutate({
        action: "approve",
        email: { subject, body },
        angleLabel: selectedAngle.label,
      });
    }
  };
  const reject = () => {
    if (pending && !decision.isPending) decision.mutate({ action: "reject" });
  };

  const shortcuts: Record<string, () => void> = {
    a: approve,
    r: reject,
    e: () => {
      if (pending) setEditing((value) => !value);
    },
    escape: () => setEditing(false),
  };
  if (hasChoice) {
    angles.forEach((angle, index) => {
      shortcuts[String(index + 1)] = () => selectAngle(angle.id);
    });
  }
  useShortcuts(shortcuts);

  const diffToggle = isEdited && !editing && (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground animate-in fade-in duration-300 motion-reduce:animate-none"
      onClick={() => setShowDiff((value) => !value)}
    >
      <FileDiff aria-hidden />
      {showDiff ? "Hide changes" : "View changes"}
    </Button>
  );

  // The angle chooser (or a static angle line when there's only one).
  const angleSection = hasChoice ? (
    <div className="space-y-2">
      <p className="text-sm font-medium">Re-engagement angle</p>
      <div className="flex flex-wrap gap-2">
        {angles.map((angle, index) => {
          const active = angle.id === selectedAngle.id;
          return (
            <button
              key={angle.id}
              type="button"
              onClick={() => selectAngle(angle.id)}
              aria-pressed={active}
              disabled={!pending}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all duration-200",
                pending && "hover:scale-[1.03]",
                active
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {pending && (
                <Kbd
                  className={cn(
                    active && "border-primary/30 bg-primary/10 text-primary",
                    "transition-colors",
                  )}
                >
                  {index + 1}
                </Kbd>
              )}
              {angle.label}
            </button>
          );
        })}
      </div>
      <p
        key={selectedAngle.id}
        className="text-muted-foreground animate-in fade-in slide-in-from-bottom-1 text-sm duration-300 motion-reduce:animate-none"
      >
        {selectedAngle.rationale}
      </p>
    </div>
  ) : (
    <div>
      <p className="mb-1 font-medium">Angle</p>
      <p className="text-muted-foreground text-sm">{selectedAngle.rationale}</p>
    </div>
  );

  if (!pending) {
    const rejected = effectiveStatus === "rejected";
    const approvedVia = hasChoice ? (approvedAngleLabel ?? selectedAngle.label) : null;
    return (
      <div className="animate-in fade-in slide-in-from-bottom-1 space-y-3 duration-500 motion-reduce:animate-none">
        {angleSection}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {rejected ? (
            <p className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
              <X aria-hidden className="size-4" />
              Rejected — no outreach sent, signal archived.
            </p>
          ) : (
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <AnimatedCheck className="size-4" />
              Approved{approvedVia ? ` · via “${approvedVia}”` : ""}
            </p>
          )}
          {diffToggle}
        </div>
        {!rejected && (
          <SyncReceipt
            companyName={companyName}
            contactName={contactName}
            opportunityId={opportunityId}
            syncedAt={receipt?.syncedAt}
            slackNotified={receipt?.slackNotified}
          />
        )}
        <DraftView
          original={selectedAngle.emailDraft}
          subject={subject}
          body={body}
          showDiff={showDiff}
          muted={rejected}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {angleSection}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">Draft email</p>
          {diffToggle}
        </div>
        {editing ? (
          <div className="animate-in fade-in slide-in-from-bottom-1 space-y-2 duration-300 motion-reduce:animate-none">
            <Input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              aria-label="Email subject"
            />
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              aria-label="Email body"
              rows={10}
              className="border-input focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent p-3 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none"
            />
          </div>
        ) : (
          <div
            key={selectedAngle.id}
            className="animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none"
          >
            <DraftView
              original={selectedAngle.emailDraft}
              subject={subject}
              body={body}
              showDiff={showDiff}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={approve} disabled={!canSubmit}>
            Approve &amp; sync CRM
            <Kbd className="border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground">
              A
            </Kbd>
          </Button>
          <Button variant="outline" onClick={() => setEditing((value) => !value)}>
            <Pencil aria-hidden />
            {editing ? "Preview" : "Edit"}
            <Kbd>E</Kbd>
          </Button>
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={reject}
            disabled={decision.isPending}
          >
            <X aria-hidden />
            Reject
            <Kbd>R</Kbd>
          </Button>
        </div>
      </div>
    </div>
  );
}
