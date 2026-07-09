// Quick "is HubSpot connected, and what's in the portal?" check.
// Run:  node --env-file=.env script/check-hubspot.mjs   (or npm run hubspot:check)

import hubspot from "@hubspot/api-client";

const { Client } = hubspot;

const token = process.env.HUBSPOT_ACCESS_TOKEN;
if (!token) {
  console.error("✗ HUBSPOT_ACCESS_TOKEN is not set in .env — CRM stays on the FakeCrm.");
  process.exit(1);
}

const client = new Client({ accessToken: token });

async function main() {
  const companies = await client.crm.companies.getAll(undefined, undefined, ["name"]);
  console.log(`✓ Connected. ${companies.length} company(ies) in the portal:\n`);

  for (const company of companies) {
    const withAssoc = await client.crm.companies.basicApi.getById(company.id, ["name"], undefined, [
      "deals",
      "notes",
    ]);
    // HubSpot may list an association twice (once per label) — dedupe for a
    // truthful count.
    const dealIds = [...new Set(withAssoc.associations?.deals?.results.map((r) => r.id) ?? [])];
    const noteCount = new Set(withAssoc.associations?.notes?.results.map((r) => r.id) ?? []).size;

    let status = "active";
    if (dealIds.length) {
      const deals = await client.crm.deals.batchApi.read({
        inputs: dealIds.map((id) => ({ id })),
        properties: ["hs_is_closed", "hs_is_closed_won"],
        propertiesWithHistory: [],
      });
      const lost = deals.results.some(
        (d) => d.properties.hs_is_closed === "true" && d.properties.hs_is_closed_won !== "true",
      );
      const won = deals.results.some((d) => d.properties.hs_is_closed_won === "true");
      status = lost ? "lost" : won ? "won" : "active";
    }

    console.log(
      `  • ${company.properties.name}  →  status: ${status}  (${dealIds.length} deal(s), ${noteCount} note(s))`,
    );
  }
  console.log(
    "\nThe app reads these when a signal's company matches a name above (status 'lost' = revivable).",
  );
}

main().catch((err) => {
  const msg = err?.body?.message ?? err?.message ?? String(err);
  console.error(`✗ HubSpot check failed: ${msg}`);
  if (err?.code === 401)
    console.error("  → token invalid or expired. Regenerate the Private App token.");
  process.exit(1);
});
