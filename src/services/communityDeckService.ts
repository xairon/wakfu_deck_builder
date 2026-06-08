/**
 * Service des decks de sources externes (Dofus Mag, tournois, communauté).
 * Charge public/data/community-decks.json et produit un texte d'import
 * compatible avec le parseur existant (deckStore.importDeck).
 * Voir schemas/deck-source.schema.json.
 */

export type DeckSource = "Dofus Mag" | "Tournoi" | "Communauté" | "Créateur";

export interface SourcedDeckCard {
  name: string;
  quantity: number;
  type?: string;
}

export interface SourcedDeck {
  id: string;
  name: string;
  source: DeckSource;
  author?: string;
  event?: string;
  date?: string;
  format?: string;
  rank?: string;
  description?: string;
  sourceUrl?: string;
  hero?: string;
  havreSac?: string;
  cards: SourcedDeckCard[];
}

let cache: SourcedDeck[] | null = null;

/** Charge la bibliothèque de decks externes (mise en cache). */
export async function loadCommunityDecks(): Promise<SourcedDeck[]> {
  if (cache) return cache;
  try {
    const res = await fetch("/data/community-decks.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cache = Array.isArray(data?.decks) ? data.decks : [];
  } catch (err) {
    console.error("Chargement des decks communautaires impossible:", err);
    cache = [];
  }
  return cache;
}

/** Regroupe les decks par source. */
export function groupBySource(
  decks: SourcedDeck[],
): { source: DeckSource; decks: SourcedDeck[] }[] {
  const order: DeckSource[] = [
    "Tournoi",
    "Dofus Mag",
    "Communauté",
    "Créateur",
  ];
  const map = new Map<DeckSource, SourcedDeck[]>();
  for (const d of decks) {
    if (!map.has(d.source)) map.set(d.source, []);
    map.get(d.source)!.push(d);
  }
  return order
    .filter((s) => map.has(s))
    .map((source) => ({ source, decks: map.get(source)! }));
}

/** Nombre total de cartes (hors héros/havre-sac). */
export function deckCardCount(deck: SourcedDeck): number {
  return deck.cards.reduce((acc, c) => acc + c.quantity, 0);
}

/**
 * Construit le texte d'import attendu par deckStore.importDeck :
 *   1 Héros (Héros)
 *   1 Havre (Havre-Sac)
 *   3 Carte
 */
export function communityDeckToText(deck: SourcedDeck): string {
  const lines: string[] = [`# ${deck.name}`];
  if (deck.hero) lines.push(`1 ${deck.hero} (Héros)`);
  if (deck.havreSac) lines.push(`1 ${deck.havreSac} (Havre-Sac)`);
  for (const c of deck.cards) {
    lines.push(`${c.quantity} ${c.name}${c.type ? ` (${c.type})` : ""}`);
  }
  return lines.join("\n");
}
