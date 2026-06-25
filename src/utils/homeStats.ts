import type { OfficialDeck } from "@/data/officialDecks";

/** Nombre d'extensions de cartes distinctes (vraies extensions, ≠ catégories de decks). */
export function distinctExtensionCount(
  cards: { extension?: { name?: string } }[],
): number {
  const set = new Set<string>();
  for (const c of cards) {
    const name = c.extension?.name;
    if (name) set.add(name);
  }
  return set.size;
}

/**
 * Sélectionne les decks à mettre en vedette : ceux avec un `lore` (decks Dofus
 * Mag riches, avec récit + art) d'abord, puis les autres, jusqu'à `n`. Pur et
 * déterministe.
 */
export function pickFeaturedDecks(
  decks: OfficialDeck[],
  n: number,
): OfficialDeck[] {
  const withLore = decks.filter((d) => d.lore);
  const rest = decks.filter((d) => !d.lore);
  return [...withLore, ...rest].slice(0, n);
}
