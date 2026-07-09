import type { EmailDraft, ReengagementCase } from "@/types/reengagement";

// Mocked output of the Re:lay agent pipeline (signal → qualify → analyst →
// go/no-go → researcher → strategist). Replace with the LangGraph agent once
// Sillage/FullEnrich access is available.
const MOCK_CASES: ReengagementCase[] = [
  {
    id: "case-kerneos",
    deal: {
      id: "opp-2025-0142",
      company: { name: "Kerneos Analytics", domain: "kerneos.io", industry: "Data & Analytics" },
      amount: 86_400,
      currency: "EUR",
      lostAt: "2026-01-14",
      lossReason: "blocked_by_stakeholder",
      lossNotes:
        "Champion (Head of Growth) was on board, but CMO Claire Fontaine pushed back on price and killed the deal in the final committee.",
      previousContact: { name: "Claire Fontaine", role: "CMO" },
    },
    signal: {
      id: "sig-8841",
      type: "job_change",
      title: "The blocker left — her replacement comes from a customer",
      description:
        "Claire Fontaine (CMO) left Kerneos Analytics. Thomas Béraud joined as CMO, coming from Diato where he used a workflow like ours daily.",
      detectedAt: "2026-07-02",
      source: "Sillage — people move",
    },
    autopsy: {
      summary:
        "The deal was not lost on product fit: the evaluation team scored us first. It was lost in the final committee on price, with the CMO as sole blocker.",
      lossFactors: [
        "CMO objected to annual pricing vs. incumbent tooling",
        "Champion had no executive sponsor in the committee",
        "Procurement froze all new vendors for Q1",
      ],
    },
    verdict: {
      decision: "go",
      score: 92,
      reasoning:
        "The single blocker is gone and the new CMO comes from an active customer account — he knows the product's value first-hand. The original champion is still in place. Highest possible re-entry conditions.",
      factors: {
        signalStrength: { score: 95, note: "Replacement comes from an active customer account" },
        lossReasonFit: {
          score: 98,
          note: "The signal removes the exact person who blocked the deal",
        },
        timing: { score: 75, note: "6 months since loss — inside the ideal re-entry window" },
      },
    },
    plan: {
      targetContact: {
        name: "Thomas Béraud",
        role: "CMO",
        email: "t.beraud@kerneos.io",
        phone: "+33 6 44 12 98 30",
        enrichment: { providersTried: 3 },
      },
      angle:
        "Warm re-entry through familiarity: reference his hands-on usage at Diato, reactivate the internal champion, and reframe pricing around the exact committee objection from January.",
      talkingPoints: [
        "He shipped 2 campaigns/quarter faster at Diato with our workflow — cite the case study",
        "Re-engage Léa Marchand (Head of Growth), still champion internally",
        "Lead with the new usage-based tier — it directly answers the January price objection",
      ],
      emailDraft: {
        subject: "Diato → Kerneos: picking up where you left off",
        body: "Hi Thomas,\n\nCongrats on the new role at Kerneos. Your team at Diato has been running their growth reporting on our platform for two years — I believe you built the attribution workflow yourself.\n\nWe talked with Kerneos in January; the team rated us first on product but the timing and pricing model didn't fit. Both have changed: we now have a usage-based tier that maps to how Léa's team actually works.\n\nWorth a 20-minute look at what your old setup would look like at Kerneos?\n\nBest,\n",
      },
      angleLabel: "Familiar-tool warm intro",
      altAngles: [
        {
          id: "champion-first",
          label: "Champion-first re-open",
          rationale:
            "Let Léa Marchand — still your champion inside Kerneos — reopen the file with the new CMO, so you arrive backed by an internal advocate instead of cold.",
          emailDraft: {
            subject: "Léa already runs us — worth 15 minutes?",
            body: "Hi Thomas,\n\nCongrats on the CMO seat at Kerneos. One thing you'll find internally: Léa Marchand's growth team evaluated us last year and rated us first — she's been an advocate ever since.\n\nWe didn't close in January (pricing, decided in the final committee), but the model has changed and Léa knows exactly where we'd fit her workflow.\n\nHappy to let her walk you through it, or to do it together — 15 minutes whenever suits.\n\nBest,\n",
          },
        },
      ],
    },
    status: "pending_review",
  },
  {
    id: "case-wattly",
    deal: {
      id: "opp-2025-0097",
      company: { name: "Wattly", domain: "wattly.energy", industry: "Energy / IoT" },
      amount: 48_000,
      currency: "EUR",
      lostAt: "2025-11-21",
      lossReason: "no_budget",
      lossNotes:
        "Strong fit, but the 2026 budget was already committed. Asked us to come back 'someday'.",
      previousContact: { name: "Igor Melnik", role: "VP Operations" },
    },
    signal: {
      id: "sig-9102",
      type: "funding",
      title: "Series A of €12M announced",
      description:
        "Wattly raised a €12M Series A led by Breega to scale its commercial team across Europe.",
      detectedAt: "2026-06-28",
      source: "Sillage — funding announcements",
    },
    autopsy: {
      summary:
        "A textbook budget loss: the evaluation was positive across all stakeholders and no competitor was selected. The deal died purely on available budget.",
      lossFactors: [
        "2026 budget fully committed at time of decision",
        "No competing solution chosen — status quo won",
      ],
    },
    verdict: {
      decision: "go",
      score: 84,
      reasoning:
        "The only loss factor (budget) has been directly removed by a €12M raise, and the round's stated purpose (commercial scaling) is exactly our use case. The original contact is still VP Operations.",
      factors: {
        signalStrength: {
          score: 80,
          note: "Confirmed Series A with a stated commercial-scaling goal",
        },
        lossReasonFit: {
          score: 95,
          note: "Funding directly removes the only loss factor (budget)",
        },
        timing: { score: 70, note: "Raise announced 9 days ago — budget cycle just opening" },
      },
    },
    plan: {
      targetContact: {
        name: "Igor Melnik",
        role: "VP Operations",
        email: "igor@wattly.energy",
        enrichment: { providersTried: 1 },
      },
      angle:
        "Congratulate on the raise, recall their own 'come back when we have budget' framing, and anchor on the scaling plans announced in the funding press release.",
      talkingPoints: [
        "They explicitly asked us to return when budget opened — quote the November email",
        "Series A press release mentions doubling the ops team: our exact use case",
        "Propose a pilot scoped to the new team onboarding",
      ],
      emailDraft: {
        subject: "You said 'when we have budget' — congrats on the €12M",
        body: "Hi Igor,\n\nCongratulations on the Series A — scaling ops across Europe is exactly the challenge we talked about in November.\n\nBack then you told me the fit was there but the budget wasn't, and to come back when that changed. Taking you at your word.\n\nShall we scope that pilot for the new team's onboarding?\n\nBest,\n",
      },
    },
    status: "pending_review",
  },
  {
    id: "case-meridiem",
    deal: {
      id: "opp-2025-0121",
      company: { name: "Meridiem", domain: "meridiem.fr", industry: "Fintech" },
      amount: 72_000,
      currency: "EUR",
      lostAt: "2025-12-09",
      lossReason: "competitor",
      lossNotes:
        "Chose Salesloop for its native ERP integration. Decision was close (scoring 52/48).",
      previousContact: { name: "Sofia Andrade", role: "Head of RevOps" },
    },
    signal: {
      id: "sig-9260",
      type: "competitor_issue",
      title: "Public complaint about the chosen competitor",
      description:
        "Sofia Andrade (Head of RevOps) posted on LinkedIn about 'six months fighting a CRM integration that was sold as native'. Salesloop's ERP connector is the pain point.",
      detectedAt: "2026-06-30",
      source: "Sillage — keyword & social monitoring",
    },
    autopsy: {
      summary:
        "Lost in a near-tie against Salesloop, decided by a single criterion: their claimed native ERP integration. Every other criterion favored us.",
      lossFactors: [
        "Salesloop claimed native ERP integration (deciding factor)",
        "Our connector was roadmap-only at the time",
      ],
    },
    verdict: {
      decision: "go",
      score: 71,
      reasoning:
        "The exact criterion that decided the deal is now publicly failing, voiced by the decision-maker herself. Our ERP connector shipped in March. Sensitive play — must not gloat.",
      factors: {
        signalStrength: {
          score: 75,
          note: "Public complaint voiced by the decision-maker herself",
        },
        lossReasonFit: {
          score: 90,
          note: "The deciding criterion (ERP integration) is now failing",
        },
        timing: {
          score: 25,
          note: "7 months into the competitor contract — switching cost is high",
        },
      },
    },
    plan: {
      targetContact: {
        name: "Sofia Andrade",
        role: "Head of RevOps",
        email: "s.andrade@meridiem.fr",
        enrichment: { providersTried: 2 },
      },
      angle:
        "Empathetic, zero told-you-so: acknowledge the integration pain publicly described, announce our connector shipped in March, offer a technical validation call — not a sales call.",
      talkingPoints: [
        "Our ERP connector shipped in March — demo against their exact stack",
        "Offer a technical proof-of-concept with their own data, no commitment",
        "Migration path from Salesloop documented — switching cost is the real objection now",
      ],
      emailDraft: {
        subject: "ERP integrations are hard — ours finally isn't",
        body: "Hi Sofia,\n\nYour post about integration promises resonated — that pain is why we refused to sell ours before it existed. It shipped in March.\n\nNo pitch: if it would help, my solutions engineer can run your exact ERP flow through it in a 30-minute technical session. If it doesn't hold up, you'll have lost half an hour and gained ammunition.\n\nInterested?\n\nBest,\n",
      },
    },
    status: "approved",
  },
  {
    id: "case-altiflow",
    deal: {
      id: "opp-2026-0018",
      company: { name: "Altiflow", domain: "altiflow.com", industry: "Logistics" },
      amount: 39_500,
      currency: "EUR",
      lostAt: "2026-02-17",
      lossReason: "timing",
      lossNotes: "Mid-reorg: 'call us back when the new sales org is in place'.",
      previousContact: { name: "Marc Vidal", role: "CRO" },
    },
    signal: {
      id: "sig-9315",
      type: "hiring_surge",
      title: "8 account executive openings posted",
      description:
        "Altiflow published 8 AE and 2 sales ops roles in three weeks — the post-reorg sales org is being staffed.",
      detectedAt: "2026-07-01",
      source: "Sillage — hiring signals",
    },
    autopsy: {
      summary:
        "Not a rejection: the deal was parked during a sales reorganization. The CRO explicitly invited a follow-up once the new org exists.",
      lossFactors: [
        "Company-wide reorg froze tooling decisions",
        "No owner for the project during transition",
      ],
    },
    verdict: {
      decision: "go",
      score: 65,
      reasoning:
        "The hiring surge is the concrete evidence that the reorg blocking the deal is over. Slightly lower confidence: the CRO may have changed priorities, and new hires mean competing onboarding projects.",
      factors: {
        signalStrength: {
          score: 60,
          note: "Hiring surge is an indirect signal — no direct buying intent",
        },
        lossReasonFit: { score: 75, note: "10 sales openings show the blocking reorg is over" },
        timing: {
          score: 55,
          note: "New hires arriving — onboarding window opens, but priorities compete",
        },
      },
    },
    plan: {
      targetContact: {
        name: "Marc Vidal",
        role: "CRO",
        email: "m.vidal@altiflow.com",
        enrichment: { providersTried: 1 },
      },
      angle:
        "Frame the product as the onboarding accelerator for the 8 new AEs — the reorg that killed the deal becomes the reason to buy now.",
      talkingPoints: [
        "You asked us to call back once the new org was in place — the 8 open AE roles say it is",
        "Ramp-up time for new AEs is the #1 cost of a rebuilt sales org",
        "Offer to be part of the new-hire onboarding stack from day one",
      ],
      emailDraft: {
        subject: "8 new AEs — the follow-up you asked for",
        body: "Hi Marc,\n\nIn February you asked me to come back once the new sales org was standing. Eight AE openings later, it looks like it is — congrats on getting there.\n\nOne thought: the teams that plug us in during onboarding ramp their new reps about 30% faster than those who retrofit later. With 8 people arriving, that window is now.\n\n15 minutes this week?\n\nBest,\n",
      },
    },
    status: "pending_review",
  },
  {
    id: "case-toundra",
    deal: {
      id: "opp-2025-0203",
      company: { name: "Toundra Studio", domain: "toundra.studio", industry: "Creative SaaS" },
      amount: 18_000,
      currency: "EUR",
      lostAt: "2026-03-05",
      lossReason: "price",
      lossNotes: "Loved the product, seed-stage budget. Went with a cheaper point solution.",
      previousContact: { name: "Jeanne Okafor", role: "Co-founder & COO" },
    },
    signal: {
      id: "sig-9377",
      type: "funding",
      title: "Seed extension of €2M",
      description: "Toundra Studio announced a €2M seed extension to grow its B2B offering.",
      detectedAt: "2026-06-25",
      source: "Sillage — funding announcements",
    },
    autopsy: {
      summary:
        "Price-driven loss at a seed-stage company: genuine product enthusiasm, but our entry tier exceeded their whole tooling budget.",
      lossFactors: [
        "Entry price above their total tooling budget",
        "A cheaper point solution covered 60% of the need",
      ],
    },
    verdict: {
      decision: "go",
      score: 58,
      reasoning:
        "New money removes part of the constraint, but a €2M extension rarely changes tooling budgets radically, and they already own a partial solution. Worth a light-touch attempt only.",
      factors: {
        signalStrength: { score: 50, note: "A €2M seed extension rarely reshapes tooling budgets" },
        lossReasonFit: {
          score: 60,
          note: "Partially eases the price objection; cheaper tool already in place",
        },
        timing: { score: 70, note: "B2B pivot announced — stack decisions being made now" },
      },
    },
    plan: {
      targetContact: {
        name: "Jeanne Okafor",
        role: "Co-founder & COO",
        email: "jeanne@toundra.studio",
        enrichment: { providersTried: 1 },
      },
      angle:
        "Low-pressure check-in referencing their B2B push; lead with the starter tier launched in May.",
      talkingPoints: [
        "New starter tier is 60% below the price they saw in March",
        "Their announced B2B pivot is our strongest segment",
        "Position as an upgrade path from their current point solution",
      ],
      emailDraft: {
        subject: "Your B2B push + our new starter tier",
        body: "Hi Jeanne,\n\nSaw the seed extension news — congrats, and the B2B focus makes a lot of sense.\n\nQuick note: the pricing that didn't work in March has changed. We launched a starter tier in May that's 60% below what you evaluated, built exactly for teams at your stage.\n\nHappy to show you in 15 minutes if the timing is better now.\n\nBest,\n",
      },
    },
    status: "rejected",
  },
  {
    id: "case-brioz",
    deal: {
      id: "opp-2025-0176",
      company: { name: "Brioz", domain: "brioz.com", industry: "Retail" },
      amount: 25_000,
      currency: "EUR",
      lostAt: "2026-01-30",
      lossReason: "no_need",
      lossNotes:
        "Concluded the product doesn't fit their offline-first retail model. Fundamental fit issue.",
      previousContact: { name: "Paul Lemaire", role: "CFO" },
    },
    signal: {
      id: "sig-9401",
      type: "exec_change",
      title: "New CFO appointed",
      description: "Brioz appointed Nadia Cherif as CFO, replacing Paul Lemaire.",
      detectedAt: "2026-07-03",
      source: "Sillage — people move",
    },
    autopsy: {
      summary:
        "Lost on fundamental product fit: their offline-first model doesn't generate the data our product needs. No stakeholder, price, or timing factor involved.",
      lossFactors: [
        "Product requires digital sales data they don't produce",
        "No planned move toward e-commerce",
      ],
    },
    verdict: {
      decision: "no_go",
      score: 24,
      reasoning:
        "The deal was lost on product fit, not on people. A CFO change doesn't alter their business model — re-engaging would waste a touch and hurt credibility. Keep monitoring for an e-commerce signal instead.",
      factors: {
        signalStrength: {
          score: 40,
          note: "A real executive change, but in a role unrelated to the loss",
        },
        lossReasonFit: {
          score: 10,
          note: "Deal was lost on product fit — a new CFO doesn't change the model",
        },
        timing: { score: 20, note: "No e-commerce move on their roadmap — nothing has shifted" },
      },
    },
    plan: null,
    status: "no_go",
  },
];

// Held back from fetchCases() until the demo simulation "detects" it live.
const SIMULATED_CASE: ReengagementCase = {
  id: "case-oberon",
  deal: {
    id: "opp-2025-0088",
    company: { name: "Oberon Systems", domain: "oberon-systems.com", industry: "Cybersecurity" },
    amount: 120_000,
    currency: "EUR",
    lostAt: "2025-10-16",
    lossReason: "competitor",
    lossNotes:
      "Chose the incumbent after a 9-month evaluation. Internal politics: no sponsor at VP level to defend the switch.",
    previousContact: { name: "Hugo Steiner", role: "Head of Sales Ops" },
  },
  signal: {
    id: "sig-9512",
    type: "job_change",
    title: "A champion from another account just joined Oberon as VP",
    description:
      "Maxime Aubert — your champion at Diato, where he drove the original deployment — joined Oberon Systems as VP Sales Operations this week.",
    detectedAt: "2026-07-07",
    source: "Sillage — people move",
  },
  autopsy: {
    summary:
      "Lost to the incumbent after a long evaluation that our product actually won on features. The deal died for lack of a VP-level sponsor willing to carry the migration risk.",
    lossFactors: [
      "No executive sponsor to own the switching decision",
      "Incumbent leveraged a 3-year contract renewal discount",
      "Migration risk perceived as high by Sales Ops",
    ],
  },
  verdict: {
    decision: "go",
    score: 88,
    reasoning:
      "The exact missing ingredient — a VP-level sponsor — just walked in the door, and he's a proven champion who led a deployment of our product elsewhere. The feature evaluation is already won; only the sponsorship gap needs closing.",
    factors: {
      signalStrength: {
        score: 92,
        note: "Proven champion — he led a full deployment of our product at Diato",
      },
      lossReasonFit: {
        score: 95,
        note: "Fills the exact gap that killed the deal: a VP-level sponsor",
      },
      timing: {
        score: 65,
        note: "Incumbent's renewal window reopens in Q4 — case must be built now",
      },
    },
  },
  plan: {
    targetContact: {
      name: "Maxime Aubert",
      role: "VP Sales Operations",
      email: "m.aubert@oberon-systems.com",
      phone: "+33 6 71 55 04 12",
      enrichment: { providersTried: 2 },
    },
    angle:
      "Champion re-activation: welcome him to the new role, reference the Diato deployment he led, and hand him the 2025 evaluation results as ready-made ammunition to reopen the file internally.",
    talkingPoints: [
      "He owns the exact objection that killed the deal — migration risk — and has lived the migration before",
      "The 2025 evaluation scored us first on features; share the scorecard he can reuse internally",
      "Incumbent's 3-year renewal window reopens in Q4 — the timing to build the case is now",
    ],
    emailDraft: {
      subject: "Welcome to Oberon — your Diato playbook, round two?",
      body: "Hi Maxime,\n\nCongrats on the VP role at Oberon — well deserved.\n\nSmall world: Oberon evaluated us last year and rated us first on product, but nobody at VP level wanted to own the migration. You've already carried that exact project once at Diato, and you know how it ended.\n\nIf you're rebuilding your stack roadmap, I can send you the 2025 evaluation scorecard your new team produced — it's a head start.\n\nBest,\n",
    },
    angleLabel: "Champion re-activation",
    altAngles: [
      {
        id: "renewal-window",
        label: "Beat the Q4 renewal clock",
        rationale:
          "Skip the nostalgia and hand him a dated business case tied to the incumbent's Q4 renewal — the one window where the switching cost actually drops.",
        emailDraft: {
          subject: "Oberon's incumbent renews in Q4 — a head start",
          body: "Hi Maxime,\n\nCongrats on the VP role. Straight to business: Oberon's contract with the incumbent comes up for renewal in Q4, and that's the only window where switching costs really drop.\n\nWe were rated first on features here last year — the file just never had a VP to carry the migration. You've run that exact migration before at Diato.\n\nIf it's useful, I'll put together a dated switch plan mapped to the renewal date so you can weigh it cold. No meeting needed to start — just say the word.\n\nBest,\n",
        },
      },
    ],
  },
  status: "pending_review",
};

type Decision = { status: "approved" | "rejected"; email?: EmailDraft; angleLabel?: string };

// Anchored on globalThis so route handlers and RSC share the same store and it
// survives dev-mode recompiles. Goes away once a real CRM backs decisions.
const globalStore = globalThis as {
  __relayDecisions?: Map<string, Decision>;
  __relaySimulated?: { active: boolean };
};
const decisions = (globalStore.__relayDecisions ??= new Map<string, Decision>());
const simulated = (globalStore.__relaySimulated ??= { active: false });

function withDecision(reengagementCase: ReengagementCase): ReengagementCase {
  const decision = decisions.get(reengagementCase.id);
  if (!decision) return reengagementCase;
  return {
    ...reengagementCase,
    status: decision.status,
    editedEmail: decision.email,
    approvedAngleLabel: decision.angleLabel,
  };
}

function visibleCases(): ReengagementCase[] {
  return simulated.active ? [SIMULATED_CASE, ...MOCK_CASES] : MOCK_CASES;
}

export async function fetchCases(): Promise<ReengagementCase[]> {
  return visibleCases().map(withDecision);
}

export async function fetchCase(id: string): Promise<ReengagementCase | null> {
  const found = visibleCases().find((c) => c.id === id);
  return found ? withDecision(found) : null;
}

// The original email of the angle the rep chose — the baseline that decides
// whether their submission counts as a hand-edit.
function emailForAngle(
  plan: ReengagementCase["plan"],
  angleLabel?: string,
): EmailDraft | undefined {
  if (!plan) return undefined;
  const alt = angleLabel ? plan.altAngles?.find((a) => a.label === angleLabel) : undefined;
  return alt?.emailDraft ?? plan.emailDraft;
}

export async function persistDecision(
  id: string,
  status: "approved" | "rejected",
  email?: EmailDraft,
  angleLabel?: string,
): Promise<ReengagementCase | null> {
  const found = visibleCases().find((c) => c.id === id);
  if (!found) return null;
  const original = emailForAngle(found.plan, angleLabel);
  const isEdited =
    email && original && (email.subject !== original.subject || email.body !== original.body);
  decisions.set(id, { status, email: isEdited ? email : undefined, angleLabel });
  return withDecision(found);
}

export async function activateSimulatedCase(): Promise<ReengagementCase> {
  simulated.active = true;
  return withDecision(SIMULATED_CASE);
}

export async function resetDemo(): Promise<void> {
  simulated.active = false;
  decisions.clear();
}
