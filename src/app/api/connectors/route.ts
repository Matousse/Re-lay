import { NextResponse } from "next/server";
import { connectConnector } from "@/services/connectors";
import { ConnectInputSchema } from "@/types/connectors";

export async function POST(request: Request) {
  const parsed = ConnectInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const states = await connectConnector(parsed.data.id);
  return NextResponse.json(states);
}
