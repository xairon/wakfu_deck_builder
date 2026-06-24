import type { OfficialDeck } from "@/data/officialDecks";

export interface IndexedCard {
  name: string;
  extension: { name: string };
}

/** Réplique `normalizeText` du deckStore (accents/casse/espaces). */
export function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildNameIndex(
  cards: IndexedCard[],
): Map<string, IndexedCard[]> {
  const idx = new Map<string, IndexedCard[]>();
  for (const c of cards) {
    const k = norm(c.name);
    const bucket = idx.get(k);
    if (bucket) bucket.push(c);
    else idx.set(k, [c]);
  }
  return idx;
}

export interface DeckClassification {
  resolved: string[];
  unresolved: string[];
  /** Noms résolus mais présents dans plusieurs extensions (reprints). */
  ambiguous: string[];
}

export function classifyDeck(
  deck: OfficialDeck,
  idx: Map<string, IndexedCard[]>,
): DeckClassification {
  const names = [deck.hero, deck.havreSac, ...deck.cards.map((c) => c.name)];
  const resolved: string[] = [];
  const unresolved: string[] = [];
  const ambiguous: string[] = [];
  for (const name of names) {
    const hits = idx.get(norm(name));
    if (!hits || hits.length === 0) {
      unresolved.push(name);
    } else {
      resolved.push(name);
      const exts = new Set(hits.map((h) => h.extension.name));
      if (exts.size > 1) ambiguous.push(name);
    }
  }
  return { resolved, unresolved, ambiguous };
}
