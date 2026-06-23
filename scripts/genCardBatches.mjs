/**
 * Génère les CORPS de requête (JSON `{"query": "INSERT…"}`) d'UPSERT de la
 * table `cards`, un fichier UTF-8 par lot, SANS réseau. Sert quand le POST
 * direct depuis Node échoue (proxy TLS d'entreprise) : on POSTe ensuite les
 * OCTETS bruts de chaque fichier via PowerShell (Invoke-RestMethod, magasin de
 * certificats Windows) — ce qui contourne l'encodage/JSON de PowerShell (5.1
 * lit l'UTF-8 sans BOM en ANSI → mojibake). Pas committé en usage normal :
 * `seedCardsTable.ts` / `seedCardsViaManagement.mjs` restent la voie standard.
 *
 * Usage : node scripts/genCardBatches.mjs <outDir>
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const outDir = process.argv[2] ?? "cards-batches";
mkdirSync(outDir, { recursive: true });

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

const esc = (s) => s.replace(/'/g, "''");
const BATCH = 100;
let n = 0;
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
  const file = join(outDir, `batch-${String(n).padStart(2, "0")}.json`);
  // Corps de requête prêt à POSTer, UTF-8 sans BOM.
  writeFileSync(file, JSON.stringify({ query }), { encoding: "utf8" });
  n++;
}
console.log(`${rows.length} cartes → ${n} lots → ${outDir}`);
