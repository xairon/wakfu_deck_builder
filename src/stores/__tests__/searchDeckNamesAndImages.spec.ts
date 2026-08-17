import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useGameStore } from "../gameStore";
import { useCardStore } from "../cardStore";
import type { Card, Deck } from "@/types/cards";
import { getThumbPath } from "@/utils/imagePaths";
import {
  createMockHeroCard,
  createMockHavreSacCard,
  createMockAllyCard,
} from "tests/factories/card";

function makeDeckWithNamedCards(tag: string): { deck: Deck; cards: Card[] } {
  const hero = createMockHeroCard({
    id: `${tag}-hero-id`,
    name: `${tag} Héros Principal`,
  });
  const havreSac = createMockHavreSacCard({
    id: `${tag}-sac-id`,
    name: `${tag} Havre-Sac`,
  });

  const card1 = createMockAllyCard({
    id: `${tag}-piou-rouge-id`,
    name: "Piou Rouge",
    stats: {
      niveau: { value: 1, element: "Feu" },
      force: { value: 1, element: "Feu" },
    },
  });

  const card2 = createMockAllyCard({
    id: `${tag}-vrombyx-id`,
    name: "Vrombyx",
    stats: {
      niveau: { value: 2, element: "Terre" },
      force: { value: 2, element: "Terre" },
    },
  });

  const card3 = createMockAllyCard({
    id: `${tag}-fecaline-id`,
    name: "Fécaline la Sage",
    stats: {
      niveau: { value: 3, element: "Eau" },
      force: { value: 3, element: "Eau" },
    },
  });

  const deck: Deck = {
    id: tag,
    name: `Deck ${tag}`,
    hero,
    havreSac,
    cards: [
      { card: card1, quantity: 15 },
      { card: card2, quantity: 15 },
      { card: card3, quantity: 18 },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return { deck, cards: [hero, havreSac, card1, card2, card3] };
}

describe("Recherche et Tutorat de Deck — Accès au Nom et Image des cartes", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("garantit que chaque carte du deck en partie possède son vrai Nom et son Image (sans 'Carte Inconnue' ni dos de carte)", () => {
    const cardStore = useCardStore();
    const gameStore = useGameStore();

    const playerA = makeDeckWithNamedCards("playerA");
    const playerB = makeDeckWithNamedCards("playerB");

    cardStore.cards = [...playerA.cards, ...playerB.cards];

    // Démarrer une partie
    gameStore.startMatch(playerA.deck, playerB.deck, { first: "A" });

    // Récupérer les cartes de la pioche du joueur A
    const seatA = "A";
    const piocheIds = gameStore.state.seats[seatA]?.pioche ?? [];
    expect(piocheIds.length).toBeGreaterThan(0);

    // Vérifier chaque carte de la pioche
    for (const instId of piocheIds) {
      // 1. Résolution de l'instance
      const card = gameStore.resolveInstanceCard(instId);

      // La carte DOIT être résolue (non null)
      expect(card).not.toBeNull();
      expect(card?.name).toBeDefined();
      expect(card?.name).not.toBe("Carte Inconnue");
      expect(["Piou Rouge", "Vrombyx", "Fécaline la Sage"]).toContain(
        card?.name,
      );

      // 2. Construction de l'image (Logique SearchDeckModal)
      const isHero = card?.mainType === "Héros";
      const path = isHero
        ? `/images/cards/${card?.id}_recto.webp`
        : `/images/cards/${card?.id}.webp`;
      const imgSrc = getThumbPath(path);

      // L'image DOIT pointer vers l'illustration de la carte et PAS le dos de carte
      expect(imgSrc).not.toContain("card-back.webp");
      expect(imgSrc).toContain(card?.id);
    }
  });
});
