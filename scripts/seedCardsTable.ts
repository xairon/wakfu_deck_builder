/**
 * Seed de la table `cards` (server-authoritative rules — P1).
 *
 * Lit les bases de cartes compilées (`public/data/<extension>.json`), aplatit
 * en lignes `{ id, data }` et les upsert par lots via le client service_role
 * (qui contourne RLS). Source de vérité serveur pour `loadCards` / `getCard`.
 *
 * À rejouer après chaque `npm run compile-effects` (les données de cartes
 * changent). Opérateur uniquement — nécessite la clé service_role :
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (ou VITE_SUPABASE_URL en repli).
 *
 * Usage : `npx tsx scripts/seedCardsTable.ts`
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as dotenv from "dotenv";

dotenv.config();

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Erreur : SUPABASE_URL (ou VITE_SUPABASE_URL) et SUPABASE_SERVICE_ROLE_KEY " +
      "doivent être définis dans l'environnement (ou .env).",
  );
  process.exit(1);
}

const db = createClient(url, key);

// Allowlist des fichiers de cartes (miroir de src/services/cardLoader.ts).
// On NE glob PAS public/data/*.json : des fichiers comme deck_iop.json,
// community-decks.json, errata.json ne contiennent pas de vraies cartes et
// pollueraient la table.
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
// public/data/<extension>.json est un tableau d'objets Card (avec `id`).
const cards = new Map<string, unknown>();

for (const ext of EXTENSION_FILES) {
  const json = JSON.parse(readFileSync(join(dir, `${ext}.json`), "utf8"));
  const list: unknown[] = Array.isArray(json) ? json : (json.cards ?? []);
  for (const c of list) {
    const id = (c as { id?: unknown })?.id;
    if (typeof id === "string" && id) cards.set(id, c);
  }
}

const rows = [...cards].map(([id, data]) => ({ id, data }));

for (let i = 0; i < rows.length; i += 500) {
  const { error } = await db.from("cards").upsert(rows.slice(i, i + 500));
  if (error) throw error;
}

console.log(`seeded ${rows.length} cards`);
