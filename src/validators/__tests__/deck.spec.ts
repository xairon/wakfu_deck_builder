import { describe, it, expect } from "vitest";
import {
  DECK_RULES,
  validateDeck,
  validateDeckForSave,
  canAddCard,
  getTotalCards,
  getCardCopies,
} from "../deck";
import { ValidationError } from "@/utils/errors";
import type { Card, Deck, HeroCard, HavenBagCard } from "@/types/cards";

describe("Validation des decks", () => {
  // Données de test
  const mockCard: Card = {
    id: "1",
    name: "Test Card",
    mainType: "Allié",
    subTypes: [],
    extension: {
      name: "Test",
      id: "test",
    },
    rarity: "Commune",
    stats: {
      ap: 2,
      hp: 2,
    },
    artists: [],
  };

  const mockActionCard: Card = {
    id: "action1",
    name: "Test Action",
    mainType: "Action",
    subTypes: [],
    extension: {
      name: "Test",
      id: "test",
    },
    rarity: "Commune",
    effects: [{ description: "Test effect" }],
    artists: [],
  };

  const mockHero: HeroCard = {
    id: "hero1",
    name: "Test Hero",
    mainType: "Héros",
    subTypes: [],
    extension: {
      name: "Test",
      id: "test",
    },
    rarity: "Commune",
    class: "Guerrier",
    recto: {
      stats: {
        ap: 3,
        hp: 3,
      },
      effects: [],
      keywords: [],
    },
    artists: [],
  };

  const mockHavreSac: HavenBagCard = {
    id: "sac1",
    name: "Test Havre-Sac",
    mainType: "Havre-Sac",
    subTypes: [],
    extension: {
      name: "Test",
      id: "test",
    },
    rarity: "Commune",
    effects: [],
    artists: [],
  };

  const createMockDeck = (
    cards: Array<{ card: Card; quantity: number; isReserve?: boolean }> = [],
  ): Deck => ({
    id: "test",
    name: "Test Deck",
    hero: null,
    havreSac: null,
    cards,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  /**
   * Helper: create deck cards that total exactly 48 cards (16 unique allies x 3 copies)
   * Includes both 'Allié' and 'Action' types to satisfy REQUIRED_TYPES
   */
  function createValidDeckCards(): Array<{ card: Card; quantity: number }> {
    const cards: Array<{ card: Card; quantity: number }> = [];
    // 15 allies x 3 = 45
    for (let i = 1; i <= 15; i++) {
      cards.push({
        card: { ...mockCard, id: `ally-${i}`, name: `Allié ${i}` },
        quantity: 3,
      });
    }
    // 1 action x 3 = 3 => total = 48
    cards.push({
      card: { ...mockActionCard, id: "action-1", name: "Action 1" },
      quantity: 3,
    });
    return cards;
  }

  describe("Règles de base", () => {
    it("devrait valider un deck correct", () => {
      const deck = {
        ...createMockDeck(createValidDeckCards()),
        hero: mockHero,
        havreSac: mockHavreSac,
      };

      const result = validateDeck(deck);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("devrait rejeter un deck sans héros", () => {
      const deck = createMockDeck(createValidDeckCards());

      const result = validateDeck(deck);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Le deck doit avoir un héros");
    });

    it("devrait rejeter un deck sans havre-sac", () => {
      const deck = {
        ...createMockDeck(createValidDeckCards()),
        hero: mockHero,
      };

      const result = validateDeck(deck);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Le deck doit avoir un havre-sac");
    });

    it("devrait rejeter un deck avec trop peu de cartes", () => {
      const deck = {
        ...createMockDeck([{ card: mockCard, quantity: 1 }]),
        hero: mockHero,
        havreSac: mockHavreSac,
      };

      const result = validateDeck(deck);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Le deck principal doit contenir au moins ${DECK_RULES.MIN_CARDS} cartes`,
      );
    });

    it("devrait rejeter un deck avec trop de cartes", () => {
      // Create 49 cards (one more than MAX_CARDS = 48)
      const overflowCards: Array<{ card: Card; quantity: number }> = [];
      for (let i = 1; i <= 49; i++) {
        overflowCards.push({
          card: { ...mockCard, id: `card-${i}`, name: `Card ${i}` },
          quantity: 1,
        });
      }
      const deck = {
        ...createMockDeck(overflowCards),
        hero: mockHero,
        havreSac: mockHavreSac,
      };

      const result = validateDeck(deck);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Le deck principal ne peut pas contenir plus de ${DECK_RULES.MAX_CARDS} cartes`,
      );
    });
  });

  describe("Validation des copies", () => {
    it("devrait rejeter un deck avec trop de copies d'une carte", () => {
      // Build a 48-card deck but with one card having too many copies
      const cards: Array<{ card: Card; quantity: number }> = [];
      // 14 allies x 3 = 42
      for (let i = 1; i <= 14; i++) {
        cards.push({
          card: { ...mockCard, id: `ally-${i}`, name: `Allié ${i}` },
          quantity: 3,
        });
      }
      // 1 action x 2 = 2 => subtotal = 44
      cards.push({
        card: { ...mockActionCard, id: "action-1", name: "Action 1" },
        quantity: 2,
      });
      // The offending card with MAX_COPIES + 1 = 4 copies => total = 48
      cards.push({
        card: { ...mockCard, id: "overcopied", name: "Overcopied" },
        quantity: DECK_RULES.MAX_COPIES + 1,
      });

      const deck = {
        ...createMockDeck(cards),
        hero: mockHero,
        havreSac: mockHavreSac,
      };

      const result = validateDeck(deck);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain(`plus de ${DECK_RULES.MAX_COPIES}`);
    });

    it("devrait valider un deck avec le nombre maximum de copies autorisé", () => {
      const deck = {
        ...createMockDeck(createValidDeckCards()),
        hero: mockHero,
        havreSac: mockHavreSac,
      };

      const result = validateDeck(deck);
      expect(result.isValid).toBe(true);
    });

    it("devrait limiter les cartes uniques à une seule copie", () => {
      const uniqueCard: Card = {
        ...mockCard,
        id: "unique",
        keywords: [
          { name: "Unique", description: "Une seule copie autorisée" },
        ],
      };

      // Build a 48-card deck with the unique card having 2 copies
      const cards: Array<{ card: Card; quantity: number }> = [];
      // 15 allies x 3 = 45
      for (let i = 1; i <= 15; i++) {
        cards.push({
          card: { ...mockCard, id: `ally-${i}`, name: `Allié ${i}` },
          quantity: 3,
        });
      }
      // 1 action x 1 = 1 => subtotal = 46
      cards.push({
        card: { ...mockActionCard, id: "action-1", name: "Action 1" },
        quantity: 1,
      });
      // unique card x 2 = 2 => total = 48
      cards.push({ card: uniqueCard, quantity: 2 });

      const deck = {
        ...createMockDeck(cards),
        hero: mockHero,
        havreSac: mockHavreSac,
      };

      const result = validateDeck(deck);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("unique");
    });
  });

  describe("Validation de la réserve", () => {
    it("devrait valider un deck avec une réserve correcte", () => {
      const deck = {
        ...createMockDeck([
          ...createValidDeckCards(),
          {
            card: { ...mockCard, id: "reserve-1" },
            quantity: 2,
            isReserve: true,
          },
        ]),
        hero: mockHero,
        havreSac: mockHavreSac,
      };

      const result = validateDeck(deck);
      expect(result.isValid).toBe(true);
    });

    it("devrait rejeter un deck avec trop de cartes en réserve", () => {
      const deck = {
        ...createMockDeck([
          ...createValidDeckCards(),
          {
            card: { ...mockCard, id: "reserve-1" },
            quantity: DECK_RULES.MAX_RESERVE + 1,
            isReserve: true,
          },
        ]),
        hero: mockHero,
        havreSac: mockHavreSac,
      };

      const result = validateDeck(deck);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `La réserve ne peut pas contenir plus de ${DECK_RULES.MAX_RESERVE} cartes`,
      );
    });
  });

  describe("Utilitaires", () => {
    describe("canAddCard", () => {
      it("devrait autoriser l'ajout d'une nouvelle carte", () => {
        const deck = createMockDeck();
        expect(canAddCard(deck, mockCard)).toBe(true);
      });

      it("devrait refuser l'ajout si le maximum de copies est atteint", () => {
        const deck = createMockDeck([
          { card: mockCard, quantity: DECK_RULES.MAX_COPIES },
        ]);
        expect(canAddCard(deck, mockCard)).toBe(false);
      });

      it("devrait refuser l'ajout si le deck est plein", () => {
        const deck = createMockDeck(createValidDeckCards());
        expect(canAddCard(deck, { ...mockCard, id: "new" })).toBe(false);
      });
    });

    describe("getTotalCards", () => {
      it("devrait calculer le total correct", () => {
        const deck = createMockDeck([
          { card: mockCard, quantity: 2 },
          { card: { ...mockCard, id: "2" }, quantity: 3 },
        ]);
        expect(getTotalCards(deck)).toBe(5);
      });

      it("devrait retourner 0 pour un deck vide", () => {
        const deck = createMockDeck();
        expect(getTotalCards(deck)).toBe(0);
      });
    });

    describe("getCardCopies", () => {
      it("devrait retourner le nombre correct de copies", () => {
        const deck = createMockDeck([{ card: mockCard, quantity: 2 }]);
        expect(getCardCopies(deck, mockCard)).toBe(2);
      });

      it("devrait retourner 0 pour une carte absente", () => {
        const deck = createMockDeck();
        expect(getCardCopies(deck, mockCard)).toBe(0);
      });
    });
  });

  describe("validateDeckForSave", () => {
    it("devrait lancer une erreur pour un deck invalide", () => {
      const deck = createMockDeck([
        { card: mockCard, quantity: DECK_RULES.MAX_COPIES + 1 },
      ]);

      expect(() => validateDeckForSave(deck)).toThrow(ValidationError);
    });

    it("ne devrait pas lancer d'erreur pour un deck valide", () => {
      const deck = {
        ...createMockDeck(createValidDeckCards()),
        hero: mockHero,
        havreSac: mockHavreSac,
      };

      expect(() => validateDeckForSave(deck)).not.toThrow();
    });
  });
});
