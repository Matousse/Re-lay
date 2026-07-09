import { NextResponse } from "next/server";
import { listClosedLostForSync } from "@/services/sillage-sync";

// Feeds the Sillage connect modal: the closed-lost companies to pick from and
// the persona derived from their contacts. Reads the CRM live (real HubSpot when
// a token is set), so it must never be served from a stale cache.
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await listClosedLostForSync();
  return NextResponse.json(data);
}
