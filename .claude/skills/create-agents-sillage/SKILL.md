---
name: create-agents-sillage
description: Use when a HubSpot/CRM connection has just been established for a Re:lay workspace and the Sillage side must be stood up or reconciled — pushing the CRM's closed-lost accounts to Sillage, deriving a persona from them, and getting the three re-engagement agents live. Triggers: "connect HubSpot", "sync lost deals to Sillage", "set up the Sillage workspace", "create / activate the Sillage agents", "the agents exist but aren't running", "run this after the CRM connection".
---

# Create & activate Sillage agents after a CRM connection

## Overview

Re:lay revives closed-lost CRM deals. When a CRM (HubSpot) connects, the Sillage workspace has to
mirror it: the **lost accounts** become Sillage **target accounts**, the people who owned those deals
become the **persona**, and three agents go live to watch those accounts for revival signals.

This skill is the reconciliation procedure for the Sillage side. It is **idempotent**: run it once or
run it after every CRM sync — it creates what's missing and activates what already exists, never
duplicating.

**Transport:** there is no Sillage MCP in this repo. Every call is the v2 REST API. The endpoints,
auth, polling model, and error codes live in the **`sillage-api`** skill — read it for the HTTP
details; this skill only covers _what_ to call and _in what order_ for Re:lay.

## Preconditions

- `SILLAGE_API_KEY` (an `sk_live_` key) is present in `.env`. It scopes every call to one workspace.
- The CRM connection is live, so closed-lost deals (and their company domains + contacts) are readable.
- Base URL `https://api.getsillage.com/api/v2`, header `Authorization: Bearer <key>`.

## The three target agents

These are the only agent types Re:lay's adapter (`src/integrations/signals/sillage.ts`) maps onto a
`Signal`. Anything else is dropped, so create only these three.

| Sillage agent type              | Re:lay name                   | Params                                   | Re:lay signal        | Needs persona first?  |
| ------------------------------- | ----------------------------- | ---------------------------------------- | -------------------- | --------------------- |
| `job_update`                    | Re:lay – Mouvements décideurs | none                                     | `new_decision_maker` | no                    |
| `job_posting_keyword_detection` | Re:lay – Recrutements GTM     | `tracking_keywords[]` (GTM role titles)  | `job_posting`        | no                    |
| `keyword_detection`             | Re:lay – Signaux de levée     | `tracking_keywords[]` (funding / intent) | `funding`            | **yes (422 without)** |

`keyword_detection` (LinkedIn-post keywords) is **refused with 422 until a persona exists** — this is
why persona creation comes before agent creation in the order below. The funding keywords must overlap
the `FUNDING_PATTERN` regex in `sillage.ts` or the detections get filtered out downstream.

## Order of operations

Run these in sequence — each step depends on the previous. All three writes to Sillage are async
(`202` / poll); see `sillage-api` for the poll targets and terminal states.

1. **Pull closed-lost accounts from the CRM.**
   Read the CRM's closed-lost deals and collect, per account: the **company domain** (Sillage's
   preferred identifier) and the **contacts** who owned the deal (name, job title, location). In the
   local fake CRM, lost accounts are `status: "lost"` in `src/integrations/crm/data.json`; against real
   HubSpot, query closed-lost deals → associated companies (`domain`) + contacts.

2. **Add them as Sillage target accounts.**
   `POST /top-account-list/accounts` with `{accounts:[{domain}, …]}` (this **merges** — existing kept).
   → `202` → poll `GET /top-account-list/status` to `completed` → check `GET /top-account-list/accounts/not-found`
   for domains Sillage couldn't resolve, and report them.

3. **Derive and set the persona from the lost deals' contacts.**
   Persona is **replace-whole**: `GET /persona` → merge your derived fields into the full object →
   `PUT /persona`. Minimum required: `job_title[]` and `location[]` (else the workspace stays blocked).
   Derive `job_title[]` from the contacts' titles, `location[]` from their locations, and set
   `additional_info` describing the ICP. Confirm the derived persona with the user before PUT — it is
   the workspace's ICP and overwrites whatever was there.

4. **Reconcile the three agents (create-or-activate).**
   `GET /agents?page_size=25` once. For **each** of the three target types, decide by the table below.
   Match on **type**, not name — one agent per type is the invariant.

5. **Launch a signal run per agent** so it actually goes and looks.
   `POST /workspace/signal-runs` `{agent_id}` per agent → poll `GET /workspace/signal-runs/{id}` to a
   terminal stage. Keyword agents → 1 run; watchlist agents → 2. Keyword agents accept
   `parameters.lookback_days` (default 90).

## Create vs. activate — the decision per agent type

This is the core of the skill: an agent existing is not the same as it running.

| State found in `GET /agents`                     | Action                                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| No agent of this type                            | **Create** — `POST /agents` `{name, type, parameters?}` (created `enabled:true`).       |
| Exists, `enabled:false`                          | **Activate** — `PUT /agents/{id}` `{enabled:true}`. Do **not** POST a new one.          |
| Exists, `enabled:true`, but no run has been run  | **Activate** — just launch the signal run (step 5). Already enabled; nothing to create. |
| Exists with wrong/empty keywords (keyword types) | **Reconfigure** — `PUT /agents/{id}` `{parameters:{tracking_keywords:[…]}}`, then run.  |

**Never delete-and-recreate an existing agent.** A new `POST` mints a new agent id — and for watchlist
types, a new auto-spawned watchlist id — orphaning the list that was populated. Edit in place with `PUT`.

## Idempotency & safety rules

- **One agent per type.** Before any `POST /agents`, confirm no agent of that type already exists.
- **Persona before `keyword_detection`.** Creating the LinkedIn-post keyword agent without a persona
  returns `422`. The other two types don't need it.
- **Target-account add is a merge**, not a replace — re-running never wipes the list. (Only
  `POST /top-account-list` replaces; do not use it here.)
- **Everything is pull + async.** After every write that returns `202`, poll the matching status
  endpoint to a terminal state before moving on. Sillage emits no webhooks.
- **Typed errors, no blind retry** (RFC 9457 `application/problem+json`): `401` bad key, `402` out of
  credits, `403` feature not enabled for the workspace, `429` rate-limited (back off on
  `X-RateLimit-Remaining`). Surface these to the user; don't loop.

## Keyword starting sets

Adjust to the customer's market, but these are the Re:lay defaults (bilingual FR/EN):

- **Funding / intent** (`keyword_detection`): levée de fonds, tour de table, Series A/B/C/D, seed,
  pre-seed, amorçage, fundraising, financement, raised, funding round, venture capital, capital-risque,
  investissement, valorisation, IPO, acquisition, merger, fusion, expansion. _(Keep terms that match the
  `FUNDING_PATTERN` regex in `sillage.ts` so detections survive the adapter.)_
- **GTM roles** (`job_posting_keyword_detection`): Revenue Operations, RevOps, Sales Operations, Head of
  Sales, VP Sales, Chief Revenue Officer, CRO, Directeur Commercial, Head of Marketing, CMO, Demand
  Generation, Growth, SDR, BDR, Business Development, Go-to-Market, Sales Enablement, Customer Success.

## Close with a summary

```
## Target accounts
<domains added · resolved vs not-found>

## Persona
<job_title[] / location[] set — derived from N lost-deal contacts>

## Agents
<per type: created (id) | activated (id) | reconfigured (id)>

## Runs launched
<agent_id → signal_request_id(s), stage> — and which status endpoints to poll next.
```

## Common mistakes

- **Treating "created" as "live."** An agent created enabled still produces nothing until a signal run
  is launched. Activation = enabled **and** a run launched.
- **Duplicating agents** by matching on name instead of type, or by POSTing before checking `GET /agents`.
- **Creating `keyword_detection` before the persona** → `422`. Order matters.
- **Using `POST /top-account-list`** (destructive replace) instead of `POST /top-account-list/accounts`
  (merge) — the former wipes accounts added by earlier syncs.
- **Pushing company names instead of domains** as target accounts — resolution accuracy drops; prefer
  `{domain}`.
