/**
 * Audit des decks starter — `npx tsx scripts/auditStarters.ts`.
 * Produit docs/AUDIT-STARTERS.md : pour chaque carte unique des starters
 * ciblés, classification de l'automatisation (auto / partiel / manuel) et
 * texte des effets non couverts, avec un tag heuristique de la mécanique
 * manquante. C'est le backlog de la verticale « bêta 2 decks ».
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OFFICIAL_DECKS } from "../src/data/officialDecks";

const TARGET_DECKS = ["incarnam-feca", "incarnam-iop"];
const DATA_DIR = join(__dirname, "..", "public", "data");
const FILES = [
  "incarnam.json",
  "amakna.json",
  "astrub.json",
  "bonta-brakmar.json",
  "chaos-dogrest.json",
  "dofus-collection.json",
  "ile-des-wabbits.json",
  "otomai.json",
  "pandala.json",
  "draft.json",
  "ankama-convention-5.json",
];

interface RawEffect {
  description?: string;
  compiled?: unknown;
  requiresIncline?: boolean;
}
interface RawCard {
  name?: string;
  mainType?: string;
  effects?: RawEffect[];
  recto?: { effects?: RawEffect[] };
  keywords?: { name?: string }[];
  extension?: { name?: string };
}

const all: RawCard[] = [];
for (const f of FILES) {
  all.push(
    ...(JSON.parse(readFileSync(join(DATA_DIR, f), "utf8")) as RawCard[]),
  );
}
const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
function findCard(name: string): RawCard | null {
  const n = norm(name);
  // préférence Incarnam, sinon première occurrence
  const hits = all.filter((c) => norm(String(c.name ?? "")) === n);
  return hits.find((c) => c.extension?.name === "Incarnam") ?? hits[0] ?? null;
}

function tagMissing(text: string): string {
  const t = norm(text);
  if (t.startsWith("ne jouez")) return "restriction de jeu";
  if (t.includes("reaction")) return "Réactions (timing)";
  if (t.startsWith("chaque fois") || t.includes("tant que"))
    return "déclencheur continu";
  if (t.includes("inclinez") && t.includes(":")) return "coût d'activation";
  if (t.includes("vous pouvez")) return "choix (optionnel complexe)";
  if (t.includes("de votre choix")) return "ciblage qualifié";
  if (t.includes("bloqueur") || t.includes("attaquant") || t.includes("combat"))
    return "condition de combat";
  return "script manuel candidat";
}

const lines: string[] = [
  "# Audit des decks starter — backlog de la verticale bêta",
  "",
  "> Généré par `scripts/auditStarters.ts`. Verdicts : ✅ AUTO (tous les",
  "> effets compilés) · 🟡 PARTIEL · ❌ MANUEL · ⬜ SANS EFFET (vanille).",
  "",
];

for (const deckId of TARGET_DECKS) {
  const deck = OFFICIAL_DECKS.find((d) => d.id === deckId);
  if (!deck) continue;
  const names = [deck.hero, deck.havreSac, ...deck.cards.map((c) => c.name)];
  const uniques = [...new Set(names)];
  let auto = 0;
  let partial = 0;
  let manual = 0;
  let vanilla = 0;
  const rows: string[] = [];
  for (const name of uniques) {
    const card = findCard(name);
    if (!card) {
      rows.push(`| ${name} | ? | — | ❓ INTROUVABLE | |`);
      continue;
    }
    const effects = (
      card.effects?.length ? card.effects : (card.recto?.effects ?? [])
    ).filter((e) => String(e?.description ?? "").trim());
    const compiled = effects.filter((e) => e.compiled).length;
    const kw = (card.keywords ?? [])
      .map((k) => k?.name)
      .filter(Boolean)
      .join(", ");
    const missing = effects.filter((e) => !e.compiled);
    let verdict: string;
    if (!effects.length) {
      verdict = "⬜ SANS EFFET";
      vanilla++;
    } else if (!missing.length) {
      verdict = "✅ AUTO";
      auto++;
    } else if (compiled > 0) {
      verdict = "🟡 PARTIEL";
      partial++;
    } else {
      verdict = "❌ MANUEL";
      manual++;
    }
    const detail = missing
      .map(
        (e) =>
          `[${tagMissing(String(e.description))}] ${String(e.description).slice(0, 110).replace(/\|/g, "/")}`,
      )
      .join("<br>");
    rows.push(
      `| ${name} | ${card.mainType} | ${compiled}/${effects.length}${kw ? ` · ${kw}` : ""} | ${verdict} | ${detail} |`,
    );
  }
  lines.push(
    `## ${deck.name} (${uniques.length} cartes uniques)`,
    "",
    `**Bilan : ${auto} auto · ${vanilla} vanille · ${partial} partiel · ${manual} manuel.**`,
    "",
    "| Carte | Type | Effets compilés | Verdict | Effets non couverts |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
  );
}

const out = join(__dirname, "..", "docs", "AUDIT-STARTERS.md");
writeFileSync(out, lines.join("\n") + "\n", "utf8");
console.log(`✓ ${out}`);
