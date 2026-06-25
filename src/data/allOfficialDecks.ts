import { OFFICIAL_DECKS, type OfficialDeck } from "./officialDecks";
import { DOFUS_MAG_DECKS } from "./dofusMagDecks";
import type { Card } from "@/types/cards";

/** Liste unique des decks officiels (starters + Dofus Mag). */
export const ALL_OFFICIAL_DECKS: OfficialDeck[] = [
  ...OFFICIAL_DECKS,
  ...DOFUS_MAG_DECKS,
];

export function getOfficialDeckById(id: string): OfficialDeck | undefined {
  return ALL_OFFICIAL_DECKS.find((d) => d.id === id);
}

/**
 * Slug d'extension → nom d'extension en base, pour épingler la résolution des
 * cartes réimprimées. Dofus-mag non listé = résolution non pinnée (voulu).
 */
export const EXTENSION_NAME_BY_SLUG: Record<string, string> = {
  incarnam: "Incarnam",
  "bonta-brakmar": "Bonta & Brâkmar",
};

export interface ResolvedDeckEntry {
  name: string;
  quantity: number;
  card: Card | null;
}
export interface ResolvedDeckGroup {
  section: string;
  total: number;
  entries: ResolvedDeckEntry[];
}

const SECTION_ORDER = [
  "Alliés",
  "Allié Élémentaire",
  "Sorts",
  "Actions",
  "Équipements",
  "Équipement",
  "Zones",
  "Zone",
  "Salle",
  "Salles",
  "Protecteur",
  "Dofus",
];

function sectionRank(s: string): number {
  const i = SECTION_ORDER.indexOf(s);
  return i === -1 ? SECTION_ORDER.length : i;
}

/**
 * Résout chaque carte d'un deck (nom → Card via `resolve`) et regroupe par
 * section imprimée (repli sur le mainType résolu, sinon « Autres »). Fonction
 * pure : `resolve` est injecté pour la testabilité.
 */
export function resolveDeckCardGroups(
  deck: OfficialDeck,
  resolve: (name: string) => Card | null,
): ResolvedDeckGroup[] {
  const bySection = new Map<string, ResolvedDeckEntry[]>();
  for (const c of deck.cards) {
    const card = resolve(c.name);
    const section = c.section || card?.mainType || "Autres";
    const entry: ResolvedDeckEntry = {
      name: c.name,
      quantity: c.quantity,
      card,
    };
    const bucket = bySection.get(section);
    if (bucket) bucket.push(entry);
    else bySection.set(section, [entry]);
  }
  return [...bySection.entries()]
    .map(([section, entries]) => ({
      section,
      entries,
      total: entries.reduce((s, e) => s + e.quantity, 0),
    }))
    .sort((a, b) => sectionRank(a.section) - sectionRank(b.section));
}
