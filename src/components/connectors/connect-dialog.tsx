"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { KeyRound, Plug } from "lucide-react";
import { toast } from "sonner";
import { withBasePath } from "@/lib/base-path";
import { AnimatedCheck } from "@/components/animated-check";
import { Collapse } from "@/components/collapse";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CONNECTOR_LOGOS } from "@/lib/logos";
import type { ConnectorId } from "@/types/connectors";

const VERIFY_MS = 1400;
const SUCCESS_CLOSE_MS = 1600;

// Prefilled demo values, rendered masked like any real key field. They must
// NOT follow real vendor key formats: a format-perfect fake (e.g.
// pat-eu1-<uuid>) trips secret scanners — GitGuardian actually flagged one
// as a leaked HubSpot token.
const KEY_PREFILLS: Record<ConnectorId, string> = {
  sillage: "demo-sillage-4f2a9c81d7",
  fullenrich: "demo-fullenrich-9c81d74f",
  hubspot: "demo-hubspot-4f2a9c81d7",
};

type Phase = "form" | "verifying" | "connected";

export function ConnectDialog({
  id,
  name,
  successDetail,
}: {
  id: ConnectorId;
  name: string;
  successDetail: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [apiKey, setApiKey] = useState(KEY_PREFILLS[id]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  function authorize() {
    setPhase("verifying");
    timersRef.current.push(
      setTimeout(async () => {
        await fetch(withBasePath("/api/connectors"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        setPhase("connected");
        router.refresh();
        timersRef.current.push(
          setTimeout(() => {
            setOpen(false);
            toast.success(`${name} connected — you're live.`);
          }, SUCCESS_CLOSE_MS),
        );
      }, VERIFY_MS),
    );
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) setPhase("form");
  }

  return (
    <>
      <Button size="sm" onClick={() => handleOpenChange(true)}>
        <Plug aria-hidden />
        Connect
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-md border bg-white shadow-sm">
                <Image src={CONNECTOR_LOGOS[id]} alt="" width={16} height={16} />
              </span>
              Connect {name}
            </DialogTitle>
            <DialogDescription>
              Paste your {name} API key to link it to this workspace. Demo mode: any key works.
            </DialogDescription>
          </DialogHeader>

          <Collapse open={phase !== "connected"}>
            <form
              className="space-y-4 pt-1 pb-px"
              onSubmit={(event) => {
                event.preventDefault();
                if (phase === "form") authorize();
              }}
            >
              <div className="space-y-2">
                <label htmlFor={`${id}-api-key`} className="text-sm font-medium">
                  API key
                </label>
                <div className="relative">
                  <KeyRound
                    aria-hidden
                    className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
                  />
                  <input
                    id={`${id}-api-key`}
                    type="password"
                    autoComplete="off"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    disabled={phase === "verifying"}
                    className="border-input focus-visible:ring-ring/50 h-10 w-full rounded-lg border bg-transparent pr-3 pl-9 font-mono text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none disabled:opacity-60"
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={phase === "verifying" || apiKey.trim() === ""}
              >
                {phase === "verifying" && (
                  <span
                    aria-hidden
                    className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                  />
                )}
                {phase === "verifying" ? "Verifying credentials…" : "Authorize connection"}
              </Button>
            </form>
          </Collapse>

          <Collapse open={phase === "connected"}>
            <div className="space-y-3 pt-1 pb-px text-center">
              <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400">
                <AnimatedCheck className="size-6" />
              </span>
              <div className="space-y-1">
                <p className="text-base font-medium">{name} connected</p>
                <p className="text-muted-foreground text-sm">{successDetail}</p>
              </div>
            </div>
          </Collapse>
        </DialogContent>
      </Dialog>
    </>
  );
}
