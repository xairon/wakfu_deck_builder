import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useCardStore } from "@/stores/cardStore";
import {
  createMockAllyCard,
  createMockActionCard,
  createMockCardSet,
} from "tests/factories/card";
import type { Card } from "@/types/cards";

// ---- Mocks ----

// Mock du service cardLoader
vi.mock("@/services/cardLoader", () => ({
  loadAllCards: vi.fn(),
}));

// Mock du service localStorage
vi.mock("@/services/localStorage", () => ({
  localStorageService: {
    loadCollection: vi.fn(() => ({})),
    saveCollection: vi.fn(),
  },
}));

// Mock de @vueuse/core useLocalStorage pour éviter les effets de bord
vi.mock("@vueuse/core", () => ({
  useLocalStorage: vi.fn((_key: string, defaultValue: unknown) => {
    return { value: defaultValue };
  }),
}));

import { loadAllCards } from "@/services/cardLoader";
import { localStorageService } from "@/services/localStorage";

const mockLoadAllCards = vi.mocked(loadAllCards);
const mockLocalStorage = vi.mocked(localStorageService);

describe("cardStore", () => {
  let store: ReturnType<typeof useCardStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    store = useCardStore();
  });

  describe("État initial", () => {
    it("devrait commencer avec une collection vide", () => {
      expect(store.collection).toEqual({});
    });

    it("devrait commencer avec un tableau de cartes vide", () => {
      expect(store.cards).toEqual([]);
    });

    it("devrait ne pas être initialisé", () => {
      expect(store.isInitialized).toBe(false);
    });

    it("devrait ne pas être en cours de chargement", () => {
      expect(store.isInitializing).toBe(false);
    });

    it("devrait avoir totalCards à 0", () => {
      expect(store.totalCards).toBe(0);
    });

    it("devrait avoir totalCollection à 0", () => {
      expect(store.totalCollection).toBe(0);
    });

    it("devrait avoir collectionProgress à 0", () => {
      expect(store.collectionProgress).toBe(0);
    });
  });

  describe("initialize()", () => {
    it("devrait charger les cartes via cardLoader avec succès", async () => {
      const mockCards = createMockCardSet(10);
      mockLoadAllCards.mockResolvedValueOnce(mockCards);
      mockLocalStorage.loadCollection.mockReturnValueOnce({});

      await store.initialize();

      expect(mockLoadAllCards).toHaveBeenCalledOnce();
      expect(store.cards).toHaveLength(10);
      expect(store.isInitialized).toBe(true);
      expect(store.isInitializing).toBe(false);
    });

    it("devrait charger la collection depuis localStorage pendant l'initialisation", async () => {
      const mockCards = createMockCardSet(5);
      const savedCollection = { "card-1": { normal: 2, foil: 1 } };
      mockLoadAllCards.mockResolvedValueOnce(mockCards);
      mockLocalStorage.loadCollection.mockReturnValueOnce(savedCollection);

      await store.initialize();

      expect(mockLocalStorage.loadCollection).toHaveBeenCalled();
      expect(store.collection).toEqual(savedCollection);
    });

    it("devrait ne pas recharger si déjà initialisé", async () => {
      const mockCards = createMockCardSet(5);
      mockLoadAllCards.mockResolvedValueOnce(mockCards);
      mockLocalStorage.loadCollection.mockReturnValueOnce({});

      await store.initialize();
      await store.initialize();

      expect(mockLoadAllCards).toHaveBeenCalledOnce();
    });

    it("devrait tenter le fallback API si le cardLoader échoue", async () => {
      mockLoadAllCards.mockRejectedValueOnce(new Error("Load failed"));

      // Mock du fallback fetch
      const fallbackCards = createMockCardSet(3);
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cards: fallbackCards }),
      });
      mockLocalStorage.loadCollection.mockReturnValueOnce({});

      await store.initialize();

      expect(global.fetch).toHaveBeenCalledWith("/api/collection/initial");
      expect(store.cards).toHaveLength(3);
    });

    it("devrait lever une erreur si cardLoader et le fallback API échouent", async () => {
      mockLoadAllCards.mockRejectedValueOnce(new Error("Loader failed"));
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(store.initialize()).rejects.toThrow();
    });

    it("devrait rejeter si loadAllCards retourne un tableau vide", async () => {
      mockLoadAllCards.mockResolvedValueOnce([]);

      // le code lève "Aucune carte n'a pu être chargée" et passe au fallback
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cards: createMockCardSet(2) }),
      });
      mockLocalStorage.loadCollection.mockReturnValueOnce({});

      await store.initialize();
      // Devrait avoir les cartes du fallback
      expect(store.cards).toHaveLength(2);
    });
  });

  describe("addToCollection()", () => {
    let allyCard: Card;

    beforeEach(async () => {
      allyCard = createMockAllyCard({ id: "ally-test" });
      const mockCards = [allyCard];
      mockLoadAllCards.mockResolvedValueOnce(mockCards);
      mockLocalStorage.loadCollection.mockReturnValueOnce({});
      await store.initialize();
    });

    it("devrait ajouter une carte normale à la collection", async () => {
      await store.addToCollection(allyCard, 1, false);

      expect(store.collection["ally-test"]).toEqual({ normal: 1, foil: 0 });
    });

    it("devrait ajouter une carte foil à la collection", async () => {
      await store.addToCollection(allyCard, 1, true);

      expect(store.collection["ally-test"]).toEqual({ normal: 0, foil: 1 });
    });

    it("devrait incrémenter la quantité normale si la carte existe déjà", async () => {
      await store.addToCollection(allyCard, 2, false);
      await store.addToCollection(allyCard, 3, false);

      expect(store.collection["ally-test"].normal).toBe(5);
    });

    it("devrait incrémenter la quantité foil indépendamment", async () => {
      await store.addToCollection(allyCard, 2, false);
      await store.addToCollection(allyCard, 1, true);

      expect(store.collection["ally-test"]).toEqual({ normal: 2, foil: 1 });
    });

    it("devrait sauvegarder dans localStorage après l'ajout", async () => {
      await store.addToCollection(allyCard, 1, false);

      expect(mockLocalStorage.saveCollection).toHaveBeenCalled();
    });
  });

  describe("removeFromCollection()", () => {
    let allyCard: Card;

    beforeEach(async () => {
      allyCard = createMockAllyCard({ id: "ally-remove" });
      mockLoadAllCards.mockResolvedValueOnce([allyCard]);
      mockLocalStorage.loadCollection.mockReturnValueOnce({
        "ally-remove": { normal: 3, foil: 2 },
      });
      await store.initialize();
    });

    it("devrait retirer des cartes normales", async () => {
      await store.removeFromCollection(allyCard, 1, false);

      expect(store.collection["ally-remove"].normal).toBe(2);
    });

    it("devrait retirer des cartes foil", async () => {
      await store.removeFromCollection(allyCard, 1, true);

      expect(store.collection["ally-remove"].foil).toBe(1);
    });

    it("devrait ne pas descendre en dessous de 0", async () => {
      await store.removeFromCollection(allyCard, 10, false);

      expect(store.collection["ally-remove"].normal).toBe(0);
    });

    it("devrait supprimer l'entrée si normal et foil sont à 0", async () => {
      await store.removeFromCollection(allyCard, 3, false);
      await store.removeFromCollection(allyCard, 2, true);

      expect(store.collection["ally-remove"]).toBeUndefined();
    });

    it("devrait ne rien faire si la carte n'est pas dans la collection", async () => {
      const unknownCard = createMockAllyCard({ id: "unknown" });

      await store.removeFromCollection(unknownCard, 1, false);

      // La collection ne devrait pas avoir été modifiée
      expect(store.collection["ally-remove"].normal).toBe(3);
    });

    it("devrait sauvegarder dans localStorage après le retrait", async () => {
      vi.clearAllMocks();
      await store.removeFromCollection(allyCard, 1, false);

      expect(mockLocalStorage.saveCollection).toHaveBeenCalled();
    });
  });

  describe("getCardQuantity() / getFoilCardQuantity()", () => {
    beforeEach(async () => {
      const card = createMockAllyCard({ id: "qty-test" });
      mockLoadAllCards.mockResolvedValueOnce([card]);
      mockLocalStorage.loadCollection.mockReturnValueOnce({
        "qty-test": { normal: 4, foil: 2 },
      });
      await store.initialize();
    });

    it("devrait retourner la quantité normale correcte", () => {
      expect(store.getCardQuantity("qty-test")).toBe(4);
    });

    it("devrait retourner la quantité foil correcte", () => {
      expect(store.getFoilCardQuantity("qty-test")).toBe(2);
    });

    it("devrait retourner 0 pour une carte inconnue", () => {
      expect(store.getCardQuantity("nonexistent")).toBe(0);
    });

    it("devrait retourner 0 pour un foil inconnu", () => {
      expect(store.getFoilCardQuantity("nonexistent")).toBe(0);
    });

    it("devrait retourner 0 pour un id vide", () => {
      expect(store.getCardQuantity("")).toBe(0);
      expect(store.getFoilCardQuantity("")).toBe(0);
    });
  });

  describe("getTotalCardQuantity()", () => {
    beforeEach(async () => {
      const card = createMockAllyCard({ id: "total-test" });
      mockLoadAllCards.mockResolvedValueOnce([card]);
      mockLocalStorage.loadCollection.mockReturnValueOnce({
        "total-test": { normal: 3, foil: 1 },
      });
      await store.initialize();
    });

    it("devrait retourner la somme normal + foil", () => {
      expect(store.getTotalCardQuantity("total-test")).toBe(4);
    });

    it("devrait retourner 0 pour une carte inconnue", () => {
      expect(store.getTotalCardQuantity("unknown")).toBe(0);
    });
  });

  describe("importCollection() / exportCollection()", () => {
    let cards: Card[];

    beforeEach(async () => {
      cards = [
        createMockAllyCard({ id: "imp-1", name: "Allié Import 1" }),
        createMockActionCard({ id: "imp-2", name: "Action Import 2" }),
      ];
      mockLoadAllCards.mockResolvedValueOnce(cards);
      mockLocalStorage.loadCollection.mockReturnValueOnce({});
      await store.initialize();
    });

    it("devrait importer une collection au format CollectionCard[]", async () => {
      const importData = [
        { card: cards[0], quantity: 3, foilQuantity: 1 },
        { card: cards[1], quantity: 2, foilQuantity: 0 },
      ];

      await store.importCollection(importData);

      expect(store.collection["imp-1"]).toEqual({ normal: 3, foil: 1 });
      expect(store.collection["imp-2"]).toEqual({ normal: 2, foil: 0 });
    });

    it("devrait exporter la collection au format CollectionCard[]", async () => {
      // Peupler la collection
      store.collection["imp-1"] = { normal: 5, foil: 2 };
      store.collection["imp-2"] = { normal: 1, foil: 0 };

      const exported = store.exportCollection();

      expect(exported).toHaveLength(2);

      const item1 = exported.find((e) => e.card.id === "imp-1");
      expect(item1).toBeDefined();
      expect(item1!.quantity).toBe(5);
      expect(item1!.foilQuantity).toBe(2);

      const item2 = exported.find((e) => e.card.id === "imp-2");
      expect(item2).toBeDefined();
      expect(item2!.quantity).toBe(1);
      expect(item2!.foilQuantity).toBe(0);
    });

    it("devrait faire un aller-retour import/export correct", async () => {
      const importData = [
        { card: cards[0], quantity: 4, foilQuantity: 1 },
        { card: cards[1], quantity: 2, foilQuantity: 3 },
      ];

      await store.importCollection(importData);
      const exported = store.exportCollection();

      expect(exported).toHaveLength(2);
      const reImported1 = exported.find((e) => e.card.id === "imp-1");
      expect(reImported1!.quantity).toBe(4);
      expect(reImported1!.foilQuantity).toBe(1);
    });

    it("devrait exporter un tableau vide si la collection est vide", () => {
      const exported = store.exportCollection();
      expect(exported).toEqual([]);
    });

    it("devrait ignorer les cartes de la collection qui n'existent plus dans cards", () => {
      // Ajouter une entrée pour une carte qui n'est pas dans store.cards
      store.collection["ghost-card"] = { normal: 1, foil: 0 };

      const exported = store.exportCollection();
      // ghost-card ne devrait pas apparaître
      expect(exported.find((e) => e.card.id === "ghost-card")).toBeUndefined();
    });
  });

  describe("Getters calculés", () => {
    beforeEach(async () => {
      const cards = createMockCardSet(10);
      mockLoadAllCards.mockResolvedValueOnce(cards);
      mockLocalStorage.loadCollection.mockReturnValueOnce({
        "card-1": { normal: 2, foil: 1 },
        "card-2": { normal: 1, foil: 0 },
      });
      await store.initialize();
    });

    it("devrait calculer totalCards correctement", () => {
      expect(store.totalCards).toBe(10);
    });

    it("devrait calculer totalCollection correctement (somme de toutes les quantités)", () => {
      // card-1: 2+1 = 3, card-2: 1+0 = 1 => total = 4
      expect(store.totalCollection).toBe(4);
    });

    it("devrait calculer collectionProgress correctement", () => {
      // 2 cartes uniques / 10 cartes totales = 20%
      expect(store.collectionProgress).toBe(20);
    });

    it("devrait calculer les collectionStats correctement", () => {
      const stats = store.collectionStats;
      expect(stats.totalCards).toBe(2); // cartes uniques
      expect(stats.totalQuantity).toBe(4); // total
      expect(stats.normalCards).toBe(3); // 2 + 1
      expect(stats.foilCards).toBe(1); // 1 + 0
    });
  });

  describe("isCardOwned()", () => {
    let ownedCard: Card;
    let notOwnedCard: Card;

    beforeEach(async () => {
      ownedCard = createMockAllyCard({ id: "owned-1" });
      notOwnedCard = createMockAllyCard({ id: "not-owned-1" });
      mockLoadAllCards.mockResolvedValueOnce([ownedCard, notOwnedCard]);
      mockLocalStorage.loadCollection.mockReturnValueOnce({
        "owned-1": { normal: 1, foil: 0 },
      });
      await store.initialize();
    });

    it("devrait retourner true pour une carte possédée", () => {
      expect(store.isCardOwned(ownedCard)).toBe(true);
    });

    it("devrait retourner false pour une carte non possédée", () => {
      expect(store.isCardOwned(notOwnedCard)).toBe(false);
    });
  });

  describe("setCards()", () => {
    it("devrait remplacer le tableau de cartes", () => {
      const newCards = createMockCardSet(5);
      store.setCards(newCards);

      expect(store.cards).toHaveLength(5);
    });

    it("devrait ne rien faire si l'argument n'est pas un tableau", () => {
      store.setCards(createMockCardSet(3));
      store.setCards(null as any);

      // Devrait garder les 3 cartes précédentes
      expect(store.cards).toHaveLength(3);
    });
  });

  describe("updateCollection()", () => {
    it("devrait mettre à jour la collection avec des données valides", () => {
      const validPayload = {
        "card-a": { normal: 2, foil: 1 },
        "card-b": { normal: 0, foil: 3 },
      };

      store.updateCollection(validPayload);

      expect(store.collection).toEqual(validPayload);
      expect(mockLocalStorage.saveCollection).toHaveBeenCalledWith(
        validPayload,
      );
    });

    it("devrait ignorer un payload invalide (tableau)", () => {
      store.collection = { existing: { normal: 1, foil: 0 } };
      store.updateCollection([1, 2, 3]);

      expect(store.collection).toEqual({ existing: { normal: 1, foil: 0 } });
    });

    it("devrait ignorer un payload null", () => {
      store.collection = { existing: { normal: 1, foil: 0 } };
      store.updateCollection(null);

      expect(store.collection).toEqual({ existing: { normal: 1, foil: 0 } });
    });
  });
});
