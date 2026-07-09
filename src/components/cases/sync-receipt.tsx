"use client";

import Image from "next/image";
import { Check, Hash, Mail } from "lucide-react";
import { AnimatedCheck } from "@/components/animated-check";
import { CONNECTOR_LOGOS } from "@/lib/logos";

function formatTime(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * The receipt shown once a play is approved: the concrete actions Re:lay ran
 * downstream — the CRM write-back (the graph's syncCrm node) and, per
 * configured channel, the team announcement (Slack, email).
 */
export function SyncReceipt({
  companyName,
  contactName,
  opportunityId,
  syncedAt,
  slackNotified = false,
  emailNotified = false,
}: {
  companyName: string;
  contactName: string;
  opportunityId: string;
  syncedAt?: string;
  slackNotified?: boolean;
  emailNotified?: boolean;
}) {
  const time = syncedAt ? formatTime(syncedAt) : null;

  const lines = [
    `Contact ${contactName} upserted on ${companyName}`,
    `Outreach note logged on ${opportunityId}`,
    "Deal stage moved to Re-engaged",
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 overflow-hidden rounded-lg border shadow-xs duration-500 motion-reduce:animate-none">
      <div className="bg-muted/40 flex items-center justify-between gap-2 border-b px-3 py-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Image
            src={CONNECTOR_LOGOS.hubspot}
            alt=""
            width={15}
            height={15}
            className="rounded-[3px]"
          />
          Synced to HubSpot
        </span>
        {time && <span className="text-muted-foreground font-mono text-[11px]">{time}</span>}
      </div>
      <ul className="space-y-1.5 p-3 text-sm">
        {lines.map((line, index) => (
          <li key={line} className="flex items-center gap-2">
            <span
              className="animate-in zoom-in-50 fill-mode-both flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700 duration-300 motion-reduce:animate-none dark:bg-emerald-400/10 dark:text-emerald-400"
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <Check aria-hidden className="size-2.5" />
            </span>
            <span className="text-muted-foreground">{line}</span>
          </li>
        ))}
        {slackNotified && (
          <li className="flex items-center gap-2">
            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400">
              <AnimatedCheck className="size-2.5" />
            </span>
            <span className="text-muted-foreground inline-flex items-center gap-1">
              Announced in
              <span className="text-foreground inline-flex items-center font-medium">
                <Hash aria-hidden className="size-3" />
                sales-signals
              </span>
            </span>
          </li>
        )}
        {emailNotified && (
          <li className="flex items-center gap-2">
            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400">
              <AnimatedCheck className="size-2.5" />
            </span>
            <span className="text-muted-foreground inline-flex items-center gap-1">
              Deal owner notified
              <span className="text-foreground inline-flex items-center gap-0.5 font-medium">
                <Mail aria-hidden className="size-3" />
                by email
              </span>
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}
