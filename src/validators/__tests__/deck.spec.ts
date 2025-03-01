import { describe, it, expect } from 'vitest';
import {
  DECK_RULES,
  validateDeck,
  validateDeckForSave,
  canAddCard,
  getTotalCards,
  getCardCopies
} from '../deck';
import { ValidationError } from '@/utils/errors';
import type { Card, Deck, HeroCard, HavenBagCard } from '@/types/cards';

describe('Validation des decks', () => {
  // Données de test
  const mockCard: Card = {
    id: '1',
    name: 'Test Card',
    mainType: 'Allié',
    subTypes: [],
    extension: {
      name: 'Test',
      id: 'test'
    },
    rarity: 'Commune',
    stats: {
      ap: 2,
      hp: 2
    },
    artists: []
  };

  const mockHero: HeroCard = {
    id: 'hero1',
    name: 'Test Hero',
    mainType: 'Héros',
    subTypes: [],
    extension: {
      name: 'Test',
      id: 'test'
    },
    rarity: 'Commune',
    class: 'Guerrier',
    recto: {
      stats: {
        ap: 3,
        hp: 3
      },
      effects: [],
      keywords: []
    },
    artists: []
  };

  const mockHavreSac: HavenBagCard = {
    id: 'sac1',
    name: 'Test Havre-sac',
    mainType: 'Havre-Sac',
    subTypes: [],
    extension: {
      name: 'Test',
      id: 'test'
    },
    rarity: 'Commune',
    effects: [],
    artists: []
  };

  const createMockDeck = (cards: Array<{ card: Card; quantity: number; isReserve?: boolean }> = []): Deck => ({
    id: 'test',
    name: 'Test Deck',
    hero: null,
    havreSac: null,
    cards,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  describe('Règles de base', () => {
    it('devrait valider un deck correct', () => {
      const deck = {
        ...createMockDeck([
          { card: mockCard, quantity: 3 },
          { card: { ...mockCard, id: '2' }, quantity: 2 }
        ]),
        hero: mockHero,
        havreSac: mockHavreSac
      };

      const result = validateDeck(deck);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('devrait rejeter un deck sans héros', () => {
      const deck = createMockDeck([
        { card: mockCard, quantity: DECK_RULES.MIN_CARDS }
      ]);

      const result = validateDeck(deck);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Le deck doit avoir un héros');
    });

    it('devrait rejeter un deck sans havre-sac', () => {
      const deck = {
        ...createMockDeck([
          { card: mockCard, quantity: DECK_RULES.MIN_CARDS }
        ]),
        hero: mockHero
      };

      const result = validateDeck(deck);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Le deck doit avoir un havre-sac');
    });

    it('devrait rejeter un deck avec trop peu de cartes', () => {
      const deck = {
        ...createMockDeck([
          { card: mockCard, quantity: 1 }
        ]),
        hero: mockHero,
        havreSac: mockHavreSac
      };

      const result = validateDeck(deck);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Le deck principal doit contenir au moins ${DECK_RULES.MIN_CARDS} cartes`
      );
    });

    it('devrait rejeter un deck avec trop de cartes', () => {
      const deck = {
        ...createMockDeck(
          Array(DECK_RULES.MAX_CARDS + 1).fill({ card: mockCard, quantity: 1 })
        ),
        hero: mockHero,
        havreSac: mockHavreSac
      };

      const result = validateDeck(deck);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `Le deck principal ne peut pas contenir plus de ${DECK_RULES.MAX_CARDS} cartes`
      );
    });
  });

  describe('Validation des copies', () => {
    it('devrait rejeter un deck avec trop de copies d\'une carte', () => {
      const deck = {
        ...createMockDeck([
          { card: mockCard, quantity: DECK_RULES.MAX_COPIES + 1 }
        ]),
        hero: mockHero,
        havreSac: mockHavreSac
      };

      const result = validateDeck(deck);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain(`maximum ${DECK_RULES.MAX_COPIES}`);
    });

    it('devrait valider un deck avec le nombre maximum de copies autorisé', () => {
      const deck = {
        ...createMockDeck([
          { card: mockCard, quantity: DECK_RULES.MAX_COPIES }
        ]),
        hero: mockHero,
        havreSac: mockHavreSac
      };

      const result = validateDeck(deck);
      expect(result.isValid).toBe(true);
    });

    it('devrait limiter les cartes uniques à une seule copie', () => {
      const uniqueCard: Card = {
        ...mockCard,
        id: 'unique',
        keywords: [{ name: 'Unique', description: 'Une seule copie autorisée' }]
      };

      const deck = {
        ...createMockDeck([
          { card: uniqueCard, quantity: 2 }
        ]),
        hero: mockHero,
        havreSac: mockHavreSac
      };

      const result = validateDeck(deck);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('unique');
    });
  });

  describe('Validation de la réserve', () => {
    it('devrait valider un deck avec une réserve correcte', () => {
      const deck = {
        ...createMockDeck([
          { card: mockCard, quantity: DECK_RULES.MIN_CARDS },
          { card: { ...mockCard, id: '2' }, quantity: 2, isReserve: true }
        ]),
        hero: mockHero,
        havreSac: mockHavreSac
      };

      const result = validateDeck(deck);
      expect(result.isValid).toBe(true);
    });

    it('devrait rejeter un deck avec trop de cartes en réserve', () => {
      const deck = {
        ...createMockDeck([
          { card: mockCard, quantity: DECK_RULES.MIN_CARDS },
          { card: { ...mockCard, id: '2' }, quantity: DECK_RULES.MAX_RESERVE + 1, isReserve: true }
        ]),
        hero: mockHero,
        havreSac: mockHavreSac
      };

      const result = validateDeck(deck);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        `La réserve ne peut pas contenir plus de ${DECK_RULES.MAX_RESERVE} cartes`
      );
    });
  });

  describe('Utilitaires', () => {
    describe('canAddCard', () => {
      it('devrait autoriser l\'ajout d\'une nouvelle carte', () => {
        const deck = createMockDeck();
        expect(canAddCard(deck, mockCard)).toBe(true);
      });

      it('devrait refuser l\'ajout si le maximum de copies est atteint', () => {
        const deck = createMockDeck([
          { card: mockCard, quantity: DECK_RULES.MAX_COPIES }
        ]);
        expect(canAddCard(deck, mockCard)).toBe(false);
      });

      it('devrait refuser l\'ajout si le deck est plein', () => {
        const deck = createMockDeck(
          Array(DECK_RULES.MAX_CARDS).fill({ card: mockCard, quantity: 1 })
        );
        expect(canAddCard(deck, { ...mockCard, id: 'new' })).toBe(false);
      });
    });

    describe('getTotalCards', () => {
      it('devrait calculer le total correct', () => {
        const deck = createMockDeck([
          { card: mockCard, quantity: 2 },
          { card: { ...mockCard, id: '2' }, quantity: 3 }
        ]);
        expect(getTotalCards(deck)).toBe(5);
      });

      it('devrait retourner 0 pour un deck vide', () => {
        const deck = createMockDeck();
        expect(getTotalCards(deck)).toBe(0);
      });
    });

    describe('getCardCopies', () => {
      it('devrait retourner le nombre correct de copies', () => {
        const deck = createMockDeck([
          { card: mockCard, quantity: 2 }
        ]);
        expect(getCardCopies(deck, mockCard)).toBe(2);
      });

      it('devrait retourner 0 pour une carte absente', () => {
        const deck = createMockDeck();
        expect(getCardCopies(deck, mockCard)).toBe(0);
      });
    });
  });

  describe('validateDeckForSave', () => {
    it('devrait lancer une erreur pour un deck invalide', () => {
      const deck = createMockDeck([
        { card: mockCard, quantity: DECK_RULES.MAX_COPIES + 1 }
      ]);

      expect(() => validateDeckForSave(deck))
        .toThrow(ValidationError);
    });

    it('ne devrait pas lancer d\'erreur pour un deck valide', () => {
      const deck = {
        ...createMockDeck([
          { card: mockCard, quantity: DECK_RULES.MIN_CARDS }
        ]),
        hero: mockHero,
        havreSac: mockHavreSac
      };

      expect(() => validateDeckForSave(deck))
        .not.toThrow();
    });
  });
}); 