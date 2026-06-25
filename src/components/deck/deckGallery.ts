/**
 * Modèle d'affichage partagé pour les grilles de cartes (DeckCardGrid). Les
 * decks officiels (ResolvedDeckGroup) y sont structurellement compatibles ; les
 * decks personnels passent par buildGalleryGroups.
 */
import type { Card, DeckCard } from "@/types/cards";

export interface DeckGalleryEntry {
  name: string;
  quantity: number;
  card: Card | null;
}

export interface DeckGalleryGroup {
  section: string;
  total: number;
  entries: DeckGalleryEntry[];
}

const FLAT_SECTION = "Cartes du deck";

/** Projette une carte de deck (résolue) en entrée d'affichage de la galerie. */
export const toEntry = (c: DeckCard): DeckGalleryEntry => ({
  name: c.card.name,
  quantity: c.quantity,
  card: c.card,
});

const sumQty = (entries: DeckGalleryEntry[]): number =>
  entries.reduce((s, e) => s + e.quantity, 0);

/**
 * Construit les groupes d'affichage depuis les cartes d'un deck personnel.
 *  - « type » : un groupe par mainType (effectif décroissant, cartes triées PA)
 *  - « cost » : un seul groupe trié par PA croissant
 *  - « name » : un seul groupe trié par nom (localeCompare)
 */
export function buildGalleryGroups(
  cards: DeckCard[],
  sortMode: "type" | "cost" | "name",
): DeckGalleryGroup[] {
  if (!cards.length) return [];

  if (sortMode === "type") {
    const byType = new Map<string, DeckCard[]>();
    for (const c of cards) {
      const t = c.card.mainType;
      const bucket = byType.get(t);
      if (bucket) bucket.push(c);
      else byType.set(t, [c]);
    }
    return [...byType.entries()]
      .map(([section, group]) => {
        const entries = [...group]
          .sort((a, b) => (a.card.stats?.pa || 0) - (b.card.stats?.pa || 0))
          .map(toEntry);
        return { section, total: sumQty(entries), entries };
      })
      .sort((a, b) => b.total - a.total);
  }

  const entries = [...cards]
    .sort((a, b) =>
      sortMode === "cost"
        ? (a.card.stats?.pa || 0) - (b.card.stats?.pa || 0)
        : a.card.name.localeCompare(b.card.name),
    )
    .map(toEntry);
  return [{ section: FLAT_SECTION, total: sumQty(entries), entries }];
}
