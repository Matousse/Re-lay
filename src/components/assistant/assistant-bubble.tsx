"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useMutation } from "@tanstack/react-query";
import { Archive, Check, ChevronDown, Loader2, Plug, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { RichText } from "@/components/assistant/rich-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { withBasePath } from "@/lib/base-path";
import { CONNECTOR_LOGOS } from "@/lib/logos";
import { cn } from "@/lib/utils";
import type { AssistantEvent, AssistantReply, ChatMessage } from "@/types/assistant";

// The chat face of the Re:lay agent: a floating bubble that talks to
// /api/assistant — Claude wired to the same tool registry the MCP server
// exposes. The route streams NDJSON progress events, and every step (each
// tool call, each thinking pause) gets its own bubble that stays in the
// transcript for good — the timeline of the agent's work IS the conversation.

type StepStatus = "running" | "done" | "error";

type TranscriptEntry =
  | { kind: "message"; role: "user" | "assistant"; content: string }
  | { kind: "step"; id: number; tool: string; status: StepStatus; detail?: string }
  | { kind: "thinking"; id: number; active: boolean };

const SUGGESTIONS = [
  "Which deals are worth reviving?",
  "Run the agent on the best signal",
  "What's my recoverable pipeline?",
];

const ANTHROPIC_LOGO = withBasePath("/logos/anthropic.png");

// Each tool step carries the brand it talks to — real vendor favicons, the
// same ones the agent-run dialog uses.
type StepMeta = { label: string; logo?: string; icon?: typeof Plug };

const STEP_META: Record<string, StepMeta> = {
  connect_integrations: { label: "Connecting the stack", icon: Plug },
  list_signals: { label: "Scanning Sillage signals", logo: CONNECTOR_LOGOS.sillage },
  list_revivable_deals: { label: "Reading the pipeline", logo: CONNECTOR_LOGOS.hubspot },
  get_case: { label: "Opening the case file", logo: CONNECTOR_LOGOS.hubspot },
  run_reengagement: { label: "Running the re-engagement agent", logo: ANTHROPIC_LOGO },
  approve_play: { label: "Approving — syncing the CRM", logo: CONNECTOR_LOGOS.hubspot },
  reject_play: { label: "Closing the play", icon: Archive },
};

const stepMeta = (tool: string): StepMeta => STEP_META[tool] ?? { label: tool };

// Reads the NDJSON stream: progress events feed the transcript live, the
// final `done` event resolves with the assistant's turn.
async function streamChat(
  messages: ChatMessage[],
  onEvent: (event: AssistantEvent) => void,
): Promise<AssistantReply> {
  const response = await fetch(withBasePath("/api/assistant"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!response.ok || !response.body) throw new Error("Assistant request failed");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let final: AssistantReply | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const event = JSON.parse(line) as AssistantEvent;
      if (event.type === "done") final = { reply: event.reply, toolCalls: event.toolCalls };
      else onEvent(event);
    }
  }
  if (!final) throw new Error("Assistant stream ended early");
  return final;
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          className="size-1 animate-bounce rounded-full bg-current motion-reduce:animate-none"
          style={{ animationDelay: `${dot * 150}ms` }}
        />
      ))}
    </span>
  );
}

// Small framed brand favicon (or lucide fallback) that fronts a step bubble.
function StepBadge({ meta, className }: { meta: StepMeta; className?: string }) {
  const Icon = meta.icon ?? Sparkles;
  return (
    <span
      className={cn(
        "ring-border/60 bg-background flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md shadow-xs ring-1",
        className,
      )}
    >
      {meta.logo ? (
        <Image src={meta.logo} alt="" width={16} height={16} className="rounded-[3px]" />
      ) : (
        <Icon aria-hidden className="text-primary size-3.5" />
      )}
    </span>
  );
}

function StatusDot({ status }: { status: StepStatus }) {
  if (status === "running") {
    return <Loader2 aria-hidden className="text-primary size-3.5 animate-spin" />;
  }
  return (
    <span
      className={cn(
        "flex size-4 items-center justify-center rounded-full",
        status === "error"
          ? "bg-destructive/15 text-destructive"
          : "bg-emerald-600/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-400",
      )}
    >
      {status === "error" ? (
        <X aria-hidden className="size-2.5" />
      ) : (
        <Check aria-hidden className="size-2.5" />
      )}
    </span>
  );
}

// One tool call = one bubble, permanently in the transcript. Finished steps
// are clickable: they expand to reveal what happened in clear text — the
// result summary on success, the error message on failure.
function StepBubble({
  tool,
  status,
  detail,
}: {
  tool: string;
  status: StepStatus;
  detail?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = stepMeta(tool);
  const expandable = status !== "running" && Boolean(detail);

  const row = (
    <>
      <StepBadge meta={meta} />
      <span
        className={cn(
          "text-xs font-medium",
          status === "running" ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {meta.label}
      </span>
      <StatusDot status={status} />
      {expandable && (
        <ChevronDown
          aria-hidden
          className={cn(
            "text-muted-foreground size-3 transition-transform duration-200",
            expanded && "rotate-180",
          )}
        />
      )}
    </>
  );

  return (
    <div
      className={cn(
        "bg-background animate-in fade-in slide-in-from-bottom-1 w-fit max-w-[85%] rounded-xl border px-3 py-2 shadow-md shadow-black/[0.05] duration-300 motion-reduce:animate-none",
        status === "running" && "border-primary/25",
        status === "error" && "border-destructive/25",
      )}
    >
      {expandable ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-label={`${meta.label} — show what happened`}
          className="flex cursor-pointer items-center gap-2.5"
        >
          {row}
        </button>
      ) : (
        <div className="flex items-center gap-2.5">{row}</div>
      )}
      {expanded && detail && (
        <p
          className={cn(
            "animate-in fade-in slide-in-from-top-1 mt-2 rounded-md px-2 py-1.5 text-[11px] leading-snug break-words whitespace-pre-wrap duration-200 motion-reduce:animate-none",
            status === "error"
              ? "text-destructive bg-destructive/[0.06]"
              : "text-muted-foreground bg-muted/60",
          )}
        >
          {detail}
        </p>
      )}
    </div>
  );
}

// Claude's reasoning pause — its own bubble too, frozen once it moves on.
function ThinkingBubble({ active }: { active: boolean }) {
  return (
    <div
      className={cn(
        "bg-background animate-in fade-in slide-in-from-bottom-1 flex w-fit max-w-[85%] items-center gap-2.5 rounded-xl border px-3 py-2 shadow-md shadow-black/[0.05] duration-300 motion-reduce:animate-none",
        active && "border-primary/25",
      )}
    >
      <StepBadge meta={{ label: "Claude", logo: ANTHROPIC_LOGO }} />
      <span
        className={cn("text-xs font-medium", active ? "text-foreground" : "text-muted-foreground")}
      >
        {active ? "Claude is thinking" : "Claude reasoned"}
      </span>
      {active ? (
        <span className="text-primary">
          <ThinkingDots />
        </span>
      ) : (
        <StatusDot status="done" />
      )}
    </div>
  );
}

export function AssistantBubble() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const nextId = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  function handleEvent(event: AssistantEvent) {
    setTranscript((current) => {
      const next = [...current];

      // A new step or a new pause freezes the currently animated thinking.
      const freezeThinking = () => {
        for (let i = next.length - 1; i >= 0; i--) {
          const entry = next[i];
          if (entry.kind === "thinking" && entry.active) {
            next[i] = { ...entry, active: false };
            break;
          }
        }
      };

      if (event.type === "thinking") {
        freezeThinking();
        next.push({ kind: "thinking", id: nextId.current++, active: true });
      }
      if (event.type === "tool_start") {
        freezeThinking();
        next.push({ kind: "step", id: nextId.current++, tool: event.name, status: "running" });
      }
      if (event.type === "tool_end") {
        for (let i = next.length - 1; i >= 0; i--) {
          const entry = next[i];
          if (entry.kind === "step" && entry.tool === event.name && entry.status === "running") {
            next[i] = {
              ...entry,
              status: event.isError ? "error" : "done",
              detail: event.detail,
            };
            break;
          }
        }
      }
      return next;
    });
  }

  // Whatever happens, nothing animated may survive the run: freeze thinking
  // bubbles and fail any step still marked running.
  function settleTranscript() {
    setTranscript((current) =>
      current.map((entry) => {
        if (entry.kind === "thinking" && entry.active) return { ...entry, active: false };
        if (entry.kind === "step" && entry.status === "running") {
          return { ...entry, status: "error" as const };
        }
        return entry;
      }),
    );
  }

  const chat = useMutation({
    mutationFn: (messages: ChatMessage[]) => streamChat(messages, handleEvent),
    onSuccess: (data) => {
      settleTranscript();
      setTranscript((current) => [
        ...current,
        { kind: "message", role: "assistant", content: data.reply },
      ]);
    },
    onError: () => {
      settleTranscript();
      toast.error("The assistant is unavailable — try again.");
    },
  });

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [open, transcript]);

  function send(text: string) {
    const content = text.trim();
    if (content === "" || chat.isPending) return;
    setTranscript((current) => [...current, { kind: "message", role: "user", content }]);
    setInput("");
    const history = [
      ...transcript.filter((entry) => entry.kind === "message"),
      { kind: "message" as const, role: "user" as const, content },
    ].map((entry) => ({ role: entry.role, content: entry.content }));
    chat.mutate(history);
  }

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Re:lay assistant"
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          className="bg-background/95 animate-in fade-in slide-in-from-bottom-2 fixed right-6 bottom-22 z-50 flex h-[min(560px,calc(100dvh-8rem))] w-[380px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl duration-300 motion-reduce:animate-none"
        >
          <div className="from-primary/[0.08] flex items-center justify-between border-b bg-gradient-to-r to-transparent px-4 py-3">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles aria-hidden className="text-primary size-3.5" />
                Ask Re:lay
              </p>
              <p className="text-muted-foreground text-[11px]">
                same tools as the agents — nothing ships without your yes
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close assistant"
              onClick={() => setOpen(false)}
            >
              <X aria-hidden />
            </Button>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
            {transcript.length === 0 && !chat.isPending && (
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">
                  Ask about your pipeline, run the agent on a signal, approve a play — in plain
                  language.
                </p>
                {SUGGESTIONS.map((suggestion, index) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => send(suggestion)}
                    className="hover:border-primary/40 hover:bg-primary/[0.03] hover:text-foreground text-muted-foreground animate-in fade-in slide-in-from-bottom-1 fill-mode-both block w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors duration-300 motion-reduce:animate-none"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            {transcript.map((entry, index) => {
              if (entry.kind === "step") {
                return (
                  <StepBubble
                    key={`s-${entry.id}`}
                    tool={entry.tool}
                    status={entry.status}
                    detail={entry.detail}
                  />
                );
              }
              if (entry.kind === "thinking") {
                return <ThinkingBubble key={`t-${entry.id}`} active={entry.active} />;
              }
              return (
                <div
                  key={`m-${index}`}
                  className={cn(
                    "animate-in fade-in slide-in-from-bottom-1 max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap duration-300 motion-reduce:animate-none",
                    entry.role === "user"
                      ? "bg-primary text-primary-foreground shadow-primary/20 ml-auto shadow-md"
                      : "bg-muted/70 border shadow-sm",
                  )}
                >
                  <RichText text={entry.content} />
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          <form
            className="flex items-center gap-2 border-t p-3"
            onSubmit={(event) => {
              event.preventDefault();
              send(input);
            }}
          >
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about your dead deals…"
              aria-label="Message the assistant"
              autoFocus
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Send"
              disabled={chat.isPending || input.trim() === ""}
            >
              <Send aria-hidden />
            </Button>
          </form>
        </div>
      )}

      <div className="fixed right-6 bottom-6 z-50">
        {/* Breathing halo behind the launcher — the bubble feels alive even idle. */}
        {!open && (
          <span
            aria-hidden
            className="bg-primary/40 absolute inset-0 animate-pulse rounded-full blur-md [animation-duration:3s] motion-reduce:animate-none"
          />
        )}
        <Button
          size="icon"
          aria-label={open ? "Close the Re:lay assistant" : "Open the Re:lay assistant"}
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "group shadow-primary/30 relative size-12 rounded-full bg-gradient-to-br shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl",
            "from-primary to-primary via-primary/90",
            !open && "animate-relay-float",
          )}
        >
          {open ? (
            <X aria-hidden className="size-5" />
          ) : (
            <Sparkles
              aria-hidden
              className="size-5 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12"
            />
          )}
          {/* Working while closed: the launcher keeps showing the agent is busy. */}
          {!open && chat.isPending && (
            <span
              aria-hidden
              className="bg-background ring-background absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full shadow ring-2"
            >
              <Loader2 className="text-primary size-3 animate-spin" />
            </span>
          )}
          {!open && !chat.isPending && transcript.length === 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-2.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70 motion-reduce:animate-none" />
              <span className="ring-background relative inline-flex size-2.5 rounded-full bg-emerald-500 ring-2" />
            </span>
          )}
        </Button>
      </div>
    </>
  );
}
