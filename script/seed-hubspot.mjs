// Seeds a HubSpot portal with every demo account Re:lay shows, so the mocked
// signals resolve to real companies (with closed-lost deals, notes and the
// previous contact) once HUBSPOT_ACCESS_TOKEN is set. Reads
// src/integrations/crm/data.json as the single source of truth.
//
// Run:  node --env-file=.env script/seed-hubspot.mjs
//   or  npm run seed:hubspot
//
// Idempotent: an account whose company name already exists is skipped, so
// re-running won't duplicate deals, notes or contacts.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import hubspot from "@hubspot/api-client";

const { Client } = hubspot;

const token = process.env.HUBSPOT_ACCESS_TOKEN;
if (!token) {
  console.error(
    "✗ HUBSPOT_ACCESS_TOKEN is not set.\n" +
      "  Fill it in .env, then run: node --env-file=.env script/seed-hubspot.mjs",
  );
  process.exit(1);
}

const client = new Client({ accessToken: token });

const DEFAULT_AMOUNT = 30_000;

const dataPath = join(dirname(fileURLToPath(import.meta.url)), "../src/integrations/crm/data.json");
const accounts = JSON.parse(readFileSync(dataPath, "utf8"));

async function findCompanyId(name) {
  const res = await client.crm.companies.searchApi.doSearch({
    filterGroups: [{ filters: [{ propertyName: "name", operator: "EQ", value: name }] }],
    properties: ["name"],
    limit: 1,
  });
  return res.results[0]?.id ?? null;
}

function stageProps(account) {
  if (account.status === "lost") {
    return {
      dealstage: "closedlost",
      ...(account.lostAt ? { closedate: new Date(account.lostAt).toISOString() } : {}),
    };
  }
  if (account.status === "won") {
    return {
      dealstage: "closedwon",
      ...(account.lostAt ? { closedate: new Date(account.lostAt).toISOString() } : {}),
    };
  }
  return {}; // active → HubSpot's default (open) stage
}

// Creates the deal, retrying without closed_lost_reason if the portal rejects
// that value (some portals lock it to an enum) — the closed-lost stage is what
// matters for Re:lay to see the account as revivable.
async function createDeal(account, companyId) {
  const base = {
    dealname: `${account.company} — deal`,
    amount: String(account.amount ?? DEFAULT_AMOUNT),
    ...stageProps(account),
  };
  const withReason =
    account.status === "lost" && account.lossReason
      ? { ...base, closed_lost_reason: account.lossReason }
      : base;

  let deal;
  try {
    deal = await client.crm.deals.basicApi.create({ properties: withReason, associations: [] });
  } catch {
    deal = await client.crm.deals.basicApi.create({ properties: base, associations: [] });
  }
  await client.crm.associations.v4.basicApi.createDefault("deals", deal.id, "companies", companyId);
}

async function createContact(contact, companyId) {
  const [firstname, ...rest] = contact.name.split(" ");
  const properties = {
    firstname: firstname ?? contact.name,
    lastname: rest.join(" "),
    jobtitle: contact.role,
    ...(contact.email ? { email: contact.email } : {}),
  };
  try {
    const created = await client.crm.contacts.basicApi.create({ properties, associations: [] });
    await client.crm.associations.v4.basicApi.createDefault(
      "contacts",
      created.id,
      "companies",
      companyId,
    );
  } catch (err) {
    console.warn(`  ⚠ contact skipped for ${contact.name}: ${err?.body?.message ?? err?.message}`);
  }
}

async function seedAccount(account) {
  const existing = await findCompanyId(account.company);
  if (existing) {
    console.log(`• ${account.company}: already exists (id ${existing}) — skipping`);
    return;
  }

  const company = await client.crm.companies.basicApi.create({
    properties: { name: account.company, ...(account.domain ? { domain: account.domain } : {}) },
    associations: [],
  });
  console.log(`✓ ${account.company}: company created (id ${company.id})`);

  try {
    await createDeal(account, company.id);
    console.log(`  ↳ deal (${account.status}) created & linked`);
  } catch (err) {
    console.warn(`  ⚠ deal skipped for ${account.company}: ${err?.body?.message ?? err?.message}`);
  }

  for (const note of account.notes ?? []) {
    const created = await client.crm.objects.notes.basicApi.create({
      properties: {
        hs_note_body: `${note.author}: ${note.text}`,
        hs_timestamp: new Date(note.date).toISOString(),
      },
      associations: [],
    });
    await client.crm.associations.v4.basicApi.createDefault(
      "notes",
      created.id,
      "companies",
      company.id,
    );
  }
  if (account.notes?.length) console.log(`  ↳ ${account.notes.length} note(s) linked`);

  if (account.contact) {
    await createContact(account.contact, company.id);
    console.log(`  ↳ contact ${account.contact.name} linked`);
  }
}

async function main() {
  console.log(`Seeding ${accounts.length} account(s) into HubSpot…\n`);
  for (const account of accounts) {
    await seedAccount(account);
  }
  console.log("\n✓ Done. Open HubSpot → Companies to verify.");
}

main().catch((err) => {
  console.error("✗ Seeding failed:", err?.message ?? err);
  process.exit(1);
});
