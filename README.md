# Re:lay

**Lost deals, second chances.** Re:lay is an agentic GTM copilot that resurrects closed-lost CRM
opportunities. It turns passive buying signals — a champion changing jobs, a funding round, a
competitor stumbling, a renewed visit to your site — into ranked, reasoned, human-approved
re-engagement plays.

> Sillage finds **who** is back in play. FullEnrich finds **how** to reach them.
> Re:lay decides **whether it's worth it**, drafts the move, and lets a human ship it.

Built at the **Agentic GTM Hackathon** (Anthropic × FullEnrich × Sillage) — Station F, Paris,
9 July 2026. Partner APIs in play: **Sillage · FullEnrich · Anthropic · Gamma · Gradium** (keys
provided at the event).

**Live demo:** <https://www.shonen.app/hackathon-sillage-anthropic>

**Jump to:** [The stakes](#the-stakes) · [What it does](#what-it-does) ·
[Signature features](#signature-features) · [Stack](#stack) · [Architecture](#architecture) ·
[Getting started](#getting-started) · [Deployment](#deployment) · [Roadmap](#roadmap) ·
[Team](#team-42--station-f) · [The 90-second demo](#the-90-second-demo)

---

## The stakes

Every CRM is a graveyard. Deals die for reasons that expire — "no budget this quarter," "our
champion left," "went with a competitor" — and nobody circles back when the reason stops being
true. UserGems and others already **detect** those signals; the hard, unsolved part is the
**strategy and action layer**: given a signal, is this deal actually revivable, what's the angle,
who do we contact, and what do we say?

That's Re:lay's wedge. We don't compete on detection — we compete on the reasoning between the
signal and the send.

**The hackathon brief** asks for something _"deployable and usable by a real GTM team by end of
day… including working sequences, live webhooks, and agents with real tool calls."_ Re:lay hits
each of those: a real LangGraph agent with tool calls, a live Slack webhook on approval, and a
full review-and-ship workflow. Prizes span cash and Anthropic API credits across the podium tiers.

---

## What it does

Re:lay runs a six-stage agent over each closed-lost deal that lights up with a fresh signal:

```
   Sillage signal
        │
        ▼
  ┌───────────┐   deal is closed-lost & signal is relevant?
  │  qualify  │──── no ──▶  END  (drop, never bothers the rep)
  └───────────┘
        │ yes
        ▼
  ┌───────────┐   why did we lose? has that reason expired?
  │  analyst  │   → deal autopsy (summary + loss factors)
  └───────────┘
        │
        ▼
  ┌───────────┐   who do we reach now? (FullEnrich enrichment)
  │ researcher│   → target contact w/ verified email
  └───────────┘
        │
        ▼
  ┌───────────┐   go / no-go verdict (scored) + re-engagement plan:
  │ strategist│   angle, talking points, email draft, A/B alt angles
  └───────────┘
        │
        ▼
  ┌───────────┐   ⏸ interrupt() — the rep approves / edits / rejects
  │humanReview│         (this is the demo's money shot)
  └───────────┘
        │ approve            │ reject
        ▼                    ▼
  ┌───────────┐             END
  │  syncCrm  │   contact upserted · note logged · stage → Re-engaged
  └───────────┘   + Slack & email announcements to the team
        │
        ▼
       END
```

The graph is a LangGraph `StateGraph` compiled with a `MemorySaver` checkpointer. `humanReview`
uses `interrupt()` / `Command({ resume })` so the run genuinely **pauses** on the human decision
and resumes exactly where it left off — no polling, no re-running the model. The front-end never
talks to LangGraph directly: a **pipeline bridge** translates graph state into the front's
`ReengagementCase` contract, so curated demo cases and live agent runs flow through the exact same
list → detail → decision screens.

---

## Signature features

- **A/B re-engagement angles.** The strategist surfaces _more than one_ strategically distinct way
  back into the account (e.g. "familiar-tool warm intro" vs. "champion-first re-open"). The rep
  toggles angles with keys `1` / `2` in the decision screen and the email + rationale morph live.
  The chosen angle is persisted on the case. This is the differentiator — the rep steers the
  _strategy_, not just the wording.
- **Human-in-the-loop decision screen.** Approve / edit / reject. Edits diff against the agent's
  original draft, so you always see what the human changed. This is the pitch's center of gravity.
- **CRM sync receipt.** On approval, a "Synced to HubSpot" card shows the write-back happening —
  contact upserted, note logged, deal stage → _Re-engaged_ — with a timestamp. Makes the agent's
  output tangible instead of a black box.
- **Live notifications — Slack + email.** Domain events (`play_approved`, `review_requested`) fan
  out through a dispatcher to a Slack webhook (Block Kit — the brief's "live webhooks") and email
  (Resend). Each channel is env-gated and fail-safe: unconfigured → honest no-op; a down channel
  never breaks the pipeline action.
- **Recoverable-revenue projection.** The dashboard turns revivable pipeline into the number a CRO
  actually tracks — recovered revenue at a draggable win-back rate (5–40%). CRO's exact language.
- **MCP server.** Re:lay is itself a tool other agents can drive: 7 MCP tools
  (`list_revivable_deals`, `run_reengagement`, `approve_play`…) served over Streamable HTTP at
  `/api/mcp` — point Claude at the live deploy and run the whole workflow in natural language.
  `run_reengagement` deliberately stops at the human-review gate; a calling agent proposes, a human
  approves.
- **"Ask Re:lay" assistant.** A floating chat bubble on every screen: Claude wired to the exact
  same tool registry the MCP exposes. Ask "which deals are worth reviving?", run the agent, approve
  a play — in plain language. The route streams progress events, so every step the agent takes is
  its own bubble in the transcript (vendor favicon, live spinner → check), stays there for good,
  and expands on click to show what happened — the result summary or the error. Model-routed:
  the chat loop runs **Haiku 4.5** (~3s turns), the deep reasoning stays on Sonnet in the
  pipeline. Needs `ANTHROPIC_API_KEY`; degrades to an honest hint without it.

---

## Stack

| Layer         | Choice                                                                     |
| ------------- | -------------------------------------------------------------------------- |
| Framework     | **Next.js 16** (App Router, RSC-first)                                     |
| Language      | **TypeScript** (strict)                                                    |
| Agent runtime | **LangGraph** (`@langchain/langgraph`) with `MemorySaver` + `interrupt()`  |
| LLM           | **`@langchain/anthropic`** behind a swappable `LlmClient` port¹            |
| Assistant     | Raw **Anthropic Messages API** tool-use loop — **Haiku 4.5**, model-routed |
| Validation    | **Zod v4** — at the HTTP boundary _and_ the domain boundary                |
| Styling       | **Tailwind CSS v4** + **shadcn/ui** (`base-nova`), **lucide-react** icons  |
| Server-state  | **TanStack Query** (no manual `useEffect` + `fetch`)                       |
| Motion        | `tw-animate-css`, custom motion helpers, `@react-three/fiber` (auth scene) |
| Tests         | **Vitest** + Testing Library                                               |
| Tooling       | ESLint (flat) · Prettier (+ tailwind plugin) · Husky · lint-staged         |
| Runtime       | **Node ≥ 24**, **npm ≥ 11** (pinned via `engines`)                         |

¹ _The LLM client is isolated behind a port, so the provider lives entirely in
`integrations/llm/` — swapping it for another backend touches nothing else._

No auth backend, no database this iteration — deliberate. State lives in in-memory stores anchored
on `globalThis` so it survives dev recompiles. DB/Auth are post-hackathon scope.

---

## Architecture

One-way dependency, no business logic in routes or RSCs:

```
integrations/  →  services/  →  app/api/**/route.ts           (HTTP entry, Zod-validated)
                            |→  app/**/page.tsx                (RSC, reads via a service)
                            |→  app/api/[transport]/route.ts   (MCP server — same services)
                            \→  app/api/assistant/route.ts     (chat assistant, NDJSON stream)
```

- **`src/integrations/`** — external I/O only, each behind a **port** so implementations are
  swappable:
  - `crm/` — HubSpot-style CRM (fake + local `data.json`)
  - `enrichment/` — FullEnrich-style contact enrichment (fake)
  - `signals/` — **real Sillage adapter** (`sillage.ts`): v1 person-centric feed with a v2
    detections fallback (live workspaces expose their detections only there). No fake: without
    `SILLAGE_API_KEY` the signal list is simply empty.
  - `llm/` — the Anthropic client (`client.ts`) + a deterministic fake when no key (`fake.ts`)
  - `notifications/` — the Slack webhook + Resend email channels
  - `pipeline.ts` — curated demo cases + decision persistence
- **`src/services/`** — business logic & orchestration:
  - `pipeline/` — the LangGraph graph, nodes, and state
  - `pipeline-bridge/` — translates graph runs into `ReengagementCase`s (`index.ts` + `map.ts`)
  - `relay-tools.ts` — **the shared agent tool registry**: 7 tools consumed by both the MCP
    server and the chat assistant; add a tool once, it ships everywhere
  - `assistant.ts` — the chat brain: Anthropic tool-use loop over the registry, streams progress
  - `notifications.ts` — renders `RelayEvent`s once, fans out to every configured channel
  - `reengagement.ts` — the read/decide API the screens call; `decideCase` fans out to CRM sync +
    Slack + email and returns `DecisionEffects`
  - `connectors.ts`, `workspace.ts`
- **`src/types/`** — Zod domain schemas (suffix `Schema`) + inferred types. The
  `ReengagementCase` contract in `reengagement.ts` is the spine everything agrees on.
- **`src/app/`** — route groups `(app)` (dashboard, case detail) and `(auth)` (mock sign-in).
- **`src/lib/`** — cross-cutting utils: `env.ts` (Zod-validated env), `base-path.ts`, `score.ts`,
  `diff.ts`, `motion.ts`, `logos.ts`, `format.ts`.

**Guardrails** (enforced by `CLAUDE.md` + review): Zod at both boundaries · secrets only in
`.env` · no business logic in routes/RSCs · no `fetch`+`useEffect` for server-state · never edit
generated `src/components/ui/` files, compose over them.

---

## Getting started

```bash
# Node 24+ / npm 11+ required (see engines)
npm install
cp .env.example .env      # all keys optional — see below
npm run dev               # http://localhost:3000
```

The app runs at the **root** locally (`localhost:3000`). In production it's served under a
sub-path via `basePath` (see Deployment), driven entirely by `NEXT_PUBLIC_BASE_PATH`.

**Two keys matter, the rest is optional.** `SILLAGE_API_KEY` feeds real signals (there is no fake
signal source anymore — without it the workspace is empty, though the curated demo cases still
work), and `ANTHROPIC_API_KEY` powers real reasoning plus the assistant (without it the pipeline
falls back to a deterministic fake model and the chat answers with an honest hint). CRM and
enrichment remain fakes by design for the hackathon.

### Commands

```bash
npm run dev         # dev server (Turbopack)
npm run build       # production build
npm run start       # serve the build
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run format      # Prettier --write
npm run test        # Vitest (watch)
npm run test:run    # Vitest (once)
```

A Husky `pre-commit` hook runs `lint-staged` (ESLint --fix + Prettier) on staged files.

### Environment variables

All optional — absence degrades gracefully (fake, no-op, or empty). Every var must be declared in
the Zod schema in `src/lib/env.ts` before use (never read `process.env` directly elsewhere).

| Variable                             | Effect when set                                                            |
| ------------------------------------ | -------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`                  | Real Claude in the pipeline + the assistant; unset → fake model, chat hint |
| `SILLAGE_API_KEY`                    | Real Sillage signals (`sk_live_…`); unset → empty signal list (no fake)    |
| `ASSISTANT_MODEL`                    | Chat-model override; unset → Haiku 4.5 (pipeline stays on Sonnet)          |
| `SLACK_WEBHOOK_URL`                  | Events (`play_approved`, `review_requested`) post to the channel           |
| `RESEND_API_KEY` + `NOTIFY_EMAIL_TO` | Same events go out by email (Resend); `RESEND_FROM` optional               |
| `FULL_ENRICH_API_KEY`                | Reserved — the real enrichment adapter isn't wired yet                     |
| `NEXT_PUBLIC_BASE_PATH`              | Serves the app under a sub-path (prod); unset → root                       |

### Demo controls

The dashboard gates on connectors: no signal engine / CRM / enrichment connected → no plays, and a
setup banner shows what's missing. Once connected, the **Run agent** dialog plays a live pipeline
run, and **Reset demo** returns to a clean slate — so the pitch is repeatable back-to-back.

---

## Deployment

Hosted at **`https://www.shonen.app/hackathon-sillage-anthropic`**, behind Traefik. Next's
`basePath` prefixes every route and asset (`/_next/…`) with the sub-path, so Traefik routes the
prefix through as-is (no `stripprefix`). `basePath` comes from `NEXT_PUBLIC_BASE_PATH`, so the same
build runs at the root locally and under the sub-path in prod. `allowedDevOrigins` whitelists the
proxy origin for HMR in dev.

---

## Roadmap

Re:lay is becoming **one agent with three faces**, all sitting on the same `services/` layer:

| Face                | Who uses it   | Status                      |
| ------------------- | ------------- | --------------------------- |
| The **UI**          | humans click  | shipped                     |
| The **MCP server**  | other agents  | shipped                     |
| The **chat bubble** | humans _talk_ | shipped (text) — voice next |

All three faces share one tool registry (`services/relay-tools.ts`) — a tool added there ships to
the MCP and the assistant at once. Next up: **Gamma**-generated re-engagement decks and **Gradium**
voice on the bubble. Full plan, sequencing, and open questions in **[ROADMAP.md](./ROADMAP.md)**.

---

## Team (42 · Station F)

| Who                              | Owns                                                      |
| -------------------------------- | --------------------------------------------------------- |
| **Matéo Le Bras Sancho** ("Mat") | LangGraph agent — nodes, graph, state                     |
| **Darren Cohen**                 | Front-end + integration layer (bridge, adapters, screens) |
| **Damien Mathis** ("Kirua")      | Infra & deployment (shonen.app, CI, engines/lockfile)     |
| **Mabrouk Chouikri**             | —                                                         |
| **Janadan Ilankumaran** ("Jana") | —                                                         |

---

## The 90-second demo

1. **Dashboard** — revivable pipeline, signals matched, go verdicts. Drag the ROI slider: a lost
   pipeline becomes _recoverable revenue_.
2. **Run agent** — watch the six nodes light up with real tool calls (Sillage → CRM → FullEnrich →
   LLM), pausing at human review.
3. **Decision screen** — read the autopsy and the scored go verdict. Toggle the **A/B angle**
   (`1`/`2`) — the email rewrites itself around the new strategy. Edit a line.
4. **Approve** — the **CRM sync receipt** writes back to HubSpot and **Slack + email** fire to the
   team, live.
5. **Ask Re:lay** — open the bubble: _"run the agent on the best signal."_ Watch it scan Sillage,
   run the pipeline, and hand you the approval — every step a bubble, every bubble inspectable.

> A human closed the loop on a dead deal in under two minutes — and the agent did everything except
> decide.
