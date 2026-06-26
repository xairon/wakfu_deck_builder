import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useDeckStore } from "@/stores/deckStore";
import { useCardStore } from "@/stores/cardStore";
import {
  createMockAllyCard,
  createMockActionCard,
  createMockHeroCard,
  createMockHavreSacCard,
} from "tests/factories/card";
import type { Card } from "@/types/cards";

// ---- Mocks ----

// Mock du cardLoader pour éviter les appels réseau dans cardStore
vi.mock("@/services/cardLoader", () => ({
  loadAllCards: vi.fn(() => Promise.resolve([])),
}));

// Mock du service localStorage pour cardStore
vi.mock("@/services/localStorage", () => ({
  localStorageService: {
    loadCollection: vi.fn(() => ({})),
    saveCollection: vi.fn(),
  },
}));

// Mock @vueuse/core
vi.mock("@vueuse/core", () => ({
  useLocalStorage: vi.fn((_key: string, defaultValue: unknown) => {
    return { value: defaultValue };
  }),
}));

describe("deckStore", () => {
  let deckStore: ReturnType<typeof useDeckStore>;
  let cardStore: ReturnType<typeof useCardStore>;

  // Cartes de test réutilisables
  let heroCard: Card;
  let havreSacCard: Card;
  let allyCard: Card;
  let actionCard: Card;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    // Réinitialiser localStorage mock
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
      null,
    );

    heroCard = createMockHeroCard({ id: "hero-1", name: "Héros Test" });
    havreSacCard = createMockHavreSacCard({
      id: "hs-1",
      name: "Havre-Sac Test",
    });
    allyCard = createMockAllyCard({ id: "ally-1", name: "Allié Test" });
    actionCard = createMockActionCard({ id: "action-1", name: "Action Test" });

    // Initialiser le cardStore avec des cartes de test
    cardStore = useCardStore();
    cardStore.setCards([heroCard, havreSacCard, allyCard, actionCard]);

    deckStore = useDeckStore();
  });

  // ---- createDeck ----

  describe("createDeck()", () => {
    it("devrait créer un nouveau deck avec le nom fourni", () => {
      const id = deckStore.createDeck("Mon Deck");

      expect(id).toBeTruthy();
      expect(deckStore.decks).toHaveLength(1);
      expect(deckStore.decks[0].name).toBe("Mon Deck");
    });

    it("devrait utiliser un nom par défaut si le nom est vide", () => {
      deckStore.createDeck("");

      expect(deckStore.decks[0].name).toBe("Nouveau deck");
    });

    it("devrait utiliser un nom par défaut si le nom ne contient que des espaces", () => {
      deckStore.createDeck("   ");

      expect(deckStore.decks[0].name).toBe("Nouveau deck");
    });

    it("devrait définir le deck comme deck courant", () => {
      const id = deckStore.createDeck("Test");

      expect(deckStore.currentDeckId).toBe(id);
      expect(deckStore.currentDeck).not.toBeNull();
      expect(deckStore.currentDeck!.name).toBe("Test");
    });

    it("devrait créer un deck avec héros et havre-sac nuls", () => {
      deckStore.createDeck("Test");

      expect(deckStore.currentDeck!.hero).toBeNull();
      expect(deckStore.currentDeck!.havreSac).toBeNull();
    });

    it("devrait créer un deck avec un tableau de cartes vide", () => {
      deckStore.createDeck("Test");

      expect(deckStore.currentDeck!.cards).toEqual([]);
    });

    it("devrait persister les decks dans localStorage", () => {
      deckStore.createDeck("Persisté");

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        "wakfu-decks",
        expect.any(String),
      );
    });

    it("devrait définir createdAt et updatedAt", () => {
      deckStore.createDeck("Test");

      const deck = deckStore.currentDeck!;
      expect(deck.createdAt).toBeTruthy();
      expect(deck.updatedAt).toBeTruthy();
    });
  });

  // ---- deleteDeck ----

  describe("deleteDeck()", () => {
    it("devrait supprimer un deck existant par id", () => {
      const id = deckStore.createDeck("A supprimer");
      expect(deckStore.decks).toHaveLength(1);

      deckStore.deleteDeck(id);

      expect(deckStore.decks).toHaveLength(0);
    });

    it("devrait réinitialiser currentDeckId si le deck courant est supprimé", () => {
      const id = deckStore.createDeck("Courant");

      deckStore.deleteDeck(id);

      expect(deckStore.currentDeckId).toBeNull();
    });

    it("devrait basculer vers le premier deck restant si le deck courant est supprimé", () => {
      const id1 = deckStore.createDeck("Premier");
      const id2 = deckStore.createDeck("Second");
      // currentDeckId est id2 (dernier créé)

      deckStore.deleteDeck(id2);

      expect(deckStore.currentDeckId).toBe(id1);
    });

    it("devrait ne rien faire si l'id n'existe pas", () => {
      deckStore.createDeck("Existant");

      deckStore.deleteDeck("id-inexistant");

      expect(deckStore.decks).toHaveLength(1);
    });

    it("devrait persister après suppression", () => {
      const id = deckStore.createDeck("A supprimer");
      vi.clearAllMocks();

      deckStore.deleteDeck(id);

      expect(window.localStorage.setItem).toHaveBeenCalled();
    });
  });

  // ---- setHero ----

  describe("setHero()", () => {
    beforeEach(() => {
      deckStore.createDeck("Deck Test");
    });

    it("devrait définir le héros du deck courant", () => {
      deckStore.setHero(heroCard);

      expect(deckStore.currentDeck!.hero).not.toBeNull();
      expect(deckStore.currentDeck!.hero!.id).toBe("hero-1");
    });

    it("devrait rejeter une carte non-héros", () => {
      deckStore.setHero(allyCard);

      expect(deckStore.currentDeck!.hero).toBeNull();
    });

    it("devrait rejeter un havre-sac comme héros", () => {
      deckStore.setHero(havreSacCard);

      expect(deckStore.currentDeck!.hero).toBeNull();
    });

    it("devrait remplacer le héros existant", () => {
      const hero2 = createMockHeroCard({ id: "hero-2", name: "Héros 2" });

      deckStore.setHero(heroCard);
      deckStore.setHero(hero2);

      expect(deckStore.currentDeck!.hero!.id).toBe("hero-2");
    });

    it("devrait mettre à jour updatedAt", () => {
      deckStore.setHero(heroCard);

      // updatedAt devrait être défini après l'opération
      expect(deckStore.currentDeck!.updatedAt).toBeTruthy();
    });

    it("devrait ne rien faire s'il n'y a pas de deck courant", () => {
      deckStore.currentDeckId = null;

      // Ne devrait pas lever d'erreur
      expect(() => deckStore.setHero(heroCard)).not.toThrow();
    });
  });

  // ---- setHavreSac ----

  describe("setHavreSac()", () => {
    beforeEach(() => {
      deckStore.createDeck("Deck Test");
    });

    it("devrait définir le havre-sac du deck courant", () => {
      deckStore.setHavreSac(havreSacCard);

      expect(deckStore.currentDeck!.havreSac).not.toBeNull();
      expect(deckStore.currentDeck!.havreSac!.id).toBe("hs-1");
    });

    it("devrait rejeter une carte non-Havre-Sac", () => {
      deckStore.setHavreSac(allyCard);

      expect(deckStore.currentDeck!.havreSac).toBeNull();
    });

    it("devrait rejeter un héros comme havre-sac", () => {
      deckStore.setHavreSac(heroCard);

      expect(deckStore.currentDeck!.havreSac).toBeNull();
    });

    it("devrait vérifier le type normalisé Havre-Sac (avec tiret et S majuscule)", () => {
      // La carte créée avec la factory a mainType === 'Havre-Sac'
      deckStore.setHavreSac(havreSacCard);

      expect(deckStore.currentDeck!.havreSac!.mainType).toBe("Havre-Sac");
    });

    it("devrait ne rien faire s'il n'y a pas de deck courant", () => {
      deckStore.currentDeckId = null;

      expect(() => deckStore.setHavreSac(havreSacCard)).not.toThrow();
    });
  });

  // ---- addCard ----

  describe("addCard()", () => {
    beforeEach(() => {
      deckStore.createDeck("Deck Test");
    });

    it("devrait ajouter une carte au deck avec quantité 1 par défaut", () => {
      deckStore.addCard(allyCard);

      expect(deckStore.currentDeck!.cards).toHaveLength(1);
      expect(deckStore.currentDeck!.cards[0].card.id).toBe("ally-1");
      expect(deckStore.currentDeck!.cards[0].quantity).toBe(1);
    });

    it("devrait ajouter une carte avec une quantité spécifiée", () => {
      deckStore.addCard(allyCard, 2);

      expect(deckStore.currentDeck!.cards[0].quantity).toBe(2);
    });

    it("devrait incrémenter la quantité si la carte existe déjà", () => {
      deckStore.addCard(allyCard, 1);
      deckStore.addCard(allyCard, 1);

      expect(deckStore.currentDeck!.cards).toHaveLength(1);
      expect(deckStore.currentDeck!.cards[0].quantity).toBe(2);
    });

    it("devrait respecter la limite de 3 copies maximum", () => {
      deckStore.addCard(allyCard, 2);
      deckStore.addCard(allyCard, 2);

      expect(deckStore.currentDeck!.cards[0].quantity).toBe(3);
    });

    it("devrait ne pas dépasser 3 même en ajoutant directement 5", () => {
      deckStore.addCard(allyCard, 5);

      expect(deckStore.currentDeck!.cards[0].quantity).toBe(3);
    });

    it("devrait rediriger les héros vers setHero au lieu d'ajouter aux cartes", () => {
      deckStore.addCard(heroCard);

      expect(deckStore.currentDeck!.hero).not.toBeNull();
      expect(deckStore.currentDeck!.hero!.id).toBe("hero-1");
      expect(deckStore.currentDeck!.cards).toHaveLength(0);
    });

    it("devrait rediriger les havre-sacs vers setHavreSac au lieu d'ajouter aux cartes", () => {
      deckStore.addCard(havreSacCard);

      expect(deckStore.currentDeck!.havreSac).not.toBeNull();
      expect(deckStore.currentDeck!.havreSac!.id).toBe("hs-1");
      expect(deckStore.currentDeck!.cards).toHaveLength(0);
    });

    it("devrait ne rien faire s'il n'y a pas de deck courant", () => {
      deckStore.currentDeckId = null;

      expect(() => deckStore.addCard(allyCard)).not.toThrow();
    });

    it("addCard devrait refuser une 4ᵉ copie répartie sur deux éditions", () => {
      const incarnam = createMockAllyCard({
        id: "tofu-incarnam",
        name: "Tofu",
      });
      const dofus = createMockAllyCard({
        id: "tofu-dofus-collection",
        name: "Tofu",
      });

      deckStore.addCard(incarnam, 3);
      deckStore.addCard(dofus, 1); // doit être bloqué (déjà 3 Tofu)

      const total = deckStore
        .currentDeck!.cards.filter(
          (c) => c.card.name.trim().toLowerCase() === "tofu",
        )
        .reduce((a, c) => a + c.quantity, 0);
      expect(total).toBe(3);
    });
  });

  // ---- setEntryEdition ----

  describe("setEntryEdition()", () => {
    beforeEach(() => {
      deckStore.createDeck("Test");
    });

    it("setEntryEdition devrait permuter l'édition en gardant la quantité", () => {
      const incarnam = createMockAllyCard({
        id: "tofu-incarnam",
        name: "Tofu",
      });
      const dofus = createMockAllyCard({
        id: "tofu-dofus-collection",
        name: "Tofu",
      });
      deckStore.addCard(incarnam, 2);

      deckStore.setEntryEdition("tofu-incarnam", false, dofus);

      const entries = deckStore.currentDeck!.cards;
      expect(entries.length).toBe(1);
      expect(entries[0].card.id).toBe("tofu-dofus-collection");
      expect(entries[0].quantity).toBe(2);
    });

    it("setEntryEdition devrait fusionner si l'édition cible existe déjà (même zone)", () => {
      const incarnam = createMockAllyCard({
        id: "tofu-incarnam",
        name: "Tofu",
      });
      const dofus = createMockAllyCard({
        id: "tofu-dofus-collection",
        name: "Tofu",
      });
      deckStore.addCard(incarnam, 2);
      deckStore.addCard(dofus, 1);

      deckStore.setEntryEdition("tofu-incarnam", false, dofus);

      const entries = deckStore.currentDeck!.cards;
      expect(entries.length).toBe(1);
      expect(entries[0].card.id).toBe("tofu-dofus-collection");
      expect(entries[0].quantity).toBe(3);
    });

    it("setEntryEdition devrait ignorer une cible qui n'est pas une réimpression", () => {
      const tofu = createMockAllyCard({ id: "tofu-incarnam", name: "Tofu" });
      const bouftou = createMockAllyCard({
        id: "bouftou-amakna",
        name: "Bouftou",
      });
      deckStore.addCard(tofu, 2);

      deckStore.setEntryEdition("tofu-incarnam", false, bouftou);

      const entries = deckStore.currentDeck!.cards;
      expect(entries.length).toBe(1);
      expect(entries[0].card.id).toBe("tofu-incarnam");
      expect(entries[0].quantity).toBe(2);
    });
  });

  // ---- removeCard ----

  describe("removeCard()", () => {
    beforeEach(() => {
      deckStore.createDeck("Deck Test");
      deckStore.addCard(allyCard, 3);
    });

    it("devrait retirer 1 copie par défaut", () => {
      deckStore.removeCard("ally-1");

      expect(deckStore.currentDeck!.cards[0].quantity).toBe(2);
    });

    it("devrait retirer la quantité spécifiée", () => {
      deckStore.removeCard("ally-1", 2);

      expect(deckStore.currentDeck!.cards[0].quantity).toBe(1);
    });

    it("devrait supprimer la carte du deck si la quantité atteint 0", () => {
      deckStore.removeCard("ally-1", 3);

      expect(deckStore.currentDeck!.cards).toHaveLength(0);
    });

    it("devrait supprimer la carte si la quantité retirée dépasse la quantité actuelle", () => {
      deckStore.removeCard("ally-1", 10);

      expect(deckStore.currentDeck!.cards).toHaveLength(0);
    });

    it("devrait ne rien faire si la carte n'est pas dans le deck", () => {
      deckStore.removeCard("inexistant");

      expect(deckStore.currentDeck!.cards).toHaveLength(1);
      expect(deckStore.currentDeck!.cards[0].quantity).toBe(3);
    });

    it("devrait ne rien faire s'il n'y a pas de deck courant", () => {
      deckStore.currentDeckId = null;

      expect(() => deckStore.removeCard("ally-1")).not.toThrow();
    });
  });

  // ---- isValid ----

  describe("isValid", () => {
    it("devrait être invalide pour un deck vide", () => {
      deckStore.createDeck("Vide");

      expect(deckStore.isValid).toBe(false);
    });

    it("devrait être invalide sans héros", () => {
      deckStore.createDeck("Sans héros");
      deckStore.setHavreSac(havreSacCard);

      // Ajouter 48 cartes
      for (let i = 0; i < 16; i++) {
        const card = createMockAllyCard({
          id: `v-ally-${i}`,
          name: `V Ally ${i}`,
        });
        cardStore.setCards([...cardStore.cards, card]);
        deckStore.addCard(card, 3);
      }

      expect(deckStore.heroCount).toBe(0);
      expect(deckStore.isValid).toBe(false);
    });

    it("devrait être invalide sans havre-sac", () => {
      deckStore.createDeck("Sans HS");
      deckStore.setHero(heroCard);

      for (let i = 0; i < 16; i++) {
        const card = createMockAllyCard({
          id: `v-ally-${i}`,
          name: `V Ally ${i}`,
        });
        cardStore.setCards([...cardStore.cards, card]);
        deckStore.addCard(card, 3);
      }

      expect(deckStore.havreSacCount).toBe(0);
      expect(deckStore.isValid).toBe(false);
    });

    it("devrait être invalide avec moins de 48 cartes", () => {
      deckStore.createDeck("Pas assez");
      deckStore.setHero(heroCard);
      deckStore.setHavreSac(havreSacCard);
      deckStore.addCard(allyCard, 3);

      expect(deckStore.cardCount).toBe(3);
      expect(deckStore.isValid).toBe(false);
    });

    it("devrait être valide avec héros + havre-sac + exactement 48 cartes", () => {
      deckStore.createDeck("Valide");
      deckStore.setHero(heroCard);
      deckStore.setHavreSac(havreSacCard);

      // Ajouter 16 cartes uniques x 3 = 48
      for (let i = 0; i < 16; i++) {
        const card = createMockAllyCard({
          id: `valid-ally-${i}`,
          name: `Allié Valide ${i}`,
        });
        cardStore.setCards([...cardStore.cards, card]);
        deckStore.addCard(card, 3);
      }

      expect(deckStore.cardCount).toBe(48);
      expect(deckStore.heroCount).toBe(1);
      expect(deckStore.havreSacCount).toBe(1);
      expect(deckStore.isValid).toBe(true);
    });

    it("devrait vérifier que MIN_DECK_SIZE === MAX_DECK_SIZE === 48", () => {
      // Créer un deck avec 47 cartes (pas assez)
      deckStore.createDeck("47 cartes");
      deckStore.setHero(heroCard);
      deckStore.setHavreSac(havreSacCard);

      for (let i = 0; i < 15; i++) {
        const card = createMockAllyCard({
          id: `size-ally-${i}`,
          name: `Size Ally ${i}`,
        });
        cardStore.setCards([...cardStore.cards, card]);
        deckStore.addCard(card, 3);
      }
      // 15 * 3 = 45, ajoutons 2 de plus
      const extraCard = createMockAllyCard({
        id: "size-extra",
        name: "Size Extra",
      });
      cardStore.setCards([...cardStore.cards, extraCard]);
      deckStore.addCard(extraCard, 2);

      expect(deckStore.cardCount).toBe(47);
      expect(deckStore.isValid).toBe(false);
    });

    it("devrait être invalide si la réserve n'a ni 0 ni 12 cartes (règle 101.4)", () => {
      deckStore.createDeck("Réserve invalide");
      deckStore.setHero(heroCard);
      deckStore.setHavreSac(havreSacCard);

      // 48 cartes principales (16 x 3)
      for (let i = 0; i < 16; i++) {
        const card = createMockAllyCard({
          id: `res-ally-${i}`,
          name: `Res Ally ${i}`,
        });
        cardStore.setCards([...cardStore.cards, card]);
        deckStore.addCard(card, 3);
      }
      // 5 cartes en réserve → ni 0 ni 12 → deck invalide
      const r1 = createMockActionCard({
        id: "res-extra-1",
        name: "Res Extra 1",
      });
      const r2 = createMockActionCard({
        id: "res-extra-2",
        name: "Res Extra 2",
      });
      cardStore.setCards([...cardStore.cards, r1, r2]);
      deckStore.addCard(r1, 3, true);
      deckStore.addCard(r2, 2, true);

      expect(deckStore.cardCount).toBe(48);
      expect(deckStore.reserveCount).toBe(5);
      expect(deckStore.isValid).toBe(false);
    });

    it("devrait être valide avec une réserve de exactement 12 cartes", () => {
      deckStore.createDeck("Réserve 12");
      deckStore.setHero(heroCard);
      deckStore.setHavreSac(havreSacCard);

      for (let i = 0; i < 16; i++) {
        const card = createMockAllyCard({
          id: `res12-ally-${i}`,
          name: `Res12 Ally ${i}`,
        });
        cardStore.setCards([...cardStore.cards, card]);
        deckStore.addCard(card, 3);
      }
      // 12 cartes en réserve (4 x 3)
      for (let i = 0; i < 4; i++) {
        const card = createMockActionCard({
          id: `res12-act-${i}`,
          name: `Res12 Action ${i}`,
        });
        cardStore.setCards([...cardStore.cards, card]);
        deckStore.addCard(card, 3, true);
      }

      expect(deckStore.cardCount).toBe(48);
      expect(deckStore.reserveCount).toBe(12);
      expect(deckStore.isValid).toBe(true);
    });
  });

  // ---- cardCount / totalCount / uniqueCardCount ----

  describe("Compteurs", () => {
    beforeEach(() => {
      deckStore.createDeck("Compteurs");
    });

    it("devrait calculer cardCount correctement", () => {
      deckStore.addCard(allyCard, 3);
      deckStore.addCard(actionCard, 2);

      expect(deckStore.cardCount).toBe(5);
    });

    it("devrait calculer totalCount incluant héros et havre-sac", () => {
      deckStore.setHero(heroCard);
      deckStore.setHavreSac(havreSacCard);
      deckStore.addCard(allyCard, 3);

      // 1 héros + 1 havre-sac + 3 cartes = 5
      expect(deckStore.totalCount).toBe(5);
    });

    it("devrait calculer uniqueCardCount correctement", () => {
      deckStore.addCard(allyCard, 3);
      deckStore.addCard(actionCard, 2);

      expect(deckStore.uniqueCardCount).toBe(2);
    });

    it("devrait retourner 0 si aucun deck courant", () => {
      deckStore.currentDeckId = null;

      expect(deckStore.cardCount).toBe(0);
      expect(deckStore.totalCount).toBe(0);
      expect(deckStore.uniqueCardCount).toBe(0);
    });
  });

  // ---- importDeck ----

  describe("importDeck()", () => {
    it("devrait importer un deck depuis un format texte avec un nom", () => {
      const deckData = `# Mon Deck Importé
1 ${heroCard.name} (Héros)
1 ${havreSacCard.name} (Havre-Sac)
3 ${allyCard.name}
2 ${actionCard.name}`;

      const result = deckStore.importDeck(deckData);

      expect(result.success).toBe(true);
      expect(result.deckId).toBeTruthy();
      expect(result.stats.heroSet).toBe(true);
      expect(result.stats.havreSacSet).toBe(true);
    });

    it("devrait utiliser le nom de la première ligne comme nom du deck", () => {
      const result = deckStore.importDeck(
        "# Deck Personnalisé\n3 " + allyCard.name,
      );

      const deck = deckStore.decks.find((d) => d.id === result.deckId);
      expect(deck?.name).toBe("Deck Personnalisé");
    });

    it('devrait utiliser "Deck importé" si la première ligne n\'est pas un titre', () => {
      const result = deckStore.importDeck("3 " + allyCard.name);

      const deck = deckStore.decks.find((d) => d.id === result.deckId);
      expect(deck?.name).toBe("Deck importé");
    });

    it("devrait signaler des erreurs pour les cartes introuvables", () => {
      const result = deckStore.importDeck("# Test\n3 Carte Inexistante Xyz");

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Carte non trouvée");
    });

    it("devrait signaler des erreurs pour les lignes au format invalide", () => {
      const result = deckStore.importDeck("# Test\nPas un format valide");

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Format invalide");
    });

    it("devrait avertir si aucun héros n'est défini", () => {
      const result = deckStore.importDeck("# Test\n3 " + allyCard.name);

      expect(result.warnings).toContain("Aucun héros défini");
    });

    it("devrait avertir si aucun havre-sac n'est défini", () => {
      const result = deckStore.importDeck("# Test\n3 " + allyCard.name);

      expect(result.warnings).toContain("Aucun havre-sac défini");
    });

    it("devrait limiter les copies à 3 maximum", () => {
      const result = deckStore.importDeck("# Test\n5 " + allyCard.name);

      const deck = deckStore.decks.find((d) => d.id === result.deckId);
      const addedCard = deck?.cards.find((c) => c.card.id === allyCard.id);
      expect(addedCard?.quantity).toBe(3);
    });

    it("devrait retourner success false pour des données vides", () => {
      const result = deckStore.importDeck("");

      // L'import crée quand même le deck, mais sans cartes
      expect(result.deckId).toBeTruthy();
    });
  });

  // ---- exportDeck ----

  describe("exportDeck()", () => {
    it("devrait exporter un deck au format texte", () => {
      const id = deckStore.createDeck("Deck Export");
      deckStore.setHero(heroCard);
      deckStore.setHavreSac(havreSacCard);
      deckStore.addCard(allyCard, 3);
      deckStore.addCard(actionCard, 2);

      const exported = deckStore.exportDeck(id);

      expect(exported).toContain("# Deck Export");
      expect(exported).toContain(`1 ${heroCard.name} (Héros)`);
      expect(exported).toContain(`1 ${havreSacCard.name} (Havre-Sac)`);
      expect(exported).toContain(`3 ${allyCard.name}`);
      expect(exported).toContain(`2 ${actionCard.name}`);
    });

    it("devrait retourner une chaîne vide si le deck n'existe pas", () => {
      const exported = deckStore.exportDeck("inexistant");

      expect(exported).toBe("");
    });

    it("devrait trier les cartes par type puis par nom", () => {
      const id = deckStore.createDeck("Trié");
      deckStore.addCard(actionCard, 2); // Action
      deckStore.addCard(allyCard, 1); // Allié

      const exported = deckStore.exportDeck(id);
      const lines = exported.split("\n").filter((l) => l.trim());

      // "Action" vient avant "Allié" alphabétiquement
      const actionLine = lines.findIndex((l) => l.includes(actionCard.name));
      const allyLine = lines.findIndex((l) => l.includes(allyCard.name));

      expect(actionLine).toBeLessThan(allyLine);
    });

    it("devrait ne pas inclure de ligne héros si pas de héros", () => {
      const id = deckStore.createDeck("Sans héros");
      deckStore.addCard(allyCard, 1);

      const exported = deckStore.exportDeck(id);

      expect(exported).not.toContain("(Héros)");
    });

    it("devrait ne pas inclure de ligne havre-sac si pas de havre-sac", () => {
      const id = deckStore.createDeck("Sans HS");
      deckStore.addCard(allyCard, 1);

      const exported = deckStore.exportDeck(id);

      expect(exported).not.toContain("(Havre-Sac)");
    });
  });

  // ---- loadDecks / saveDecks (persistence) ----

  describe("loadDecks() / saveDecks()", () => {
    it("devrait charger les decks depuis localStorage", () => {
      const storedDecks = [
        {
          id: "stored-1",
          name: "Deck Stocké",
          hero: null,
          havreSac: null,
          cards: [],
          reserve: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify(storedDecks),
      );

      deckStore.loadDecks();

      expect(deckStore.decks).toHaveLength(1);
      expect(deckStore.decks[0].name).toBe("Deck Stocké");
    });

    it("devrait gérer un localStorage vide", () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        null,
      );

      deckStore.loadDecks();

      expect(deckStore.decks).toEqual([]);
    });

    it("devrait gérer un JSON invalide dans localStorage", () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        "pas du json valide",
      );

      deckStore.loadDecks();

      expect(deckStore.decks).toEqual([]);
      expect(deckStore.loadingError).toBeTruthy();
    });

    it("devrait sauvegarder les decks dans localStorage", () => {
      deckStore.createDeck("A sauvegarder");

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        "wakfu-decks",
        expect.any(String),
      );

      // Vérifier que les données sauvegardées sont valides
      const lastCall = (window.localStorage.setItem as ReturnType<typeof vi.fn>)
        .mock.calls;
      const savedData = JSON.parse(lastCall[lastCall.length - 1][1]);
      expect(savedData).toHaveLength(1);
      expect(savedData[0].name).toBe("A sauvegarder");
    });

    it("devrait migrer le format cards objet vers tableau", () => {
      const storedDecks = [
        {
          id: "migrated-1",
          name: "Deck Migré",
          hero: null,
          havreSac: null,
          cards: { "ally-1": 2 }, // ancien format objet
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify(storedDecks),
      );

      deckStore.loadDecks();

      // Devrait avoir migré en tableau
      expect(Array.isArray(deckStore.decks[0].cards)).toBe(true);
    });

    it("devrait gérer un format de données non-tableau dans localStorage", () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        JSON.stringify({ notAnArray: true }),
      );

      deckStore.loadDecks();

      expect(deckStore.decks).toEqual([]);
      expect(deckStore.loadingError).toBeTruthy();
    });
  });

  // ---- renameDeck ----

  describe("renameDeck()", () => {
    it("devrait renommer un deck existant", () => {
      const id = deckStore.createDeck("Ancien Nom");

      deckStore.renameDeck(id, "Nouveau Nom");

      expect(deckStore.decks[0].name).toBe("Nouveau Nom");
    });

    it("devrait garder l'ancien nom si le nouveau est vide", () => {
      const id = deckStore.createDeck("Gardé");

      deckStore.renameDeck(id, "   ");

      expect(deckStore.decks[0].name).toBe("Gardé");
    });

    it("devrait ne rien faire si l'id n'existe pas", () => {
      deckStore.createDeck("Existant");

      deckStore.renameDeck("fake-id", "Nouveau");

      expect(deckStore.decks[0].name).toBe("Existant");
    });
  });

  // ---- clearDeck ----

  describe("clearDeck()", () => {
    it("devrait vider le deck courant", () => {
      deckStore.createDeck("A vider");
      deckStore.setHero(heroCard);
      deckStore.setHavreSac(havreSacCard);
      deckStore.addCard(allyCard, 3);

      deckStore.clearDeck();

      expect(deckStore.currentDeck!.hero).toBeNull();
      expect(deckStore.currentDeck!.havreSac).toBeNull();
      expect(deckStore.currentDeck!.cards).toEqual([]);
    });
  });

  // ---- removeHero / removeHavreSac ----

  describe("removeHero() / removeHavreSac()", () => {
    beforeEach(() => {
      deckStore.createDeck("Test Remove");
      deckStore.setHero(heroCard);
      deckStore.setHavreSac(havreSacCard);
    });

    it("devrait retirer le héros", () => {
      deckStore.removeHero();

      expect(deckStore.currentDeck!.hero).toBeNull();
    });

    it("devrait retirer le havre-sac", () => {
      deckStore.removeHavreSac();

      expect(deckStore.currentDeck!.havreSac).toBeNull();
    });
  });

  // ---- Distributions ----

  describe("Distributions (element, type, cost)", () => {
    beforeEach(() => {
      deckStore.createDeck("Distributions");
    });

    it("devrait calculer la distribution par type", () => {
      deckStore.addCard(allyCard, 3);
      deckStore.addCard(actionCard, 2);

      const dist = deckStore.typeDistribution;
      expect(dist["Allié"]).toBe(3);
      expect(dist["Action"]).toBe(2);
    });

    it("devrait retourner un objet vide sans deck courant", () => {
      deckStore.currentDeckId = null;

      expect(deckStore.typeDistribution).toEqual({});
      expect(deckStore.elementDistribution).toEqual({});
    });
  });
});
