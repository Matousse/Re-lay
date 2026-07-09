import { NextResponse } from "next/server";
import { z } from "zod";
import {
  analyzeCompanyWebsite,
  onboardingStatus,
  persistCompanyContext,
  persistRouting,
} from "@/services/onboarding";
import {
  CompanyContextInputSchema,
  NotificationRoutingInputSchema,
  routingHasChannel,
} from "@/types/onboarding";

// Backend of the onboarding wizard: analyze a website, save the confirmed
// company context, save the play routing, report status. Thin — Zod at the
// boundary (the same shared schemas the agent tools validate with), services
// do the work.

const InputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("analyze"), url: z.url() }),
  CompanyContextInputSchema.extend({ action: z.literal("save_context") }),
  NotificationRoutingInputSchema.extend({ action: z.literal("save_routing") }),
]);

export async function GET() {
  return NextResponse.json(await onboardingStatus());
}

export async function POST(request: Request) {
  const parsed = InputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  if (input.action === "analyze") {
    const result = await analyzeCompanyWebsite(input.url);
    if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 422 });
    return NextResponse.json(result);
  }
  if (input.action === "save_context") {
    const { action: _action, ...context } = input;
    return NextResponse.json(await persistCompanyContext(context));
  }
  const { action: _action, ...routing } = input;
  if (!routingHasChannel(routing)) {
    return NextResponse.json(
      { error: "Provide at least an email or a Slack member ID." },
      { status: 400 },
    );
  }
  return NextResponse.json(await persistRouting(routing));
}
