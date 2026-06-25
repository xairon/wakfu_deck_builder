/**
 * Dumpe les 3 decks pilotes (déjà dans src/data/dofusMagDecks.ts) au format
 * brut d'extraction, pour qu'ils soient traités uniformément par le générateur.
 * À lancer UNE fois avant `genDofusMagDecks` : `npx tsx scripts/_dumpPilots.ts`
 */
import { DOFUS_MAG_DECKS } from "../src/data/dofusMagDecks";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const numById: Record<string, string> = {
  "dofus-mag-gelees-royales": "01",
  "dofus-mag-ecaflip-karey-dass": "02",
  "dofus-mag-sadida-klore-ofil": "53",
};

for (const d of DOFUS_MAG_DECKS) {
  const raw = {
    name: d.name,
    hero: d.hero,
    havreSac: d.havreSac,
    description: d.description,
    alignment: d.alignment ?? null,
    lore: d.lore ?? null,
    howToPlay: d.howToPlay ?? null,
    keyCards: d.keyCards ?? [],
    protector: d.protector ?? null,
    illustrator: d.illustrator ?? null,
    magIssue: d.magIssue ?? null,
    cards: d.cards.map((c) => ({
      name: c.name,
      quantity: c.quantity,
      section: c.section ?? null,
    })),
    checksum: d.cards.reduce((s, c) => s + c.quantity, 0),
    incomplete: false,
    notes: null,
  };
  const num = numById[d.id] ?? d.id.replace(/[^a-z0-9]/gi, "").slice(0, 8);
  writeFileSync(
    resolve(__dirname, `dofus-mag-extracted/deck-${num}.json`),
    JSON.stringify(raw, null, 2),
    "utf8",
  );
}
console.log(`Pilotes dumpés : ${DOFUS_MAG_DECKS.length}`);
