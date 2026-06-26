/**
 * Tableau de bord de couverture des effets — `npm run report-coverage`.
 * Lit public/data/*.json (régénéré par compile-effects) et résume la
 * répartition auto/manual/uncovered/ruling, plus le top des effets `uncovered`
 * pour orienter la prochaine tranche d'automatisation. Lecture seule.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(__dirname, "..", "public", "data");
const EXTENSION_FILES = [
  "amakna.json",
  "ankama-convention-5.json",
  "astrub.json",
  "bonta-brakmar.json",
  "chaos-dogrest.json",
  "dofus-collection.json",
  "draft.json",
  "ile-des-wabbits.json",
  "incarnam.json",
  "otomai.json",
  "pandala.json",
];

interface RawEffect {
  description?: string;
  coverage?: string;
}
interface RawCard {
  effects?: RawEffect[];
  recto?: { effects?: RawEffect[] };
  verso?: { effects?: RawEffect[] };
}

const tally: Record<string, number> = {
  auto: 0,
  manual: 0,
  uncovered: 0,
  ruling: 0,
  unknown: 0,
};
const uncovered: string[] = [];

for (const file of EXTENSION_FILES) {
  const cards = JSON.parse(
    readFileSync(join(DATA_DIR, file), "utf8"),
  ) as RawCard[];
  for (const card of cards) {
    const effects = [
      ...(card.effects ?? []),
      ...(card.recto?.effects ?? []),
      ...(card.verso?.effects ?? []),
    ];
    for (const e of effects) {
      const c = e.coverage ?? "unknown";
      tally[c] = (tally[c] ?? 0) + 1;
      if (c === "uncovered" && e.description) uncovered.push(e.description);
    }
  }
}

const printed = tally.auto + tally.manual + tally.uncovered;
const structured = tally.auto + tally.manual;
const pct = printed ? ((structured / printed) * 100).toFixed(1) : "0.0";

console.log("── Couverture des effets ──");
console.log(`  auto:      ${tally.auto}`);
console.log(`  manual:    ${tally.manual}`);
console.log(`  uncovered: ${tally.uncovered}`);
console.log(`  ruling:    ${tally.ruling}`);
if (tally.unknown) console.log(`  unknown:   ${tally.unknown} (à régénérer)`);
console.log(
  `  → ${structured}/${printed} effets imprimés structurés (${pct} %)`,
);
console.log("\n── Échantillon d'effets uncovered (10) ──");
for (const d of uncovered.slice(0, 10)) console.log(`  • ${d}`);
