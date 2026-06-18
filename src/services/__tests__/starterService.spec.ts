import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useCardStore } from "@/stores/cardStore";
import { useDeckStore } from "@/stores/deckStore";
import {
  importDeckCardsToCollection,
  isDeckCardsImported,
} from "@/services/starterService";
import {
  createMockAllyCard,
  createMockActionCard,
  createMockHeroCard,
  createMockHavreSacCard,
} from "tests/factories/card";
import type { Card, OfficialDeckData } from "@/types/cards";

// ---- Mocks (calqués sur deckStore.spec.ts / cardStore.spec.ts) ----

// Mock du cardLoader pour éviter tout appel réseau dans cardStore.initialize()
vi.mock("@/services/cardLoader", () => ({
  loadAllCards: vi.fn(() => Promise.resolve([])),
}));

// Mock du service localStorage : pas de vrai localStorage, pas d'I/O disque
vi.mock("@/services/localStorage", () => ({
  localStorageService: {
    loadCollection: vi.fn(() => ({})),
    saveCollection: vi.fn(),
  },
}));

// Mock @vueuse/core (useLocalStorage utilisé par cardStore pour lastSync)
vi.mock("@vueuse/core", () => ({
  useLocalStorage: vi.fn((_key: string, defaultValue: unknown) => {
    return { value: defaultValue };
  }),
}));

/**
 * Construit un deck officiel minimal et l'enregistre dans le deckStore,
 * en utilisant les cartes seedées dans le cardStore. Les noms du descriptif
 * officiel correspondent exactement aux `name` des cartes (résolution via
 * findCardByName, pas via le mapping statique).
 */
function seedOfficialDeck(
  deckStore: ReturnType<typeof useDeckStore>,
  deckId: string,
  officialData: OfficialDeckData,
) {
  deckStore.decks.push({
    id: deckId,
    name: officialData.name,
    description: `${officialData.name} (Cartes à importer)`,
    hero: null,
    havreSac: null,
    cards: [],
    reserve: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isOfficial: true,
    _officialData: officialData,
  });
}

describe("starterService", () => {
  let cardStore: ReturnType<typeof useCardStore>;
  let deckStore: ReturnType<typeof useDeckStore>;

  let heroCard: Card;
  let havreSacCard: Card;
  let allyCard: Card;
  let actionCard: Card;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    heroCard = createMockHeroCard({ id: "hero-1", name: "Héros Officiel" });
    havreSacCard = createMockHavreSacCard({
      id: "hs-1",
      name: "Havre-Sac Officiel",
    });
    allyCard = createMockAllyCard({ id: "ally-1", name: "Allié Officiel" });
    actionCard = createMockActionCard({
      id: "action-1",
      name: "Action Officielle",
    });

    cardStore = useCardStore();
    cardStore.setCards([heroCard, havreSacCard, allyCard, actionCard]);
    // CRUCIAL : addToCollection() appelle initialize() si !isInitialized, ce qui
    // rechargerait les cartes via loadAllCards (mocké → []) et écraserait notre
    // seed. On marque le store comme initialisé pour préserver les cartes.
    cardStore.isInitialized = true;

    deckStore = useDeckStore();
  });

  // ---- importDeckCardsToCollection : résolution + ajout ----

  describe("importDeckCardsToCollection()", () => {
    it("devrait ajouter le héros, le havre-sac et les cartes à la collection", async () => {
      seedOfficialDeck(deckStore, "deck-1", {
        name: "Deck Officiel",
        hero: "Héros Officiel",
        havreSac: "Havre-Sac Officiel",
        cards: [
          { name: "Allié Officiel", quantity: 3 },
          { name: "Action Officielle", quantity: 2 },
        ],
      });

      const result = await importDeckCardsToCollection("deck-1");

      // 4 entrées importées (héros, havre-sac, 2 cartes), pas d'erreurs
      expect(result.cardsAdded).toBe(4);
      expect(result.errors).toEqual([]);
      expect(result.deckName).toBe("Deck Officiel");

      // Les quantités réelles dans la collection reflètent le descriptif
      expect(cardStore.getCardQuantity("hero-1")).toBe(1);
      expect(cardStore.getCardQuantity("hs-1")).toBe(1);
      expect(cardStore.getCardQuantity("ally-1")).toBe(3);
      expect(cardStore.getCardQuantity("action-1")).toBe(2);
    });

    it("devrait signaler une erreur pour une carte introuvable sans interrompre l'import", async () => {
      seedOfficialDeck(deckStore, "deck-1", {
        name: "Deck Partiel",
        hero: "Héros Officiel",
        havreSac: "Havre-Sac Officiel",
        cards: [
          { name: "Allié Officiel", quantity: 3 },
          { name: "Carte Totalement Inexistante Zzz", quantity: 2 },
        ],
      });

      const result = await importDeckCardsToCollection("deck-1");

      // héros + havre-sac + allié = 3 ajoutés ; la carte inconnue est en erreur
      expect(result.cardsAdded).toBe(3);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Carte non trouvee");
      expect(cardStore.getCardQuantity("ally-1")).toBe(3);
    });

    it("devrait lever une erreur si le deck n'a pas de données officielles", async () => {
      deckStore.createDeck("Deck Manuel");
      const manualId = deckStore.currentDeckId!;

      await expect(importDeckCardsToCollection(manualId)).rejects.toThrow(
        "Deck non trouvé ou pas de données officielles",
      );
    });

    it("devrait lever une erreur si le deck n'existe pas", async () => {
      await expect(
        importDeckCardsToCollection("id-inexistant"),
      ).rejects.toThrow("Deck non trouvé ou pas de données officielles");
    });

    it("devrait marquer la description du deck comme « Cartes importées » après import", async () => {
      seedOfficialDeck(deckStore, "deck-1", {
        name: "Deck À Marquer",
        hero: "Héros Officiel",
        havreSac: "Havre-Sac Officiel",
        cards: [{ name: "Allié Officiel", quantity: 1 }],
      });

      await importDeckCardsToCollection("deck-1");

      const deck = deckStore.decks.find((d) => d.id === "deck-1");
      expect(deck?.description).toContain("(Cartes importées)");
      expect(deck?.description).not.toContain("(Cartes à importer)");
    });

    // ---- ACCUMULATION / (absence d')idempotence dans l'import lui-même ----

    it("devrait ACCUMULER les quantités si on importe deux fois (pas de garde interne, pas de plafond à 3)", async () => {
      seedOfficialDeck(deckStore, "deck-1", {
        name: "Deck Double",
        hero: "Héros Officiel",
        havreSac: "Havre-Sac Officiel",
        cards: [{ name: "Allié Officiel", quantity: 3 }],
      });

      await importDeckCardsToCollection("deck-1");
      await importDeckCardsToCollection("deck-1");

      // addToCollection() additionne sans limite : 3 + 3 = 6 (≠ plafond deck de 3).
      // C'est le comportement RÉEL : l'import ne se garde pas lui-même contre les
      // doublons — c'est à l'appelant de vérifier isDeckCardsImported() au préalable.
      expect(cardStore.getCardQuantity("ally-1")).toBe(6);
      expect(cardStore.getCardQuantity("hero-1")).toBe(2);
      expect(cardStore.getCardQuantity("hs-1")).toBe(2);
    });
  });

  // ---- isDeckCardsImported : garde d'idempotence ----

  describe("isDeckCardsImported()", () => {
    it("devrait retourner false avant tout import", () => {
      seedOfficialDeck(deckStore, "deck-1", {
        name: "Deck Non Importé",
        hero: "Héros Officiel",
        havreSac: "Havre-Sac Officiel",
        cards: [{ name: "Allié Officiel", quantity: 3 }],
      });

      expect(isDeckCardsImported("deck-1")).toBe(false);
    });

    it("devrait retourner true une fois toutes les cartes présentes en quantité suffisante", async () => {
      seedOfficialDeck(deckStore, "deck-1", {
        name: "Deck Importé",
        hero: "Héros Officiel",
        havreSac: "Havre-Sac Officiel",
        cards: [
          { name: "Allié Officiel", quantity: 3 },
          { name: "Action Officielle", quantity: 2 },
        ],
      });

      await importDeckCardsToCollection("deck-1");

      expect(isDeckCardsImported("deck-1")).toBe(true);
    });

    it("devrait retourner false si une carte manque encore en quantité suffisante", async () => {
      seedOfficialDeck(deckStore, "deck-1", {
        name: "Deck Sous-Quantité",
        hero: "Héros Officiel",
        havreSac: "Havre-Sac Officiel",
        cards: [{ name: "Allié Officiel", quantity: 3 }],
      });

      // On ajoute manuellement seulement 1 exemplaire de l'allié (< 3 requis)
      await cardStore.addToCollection(heroCard, 1, false);
      await cardStore.addToCollection(havreSacCard, 1, false);
      await cardStore.addToCollection(allyCard, 1, false);

      expect(cardStore.getCardQuantity("ally-1")).toBe(1);
      expect(isDeckCardsImported("deck-1")).toBe(false);
    });

    it("devrait retourner false pour un deck sans données officielles", () => {
      deckStore.createDeck("Deck Manuel");
      const manualId = deckStore.currentDeckId!;

      expect(isDeckCardsImported(manualId)).toBe(false);
    });

    it("devrait servir de garde : un appelant qui le vérifie évite le double-ajout", async () => {
      seedOfficialDeck(deckStore, "deck-1", {
        name: "Deck Gardé",
        hero: "Héros Officiel",
        havreSac: "Havre-Sac Officiel",
        cards: [{ name: "Allié Officiel", quantity: 3 }],
      });

      // Premier import
      if (!isDeckCardsImported("deck-1")) {
        await importDeckCardsToCollection("deck-1");
      }
      // Deuxième tentative : la garde bloque le ré-import
      if (!isDeckCardsImported("deck-1")) {
        await importDeckCardsToCollection("deck-1");
      }

      // Grâce à la garde, la quantité reste à 3 (pas de doublement à 6)
      expect(cardStore.getCardQuantity("ally-1")).toBe(3);
      expect(cardStore.getCardQuantity("hero-1")).toBe(1);
    });
  });

  // ---- findCardWithMapping (testé indirectement via le mapping statique) ----

  describe("résolution par mapping statique (findCardWithMapping)", () => {
    it("devrait résoudre un nom officiel via CARD_NAME_MAPPING vers l'id mappé", async () => {
      // "Bouftou" est mappé vers "bouftou-incarnam" dans CARD_NAME_MAPPING
      const bouftou = createMockAllyCard({
        id: "bouftou-incarnam",
        name: "Nom Différent Dans Le Catalogue",
      });
      cardStore.setCards([heroCard, havreSacCard, bouftou]);
      cardStore.isInitialized = true;

      seedOfficialDeck(deckStore, "deck-map", {
        name: "Deck Mapping",
        hero: "Héros Officiel",
        havreSac: "Havre-Sac Officiel",
        // Le nom "Bouftou" ne correspond à AUCUN name de carte : seul le mapping
        // statique permet de le résoudre vers l'id "bouftou-incarnam".
        cards: [{ name: "Bouftou", quantity: 2 }],
      });

      const result = await importDeckCardsToCollection("deck-map");

      expect(result.errors).toEqual([]);
      expect(cardStore.getCardQuantity("bouftou-incarnam")).toBe(2);
    });
  });
});
