/**
 * Actions groupées sur la collection : marquer un lot de cartes comme
 * possédées (playset complet) ou non possédées, ajuster une quantité en
 * masse. Utilisé par le mode sélection multiple et le raccourci « extension
 * entière » de CollectionView — logique centralisée pour ne pas la dupliquer
 * entre les deux points d'entrée.
 */
import { useCardStore } from "@/stores/cardStore";
import { maxCopiesForCard } from "@/utils/cardRules";
import type { Card } from "@/types/cards";

export function useBulkCollectionActions() {
  const cardStore = useCardStore();

  /**
   * Complète chaque carte jusqu'à son playset (3 exemplaires, 1 si « Unique »)
   * en ajoutant des exemplaires normaux — ne retire JAMAIS un exemplaire déjà
   * possédé (foil compris). Renvoie le nombre de cartes effectivement modifiées.
   */
  async function markAsOwned(cards: Card[]): Promise<number> {
    const updates: Array<{ cardId: string; normal: number; foil: number }> =
      [];
    for (const card of cards) {
      const normal = cardStore.getCardQuantity(card.id);
      const foil = cardStore.getFoilCardQuantity(card.id);
      const target = maxCopiesForCard(card);
      const total = normal + foil;
      if (total >= target) continue; // déjà complète (ou en surplus) : inchangée
      updates.push({ cardId: card.id, normal: normal + (target - total), foil });
    }
    if (updates.length) await cardStore.bulkSetQuantities(updates);
    return updates.length;
  }

  /**
   * Retire toute possession (normal + foil) des cartes données. Renvoie le
   * nombre de cartes effectivement modifiées.
   */
  async function markAsMissing(cards: Card[]): Promise<number> {
    const updates = cards
      .filter(
        (card) =>
          cardStore.getCardQuantity(card.id) > 0 ||
          cardStore.getFoilCardQuantity(card.id) > 0,
      )
      .map((card) => ({ cardId: card.id, normal: 0, foil: 0 }));
    if (updates.length) await cardStore.bulkSetQuantities(updates);
    return updates.length;
  }

  /** Ajoute (ou retire si négatif) `delta` exemplaire(s) à chaque carte donnée. */
  async function adjustQuantity(
    cards: Card[],
    delta: number,
    isFoil: boolean,
  ): Promise<void> {
    const updates = cards.map((card) => {
      const normal = cardStore.getCardQuantity(card.id);
      const foil = cardStore.getFoilCardQuantity(card.id);
      return isFoil
        ? { cardId: card.id, normal, foil: Math.max(0, foil + delta) }
        : { cardId: card.id, normal: Math.max(0, normal + delta), foil };
    });
    await cardStore.bulkSetQuantities(updates);
  }

  return { markAsOwned, markAsMissing, adjustQuantity };
}
