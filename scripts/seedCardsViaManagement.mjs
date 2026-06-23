/**
 * Seed de la table `cards` via la Management API (alternative à
 * `seedCardsTable.ts` quand on n'a PAS la clé service_role sous la main).
 *
 * La Management API (`/v1/projects/<ref>/database/query`) exécute en superuser
 * → contourne la RLS (écriture `cards` réservée au service_role). On lit les
 * mêmes bases que cardLoader (allowlist), on aplatit en lignes `{id, data}` et
 * on UPSERT par lots d'INSERT … ON CONFLICT.
 *
 * À rejouer après chaque `npm run compile-effects`.
 * Usage : SUPABASE_MGMT_TOKEN=sbp_… PROJECT_REF=… node scripts/seedCardsViaManagement.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REF = process.env.PROJECT_REF ?? "ehqalhzvmgkepgbaxbzu";
const TOKEN = process.env.SUPABASE_MGMT_TOKEN;
if (!TOKEN) {
  console.error("Erreur : SUPABASE_MGMT_TOKEN (token sbp_…) manquant.");
  process.exit(1);
}

// Allowlist miroir de src/services/cardLoader.ts (on NE glob PAS *.json :
// deck_iop.json / community-decks.json / errata.json ne sont pas des cartes).
const EXTENSION_FILES = [
  "amakna",
  "ankama-convention-5",
  "astrub",
  "bonta-brakmar",
  "chaos-dogrest",
  "dofus-collection",
  "ile-des-wabbits",
  "incarnam",
  "otomai",
  "pandala",
  "draft",
];

const dir = "public/data";
const cards = new Map();
for (const ext of EXTENSION_FILES) {
  const json = JSON.parse(readFileSync(join(dir, `${ext}.json`), "utf8"));
  const list = Array.isArray(json) ? json : (json.cards ?? []);
  for (const c of list) {
    if (typeof c?.id === "string" && c.id) cards.set(c.id, c);
  }
}
const rows = [...cards.entries()];
console.log(`${rows.length} cartes à seeder`);

// Échappe pour un littéral string Postgres (standard_conforming_strings on :
// seuls les ' sont à doubler ; les \ de JSON.stringify restent littéraux).
const esc = (s) => s.replace(/'/g, "''");
const url = `https://api.supabase.com/v1/projects/${REF}/database/query`;

const BATCH = 100;
let done = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const slice = rows.slice(i, i + BATCH);
  const values = slice
    .map(
      ([id, card]) => `('${esc(id)}', '${esc(JSON.stringify(card))}'::jsonb)`,
    )
    .join(",\n");
  const query =
    `INSERT INTO public.cards (id, data) VALUES\n${values}\n` +
    `ON CONFLICT (id) DO UPDATE SET data = excluded.data;`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error(
      `Lot ${i}-${i + slice.length} échec ${res.status}: ${t.slice(0, 600)}`,
    );
    process.exit(1);
  }
  done += slice.length;
  console.log(`  ${done}/${rows.length}`);
}
console.log(`seeded ${done} cards`);
