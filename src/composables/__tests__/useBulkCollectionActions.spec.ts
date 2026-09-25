import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useCardStore } from "@/stores/cardStore";
import { useBulkCollectionActions } from "@/composables/useBulkCollectionActions";
import { createMockAllyCard } from "tests/factories/card";
import type { Card } from "@/types/cards";

// ---- Mocks (mêmes que cardStore.spec.ts : évite le vrai chargement réseau) ----
vi.mock("@/services/cardLoader", () => ({
  loadAllCards: vi.fn(),
}));
vi.mock("@/services/localStorage", () => ({
  localStorageService: {
    loadCollection: vi.fn(() => ({})),
    saveCollection: vi.fn(),
  },
}));
vi.mock("@vueuse/core", () => ({
  useLocalStorage: vi.fn((_key: string, defaultValue: unknown) => ({
    value: defaultValue,
  })),
}));

import { loadAllCards } from "@/services/cardLoader";
const mockLoadAllCards = vi.mocked(loadAllCards);

describe("useBulkCollectionActions", () => {
  let store: ReturnType<typeof useCardStore>;
  let normalCard: Card;
  let uniqueCard: Card;

  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    store = useCardStore();

    normalCard = createMockAllyCard({ id: "bulk-normal" });
    uniqueCard = createMockAllyCard({ id: "bulk-unique", subTypes: ["Unique"] });
    mockLoadAllCards.mockResolvedValueOnce([normalCard, uniqueCard]);
    await store.initialize();
  });

  describe("markAsOwned()", () => {
    it("complète une carte non possédée au playset (3 exemplaires)", async () => {
      const { markAsOwned } = useBulkCollectionActions();
      const changed = await markAsOwned([normalCard]);

      expect(changed).toBe(1);
      expect(store.collection["bulk-normal"]).toEqual({ normal: 3, foil: 0 });
    });

    it("limite une carte Unique à 1 exemplaire", async () => {
      const { markAsOwned } = useBulkCollectionActions();
      const changed = await markAsOwned([uniqueCard]);

      expect(changed).toBe(1);
      expect(store.collection["bulk-unique"]).toEqual({ normal: 1, foil: 0 });
    });

    it("ne retire jamais un exemplaire foil déjà possédé", async () => {
      await store.addToCollection(normalCard, 1, true); // 1 foil déjà possédé

      const { markAsOwned } = useBulkCollectionActions();
      await markAsOwned([normalCard]);

      // Complète avec des exemplaires normaux jusqu'au playset (3), le foil reste.
      expect(store.collection["bulk-normal"]).toEqual({ normal: 2, foil: 1 });
    });

    it("ne modifie pas une carte déjà complète (ou en surplus)", async () => {
      await store.addToCollection(normalCard, 3, false);

      const { markAsOwned } = useBulkCollectionActions();
      const changed = await markAsOwned([normalCard]);

      expect(changed).toBe(0);
      expect(store.collection["bulk-normal"]).toEqual({ normal: 3, foil: 0 });
    });
  });

  describe("markAsMissing()", () => {
    it("remet à zéro une carte possédée", async () => {
      await store.addToCollection(normalCard, 2, false);
      await store.addToCollection(normalCard, 1, true);

      const { markAsMissing } = useBulkCollectionActions();
      const changed = await markAsMissing([normalCard]);

      expect(changed).toBe(1);
      expect(store.collection["bulk-normal"]).toBeUndefined();
    });

    it("ignore les cartes déjà non possédées (aucun changement compté)", async () => {
      const { markAsMissing } = useBulkCollectionActions();
      const changed = await markAsMissing([normalCard]);

      expect(changed).toBe(0);
    });
  });

  describe("adjustQuantity()", () => {
    it("ajoute un exemplaire normal", async () => {
      const { adjustQuantity } = useBulkCollectionActions();
      await adjustQuantity([normalCard], 1, false);

      expect(store.collection["bulk-normal"]).toEqual({ normal: 1, foil: 0 });
    });

    it("ajoute un exemplaire foil sans toucher au normal", async () => {
      await store.addToCollection(normalCard, 2, false);

      const { adjustQuantity } = useBulkCollectionActions();
      await adjustQuantity([normalCard], 1, true);

      expect(store.collection["bulk-normal"]).toEqual({ normal: 2, foil: 1 });
    });

    it("ne descend jamais en dessous de 0", async () => {
      const { adjustQuantity } = useBulkCollectionActions();
      await adjustQuantity([normalCard], -1, false);

      expect(store.collection["bulk-normal"]).toBeUndefined();
    });
  });
});
