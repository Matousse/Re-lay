# Re:lay — Roadmap

The thread tying everything below together: **Re:lay should stop being a dashboard you check and
become a system that reaches out.** When a dead deal wakes up, Re:lay decides the move, **generates
the asset** to carry it, and **delivers it** where the GTM team already lives — Slack and email. And
because this is an **agentic** hackathon, Re:lay should also be **composable** (a tool other agents
drive over MCP) and **conversational** (a bot you can talk to) — not just a UI humans click.

> **Hackathon day — keys in hand.** The organizers provide API keys for every sponsor tool
> (Sillage, FullEnrich, Anthropic, Gamma). The plan flips from _fake-first_ to **real-first**: we
> run the real adapters and keep the fakes as a demo safety net (flaky venue wifi, rate limits,
> spent credits). It also unblocked the Anthropic LLM swap — done, the agent runs on Claude.

---

## ✅ Now — shipped

- Six-node LangGraph agent (`qualify → analyst → researcher → strategist → humanReview → syncCrm`)
  with `MemorySaver` + `interrupt()` human-in-the-loop.
- Pipeline bridge → `ReengagementCase` contract; curated and live runs share the same screens.
- Real **Sillage** signal adapter behind a port (fake fallback).
- **A/B re-engagement angles** — the rep steers the strategy, the email morphs live.
- Approve / edit / reject decision screen with draft diffing.
- **CRM sync receipt** on approval (contact upserted · note logged · stage → Re-engaged).
- **Slack announcement** on approval (Block Kit, env-gated, fail-safe).
- **Recoverable-revenue** projection on the dashboard.
- **MCP server** (9 juil.) — 7 tools over Streamable HTTP at `/api/mcp` (`mcp-handler`), thin
  wrappers over `services/`: `connect_integrations`, `list_signals`, `list_revivable_deals`,
  `get_case`, `run_reengagement` (stops at human review), `approve_play`, `reject_play`. Verified
  end-to-end over JSON-RPC (run → pending case → approve → CRM/Slack effects).
- **Notification dispatcher** (9 juil.) — `RelayEvent` (`play_approved`, `review_requested`) →
  `dispatchEvent` renders one neutral message → fans out to **Slack** (Block Kit) + **email**
  (Resend REST, zero deps, test sender by default). Env-gated per channel, fail-safe, surfaced in
  the sync receipt + toasts (`emailNotified`).
- **"Ask Re:lay" assistant — voice bubble Tier 1** (9 juil.) — floating chat bubble, Claude
  running the Anthropic tool-use loop over the shared registry (`services/relay-tools.ts` — same
  7 tools as the MCP, consumed by both entry points). Streams NDJSON progress events: every tool
  call and thinking pause is its own persistent bubble (vendor favicon, spinner → check/cross),
  expandable to show what happened (result summary / error text). Model-routed: chat loop on
  **Haiku 4.5** (~3s turns, `ASSISTANT_MODEL` override), pipeline reasoning stays on Sonnet.
  Markdown-lite rendering (bold, code, tables), confirm-before-approve gate in the system prompt,
  living launcher (float + halo + busy badge), honest no-op without `ANTHROPIC_API_KEY`.
- **Onboarding conversationnel** (9 juil.) — le premier pas manquant du parcours, fait en parlant :
  7 nouveaux outils au registre (14 au total, chat + MCP) — `get_workspace_setup` (état Sillage +
  contexte), `read_website` (scrape → compréhension de l'offre/ICP/enjeux), `save_company_context`
  (mémorisé, injecté dans le system prompt de l'assistant), `configure_sillage_persona` /
  `create_signal_agent` / `watch_accounts` (écritures réelles sur le workspace Sillage, confirmation
  humaine exigée), `route_notifications` (owner assigné : @-mention Slack + email direct — le
  dispatcher route vers lui). Reste à faire : upload PDF/docs pour le contexte (blocs document
  Anthropic), owners par deal, injecter le contexte dans le strategist du pipeline (fichiers Mat).
- **Onboarding wizard `/onboarding`** (9 juil.) — la face guidée du même cerveau : URL → animation
  de scan → Claude (Sonnet, `structured`) extrait offering/ICP/enjeux → cartes éditables →
  mémorisation → routage des plays → checklist live du workspace. Entrée : bannière dashboard tant
  que le contexte n'est pas connu. Même stores/services que les outils de l'assistant.
- **Page Integrations enrichie** (9 juil.) — section "Platform & channels" : Anthropic / Slack /
  Resend en statut env réel (Connected / Key missing), Gamma & Gradium en "Coming soon".
- **Sillage branché en réel** (9 juil., team) — adapter v1 (feed person-centric) avec **fallback
  v2** quand le feed v1 est vide (cas du workspace hackathon : détections non lead-attached,
  visibles uniquement via `POST /v2/workspace/signals/query`) ; résolution de la société jusqu'au
  slug d'URL LinkedIn. Les fakes signaux sont supprimés : sans `SILLAGE_API_KEY`, liste vide.
  Vérifié live (50 postings Qonto). Compte CRM Qonto closed-lost seedé pour que le signal réel
  ait un deal à ressusciter.

---

## 🎯 Next — "Re:lay reaches out" (this hackathon)

Two features that are really one story. Build in this order; each is demo-safe on its own.

### 0. Quick win — swap the LLM to Anthropic _(done ✅)_

`@langchain/openai` has been replaced with `@langchain/anthropic` behind the existing `LlmClient`
port. The swap touched only `integrations/llm/` (plus the `ANTHROPIC_API_KEY` env var) — the single
most on-theme change for an Anthropic-judged event.

### 1. Event & notification layer — Slack + email _(low risk, high certainty)_

Generalize the one-off `integrations/notifications/slack.ts` into a small **event → channel**
dispatcher. We already own half of this.

```
services/ emits a RelayEvent
        │
        ▼
  notifications/dispatch.ts  ──▶  channels/slack.ts   (Block Kit webhook — done)
        │                    └─▶  channels/email.ts   (Resend — new)
        ▼
  each channel is env-gated & fail-safe (a down channel never breaks the pipeline)
```

- **`RelayEvent`** (typed union, keep it to ~3–4 for the demo):
  - `signal_detected` — a closed-lost deal just woke up → ping the deal owner.
  - `review_requested` — a scored play is waiting → ping the rep.
  - `play_approved` — approved & synced → announce to the channel (**exists**, re-routed through
    the dispatcher).
  - `digest_ready` — the weekly resurrection recap is built → post + email it.
- **Channels**: `slack` (have it), `email` (new). One shared message model so every event renders to
  both without per-channel logic.
- **Email**: **Resend** is the fastest path (developer-first, test domain out of the box). Env-gated
  behind `RESEND_API_KEY` exactly like Slack; unset → the app renders an **email preview** in-app
  instead of sending. _Do not spend hackathon hours on domain/DNS/deliverability._
- **Effort**: ~half a day. **Demo-safe**: yes — degrades to preview with zero keys.

### 2. Gamma content generation — the re-engagement asset _(high wow, contained risk)_

The agent stops handing over just an email and hands over the **whole package**: a personalized
micro-deck the rep can send or bring to the call. New port, same pattern as `signals/`.

```
integrations/content/
  ├── port.ts     ContentPort: generateReengagementDeck(case) -> { gammaUrl, exportUrl }
  ├── gamma.ts    real adapter — Gamma Generate API (used when GAMMA_API_KEY is set)
  └── fake.ts     instant pre-baked link (demo never blocks on Gamma)
```

**Concrete API** (GA since Nov 2025, verified):

```http
POST https://public-api.gamma.app/v1.0/generations
X-API-KEY: sk-gamma-…
Content-Type: application/json

{ "inputText": "<autopsy + why-now + proposed angle for {Company}>",
  "format": "presentation", "textMode": "generate",
  "numCards": 5, "themeId": "<brand theme>", "exportAs": "pptx" }
→ { "generationId": "abc123" }

# async — poll every ~5s
GET /v1.0/generations/abc123  →  { "status": "completed",
                                   "gammaUrl": "…", "exportUrl": "…",
                                   "credits": { "deducted": 20, "remaining": … } }
```

- **Primary placement**: a **per-account "why now" micro-deck** (3–5 cards) generated on approval,
  linked in the re-engagement email — extends the brief's "working sequences" into a real artifact.
- **Secondary placement**: a **weekly resurrection digest** deck for leadership ("N deals revived,
  €X recoverable") — this is what `digest_ready` carries.
- **Risks & mitigations**:
  - _Async + latency_ → generate in the background on approval, show a "Building deck…" chip, reveal
    the link when ready. Never on the critical path.
  - _Credits + Pro account/API key_ → real adapter only when `GAMMA_API_KEY` is present; the fake
    returns an instant link so the demo works with zero budget. Pre-generate decks for the curated
    demo cases.
  - _Feels bolted-on_ → always tie the deck to a specific case's autopsy + angle, never a generic
    "make me slides."
- **Effort**: ~half a day for the port + async plumbing. **Demo-safe**: yes — the fake carries it.

### 3. The join — the deck rides the notification _(the payoff)_

This is where 1 and 2 become one feature:

- **On approve** → `syncCrm` fires → `play_approved` event → deck generation kicks off → when ready,
  the Slack post **and** the owner's email both carry the personalized email **and** the Gamma link.
- **Weekly** → digest deck built → `digest_ready` → posted to `#sales-signals` + emailed to leaders.

> "A champion at a lost account changed jobs. Re:lay scored it, drafted the play, built a tailored
> why-now deck, and dropped it in Slack and the rep's inbox — before anyone opened the CRM."

---

## 🤖 Re:lay as an MCP server — "an agent you can hand to another agent" _(✅ shipped 9 juil.)_

This is an **agentic** hackathon, so Re:lay shouldn't only be an app humans click — it should be a
**tool other agents can drive**. We expose Re:lay over the **Model Context Protocol** so any MCP
client (Claude Desktop, claude.ai, a sales-ops agent) can list revivable deals, run the agent, and
route an approval — in natural language. It also mirrors the ecosystem: **Sillage ships its own
MCP**, so Re:lay-as-MCP speaks the same language as the tools it stands on.

**Architecture — a third entry point, ~zero new business logic.** The MCP server is a thin adapter
over the _existing_ `services/` layer, exactly like the HTTP routes and RSCs:

```
integrations/ → services/ → ├ app/api/**/route.ts            (HTTP)
                            ├ app/**/page.tsx                 (RSC)
                            └ app/api/[transport]/route.ts    (MCP)  ← new
```

Built with `@modelcontextprotocol/sdk` + Vercel's **`mcp-handler`**, mounted as a Next route handler
at `app/api/[transport]/route.ts` (Streamable HTTP — the current default transport). Because it ships
in the same deploy, judges can point Claude straight at our **live** endpoint:
`https://www.shonen.app/hackathon-sillage-anthropic/api/mcp` (the `basePath` carries through).

**Tools** — each wraps a service we already have; the Zod schemas we already wrote validate the args:

| MCP tool                       | Wraps                    | Kind                                                                                                   |
| ------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------ |
| `list_revivable_deals`         | `listCases` / `getStats` | read                                                                                                   |
| `get_case`                     | `getCase`                | read                                                                                                   |
| `run_reengagement`             | `runPipelineForSignal`   | runs the agent **to the human-review interrupt**, returns the proposed play (safe — stops at the gate) |
| `approve_play` / `reject_play` | `decideCase`             | **consequential** — CRM sync + Slack + email + deck                                                    |

```ts
server.registerTool(
  "run_reengagement",
  {
    description: "Run the Re:lay agent on a signal; stops at human review and returns the play",
    inputSchema: z.object({ signalId: z.string() }),
  },
  async ({ signalId }) => {
    const result = await runPipelineForSignal(signalId);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);
```

**Resources** (readable context, no side effects): `relay://cases`, `relay://cases/{id}`,
`relay://stats`. **Prompts** (optional): a "triage this week's revivable deals" template.

**The demo money-shot — the human-in-the-loop gets _stronger_, not weaker.** From Claude:
_"Which dead deals are worth reviving?"_ → `list_revivable_deals` → _"Run the Kerneos play"_ →
`run_reengagement` returns autopsy + angle + email → the human reads it → _"Approve the champion-first
angle"_ → `approve_play` → CRM synced, Slack fired, deck attached. **A calling agent proposes; a human
approves; Re:lay acts.** The whole thesis, demonstrated live _through another agent_.

**Risks & notes:**

- **Keep the gate.** `approve_play` has real side effects — annotate it (`destructiveHint`) and treat
  it as the human's explicit act, never something the calling agent auto-fires. `run_reengagement`
  deliberately stops at `interrupt()`.
- **Auth.** A remote MCP should use OAuth 2.1 (same as Sillage's MCP). For the demo we run it
  unauthenticated on the deploy or behind a simple demo token — full OAuth is post-hackathon, not a
  day-of task.
- **Expose vs consume.** This is Re:lay _exposing_ an MCP. The mirror — Re:lay's own agent
  _consuming_ the Sillage MCP instead of REST — is a bigger change to Mat's pipeline; parked in Later.

**Effort**: ~half a day (read tools + `run_reengagement`; the write tools reuse `decideCase`).
**Demo-safe**: yes — runs on the fakes too. **Deps**: `@modelcontextprotocol/sdk`, `mcp-handler`.

---

## 🗣️ Talk to your pipeline — the Gradium voice bubble

A floating bubble (bottom-right) opens a **chat / voice assistant** that answers questions about the
pipeline and drives plays out loud: _"Which dead deals woke up this week?" · "Run the Kerneos play and
read me the angle." · "Approve the champion-first one."_ Using the hackathon's **Gradium** partnership
for the voice, this is the **third face of the same agent**:

| Face                  | Who uses it   | Sits on                           |
| --------------------- | ------------- | --------------------------------- |
| The **UI** (shipped)  | humans click  | `services/`                       |
| The **MCP** (shipped) | other agents  | `services/` (same tools)          |
| The **voice bubble**  | humans _talk_ | the **Re:lay MCP** tools + Claude |

**It reuses everything we're already building.** The bot's **brain** is **Claude** (Anthropic —
on-theme, keys in hand), its **ears + mouth** are **Gradium** (streaming STT + TTS), and its **hands**
are the **Re:lay MCP** tools from the section above. No bespoke data layer — "interacts with the data"
_is_ the MCP.

**What Gradium gives us**: ultra-low-latency **STT + TTS** (REST `POST` **and** WebSocket streaming),
voice cloning, 5 languages. Python/Rust SDKs + REST/WS — **no JS SDK**, but it can mint **short-lived
browser tokens** so the browser streams over WebSocket _without_ exposing the API key. That shapes the
build into tiers — ship the cheap one first, each degrades safely:

- ✅ **Tier 1 — text bubble _(shipped 9 juil.)_**: floating bubble → text chat with Claude wired to
  the Re:lay MCP tools. Pure TS. Proves the whole "talk to your pipeline" loop on its own.
- **Tier 2 — push-to-talk voice _(Gradium REST, +½ day)_**: hold to talk → record → Next route →
  Gradium STT → Claude + MCP → Gradium TTS → play. API key stays server-side. No sidecar.
- **Tier 3 — streaming voice _(Gradium WebSocket + short-lived token, +½ day)_**: our server mints a
  short-lived Gradium token; the browser opens Gradium STT/TTS WebSockets directly for near-real-time
  voice; the LLM turn (Claude + MCP) routes through our server. **The recommended "wow" path — no
  Python worker needed.**
- **Stretch — full-duplex agent _(Gradbot / Pipecat + LiveKit)_**: true turn-taking with semantic VAD
  and barge-in, but needs a Rust/Python worker + LiveKit infra → **Damien**. Post-hackathon unless
  infra time appears.

**Risks & notes:**

- **Key safety**: no JS SDK, so Gradium is called from a **Next server route** (REST) or the browser
  WebSocket with a **server-minted short-lived token** — the API key never reaches the browser.
- **Voice can be consequential**: if the bot can trigger `approve_play`, a spoken "approve it" must
  still hit an **on-screen confirm** before any CRM write — same gate as the MCP `destructiveHint`.
- **Privacy**: mic permission + audio streamed to Gradium — disclosed in the bubble.
- **Latency budget**: STT → LLM(+tools) → TTS chained; stream (Tier 3) to keep it conversational.

**Effort**: Tier 1 ½ day · Tier 2 +½ · Tier 3 +½ · stretch = Damien + infra. **Demo-safe**: Tier 1 is
pure-fake; the voice tiers fall back to text if the mic or socket fails. **Deps**: Anthropic SDK / our
MCP client (have the key), Gradium key (provided), LiveKit/Pipecat only for the stretch.

---

## 🔭 Later — post-hackathon

- **Persistence** — swap the `globalThis` in-memory stores for a real DB (cases, decisions, events).
- **Auth & multi-workspace** — real sign-in replacing the mock, per-workspace connectors & keys.
- **More channels** — in-app inbox, calendar hold on the rep's day, maybe SMS for hot signals.
- **Closed loop** — reply/meeting detection feeding a `reply_detected` event and win-back analytics.
- **Sequences** — multi-step cadence (email → deck → follow-up) instead of a single send.
- **Notification preferences** — per-user/per-event channel routing and quiet hours.
- **Broader Sillage coverage** — more signal types (funding proxy → native), agent tuning.
- **Re:lay consumes MCPs** — point Mat's agent at the **Sillage MCP** (and others) instead of raw
  REST, so the pipeline discovers its tools dynamically.
- **MCP auth** — real OAuth 2.1 on the MCP endpoint for multi-tenant use.
- **Full-duplex voice agent** — Gradbot / Pipecat + LiveKit worker for barge-in turn-taking.
- **Branded voice** — clone a consistent Re:lay / company voice with Gradium for the assistant.

---

## Sequencing for the day

Day-order by priority (independent of the section numbers above). The two most **on-theme** items
for an Anthropic agentic hackathon — the Anthropic swap and the MCP server — come first.

| Order | Task                                                         | Owner  | Risk | Fallback if a key/API bites |
| ----- | ------------------------------------------------------------ | ------ | ---- | --------------------------- |
| 1 ✅  | LLM → Anthropic swap                                         | Mat    | Low  | fake LLM                    |
| 2 ✅  | **MCP server**: read tools (`mcp-handler`)                   | Darren | Low  | runs on fakes               |
| 3 ✅  | Event dispatcher + re-route Slack through it                 | Darren | Low  | in-app preview              |
| 4 ✅  | MCP `run_reengagement` + `approve_play` (reuse `decideCase`) | Darren | Med  | runs on fakes               |
| 5 ✅  | **Voice bubble Tier 1** — text chat on the Re:lay MCP tools  | Darren | Low  | runs on fakes               |
| 6     | Gamma `ContentPort` + adapter + fake                         | Darren | Med  | instant fake link           |
| 7 ✅  | Email channel (Resend)                                       | Darren | Low  | in-app preview              |
| 8     | Join: deck link rides `play_approved` (Slack + email)        | Darren | Med  | —                           |
| 9     | **Voice bubble Tier 2/3** — Gradium STT/TTS (talk to it)     | Darren | Med  | falls back to text          |
| 10    | Weekly `digest_ready` deck _(first to cut)_                  | Darren | Med  | —                           |

**Reality check**: this is well past one builder-day. Treat it as a **priority queue** — realistically
we ship the top ~5 and the rest is stretch. Most rows land on Darren, so it's worth pulling **Mabrouk
/ Jana** onto the voice bubble or the Gamma port to parallelize.

**Rule of the day**: with keys for every tool in hand, we run **real adapters by default**. CRM,
enrichment and the LLM still fall back to fakes without their key; signals no longer have a fake
(team decision, 9 juil.) — the demo needs `SILLAGE_API_KEY`, and the curated cases cover a
worst-case offline pitch.

---

## Open questions (need answers before building)

- ✅ **API keys** — provided by the organizers for every sponsor tool (Sillage, FullEnrich,
  Anthropic, Gamma, Gradium). _Resolved._
- **Gamma**: which **theme** do we target — a brand theme, or the default for the demo? Roughly how
  many credits are on the account (caps how freely we regenerate live)?
- **Email**: **Resend** isn't a sponsor tool, so this one's still our call — Resend OK, and which
  **from-address** (a test domain, or does Damien have a domain we can verify)? If neither, we ship
  the preview-only path.
- **Slack**: keep the single `#sales-signals` channel, or route different events to different
  channels?
- **MCP**: is a working MCP a **judged requirement**, or a differentiator we choose to headline in
  the pitch? For the demo endpoint — run it **unauthenticated** on the deploy, or gate it behind a
  simple demo token? (Full OAuth 2.1 is post-hackathon.)
- **Gradium (voice)**: how deep do we go — **text bubble** (Tier 1), **push-to-talk** (Tier 2), or
  **streaming voice** (Tier 3)? Which **voice** from the catalog, or clone a brand voice? Full-duplex
  barge-in needs Damien on a LiveKit worker — in or out for the day?
- **Scope call**: if the day gets tight, cut from the bottom — weekly digest first, then voice
  **Tiers 2/3**, then email's real send (keep the preview). Protect the core agentic story: the
  Anthropic swap, the **MCP** read tools + `run_reengagement`, the notification dispatcher, the voice
  bubble **Tier 1 (text)**, and per-account Gamma decks.

---

### References

- Gamma Generate API — <https://developers.gamma.app/> (`POST /v1.0/generations`, async polling,
  GA since Nov 2025).
- Resend (email) — <https://resend.com/docs>.
- MCP TypeScript SDK — <https://github.com/modelcontextprotocol/typescript-sdk> · `mcp-handler` (Next
  route handler) — <https://github.com/vercel/mcp-handler>.
- Gradium voice AI (STT/TTS, WebSocket streaming, short-lived browser tokens) —
  <https://docs.gradium.ai/> · Gradbot (voice-agent framework) —
  <https://github.com/gradium-ai/gradbot>.
