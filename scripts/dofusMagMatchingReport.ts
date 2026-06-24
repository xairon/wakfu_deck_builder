import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { DOFUS_MAG_DECKS } from "../src/data/dofusMagDecks";
import {
  buildNameIndex,
  classifyDeck,
  type IndexedCard,
} from "./lib/dofusMagMatch";

const DATA_DIR = resolve(__dirname, "../public/data");

function loadAllCards(): IndexedCard[] {
  const out: IndexedCard[] = [];
  for (const f of readdirSync(DATA_DIR)) {
    if (!f.endsWith(".json")) continue;
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(join(DATA_DIR, f), "utf8"));
    } catch {
      continue;
    }
    if (!Array.isArray(json)) continue;
    for (const c of json as any[]) {
      if (c && typeof c.name === "string" && c.extension?.name) {
        out.push({ name: c.name, extension: { name: c.extension.name } });
      }
    }
  }
  return out;
}

function main() {
  const idx = buildNameIndex(loadAllCards());
  const lines: string[] = [
    "# Rapport de matching — Decks Dofus Mag",
    "",
    `Généré pour ${DOFUS_MAG_DECKS.length} deck(s).`,
    "",
  ];
  let totalUnresolved = 0;
  for (const d of DOFUS_MAG_DECKS) {
    const r = classifyDeck(d, idx);
    totalUnresolved += r.unresolved.length;
    lines.push(`## ${d.name} (\`${d.id}\`)`);
    lines.push(`- Résolus : ${r.resolved.length}`);
    if (r.unresolved.length)
      lines.push(
        `- **Non résolus (${r.unresolved.length})** : ${r.unresolved.join(", ")}`,
      );
    if (r.ambiguous.length)
      lines.push(`- Ambigus (reprints) : ${r.ambiguous.join(", ")}`);
    lines.push("");
  }
  lines.unshift(`> Total noms non résolus : **${totalUnresolved}**`, "");
  const outPath = resolve(__dirname, "../docs/dofus-mag-matching-report.md");
  writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log(`Rapport écrit : ${outPath} (${totalUnresolved} non résolus)`);
}

main();
