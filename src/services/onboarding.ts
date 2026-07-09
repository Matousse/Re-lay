import { z } from "zod";
import {
  getCompanyContext,
  readWebsite,
  saveCompanyContext,
  type CompanyContext,
} from "@/integrations/company-context";
import { makeAnthropicClient, type LlmClient } from "@/integrations/llm/client";
import {
  getNotificationRouting,
  saveNotificationRouting,
  type NotificationRouting,
} from "@/integrations/notifications/routing";
import { makeSillageSetup } from "@/integrations/signals/sillage-setup";
import { env } from "@/lib/env";

// The onboarding wizard's backend: analyze a company website into a draft
// context (Claude does the reading), persist what the human confirms, and
// report where the whole workspace stands. Same stores and Sillage client as
// the assistant's onboarding tools — two UIs, one brain.

const DraftContextSchema = z.object({
  companyName: z.string().describe("The company's name"),
  offering: z.string().describe("What the company sells, one or two sentences"),
  icp: z.string().describe("Who they sell to: roles and company profile, one or two sentences"),
  stakes: z.string().describe("Why prospects buy — the pains and stakes, one or two sentences"),
});
export type DraftContext = z.infer<typeof DraftContextSchema>;

export type AnalyzeResult =
  { ok: true; draft: DraftContext; truncated: boolean } | { ok: false; reason: string };

export async function analyzeCompanyWebsite(
  url: string,
  deps: { llm?: LlmClient; fetchImpl?: typeof fetch } = {},
): Promise<AnalyzeResult> {
  if (!deps.llm && !env.ANTHROPIC_API_KEY) {
    return { ok: false, reason: "Add ANTHROPIC_API_KEY to analyze a website." };
  }
  let text: string;
  let truncated: boolean;
  try {
    ({ text, truncated } = await readWebsite(url, deps.fetchImpl));
  } catch (error) {
    return { ok: false, reason: `Could not read ${url}: ${(error as Error).message}` };
  }
  if (!text) return { ok: false, reason: "The page had no readable text." };

  // The model call is the flakiest hop (rate limits, overload): it must
  // degrade into a reason the wizard can display, never into a 500.
  try {
    const llm = deps.llm ?? makeAnthropicClient();
    const draft = await llm.structured({
      system:
        "You extract a GTM company profile from website copy. Be concrete and concise; write in the site's language.",
      user: `Website: ${url}\n\nPage text:\n${text}`,
      schema: DraftContextSchema,
    });
    return { ok: true, draft, truncated };
  } catch {
    return { ok: false, reason: "The model couldn't analyze the site — try again in a moment." };
  }
}

export type OnboardingStatus = {
  context: CompanyContext | null;
  routing: NotificationRouting | null;
  sillage: { personaSet: boolean; listUploaded: boolean; agents: number } | null;
};

// Light check for the dashboard callout — no network.
export async function hasCompanyContext(): Promise<boolean> {
  return getCompanyContext() !== null;
}

export async function onboardingStatus(): Promise<OnboardingStatus> {
  const setup = makeSillageSetup();
  let sillage: OnboardingStatus["sillage"] = null;
  if (setup) {
    try {
      const [state, agents] = await Promise.all([setup.getSetupState(), setup.listAgents()]);
      sillage = {
        personaSet: state.persona_set,
        listUploaded: state.list_uploaded,
        agents: agents.length,
      };
    } catch {
      // Sillage being unreachable must not block onboarding.
      sillage = null;
    }
  }
  return { context: getCompanyContext(), routing: getNotificationRouting(), sillage };
}

export async function persistCompanyContext(
  input: Omit<CompanyContext, "updatedAt">,
): Promise<CompanyContext> {
  return saveCompanyContext(input);
}

export async function persistRouting(
  input: Omit<NotificationRouting, "updatedAt">,
): Promise<NotificationRouting> {
  return saveNotificationRouting(input);
}
