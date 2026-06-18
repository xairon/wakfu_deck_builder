import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { flushPromises } from "@vue/test-utils";
import {
  createMockHeroCard,
  createMockHavreSacCard,
  createMockAllyCard,
} from "tests/factories/card";

let configured = true;
let authenticated = true;
const loadDecksFromCloud = vi.fn();
const saveDecksToCloud = vi.fn().mockResolvedValue(true);
const deleteDeckFromCloud = vi.fn().mockResolvedValue(true);
// Spies qui ENROBENT la vraie implémentation des convertisseurs purs (impl posée
// dans la factory via importActual). On vérifie ainsi la vraie sérialisation
// CloudDeck assemblée par le store, pas un stub trivial.
const deckToCloud = vi.fn();
const cloudToDeck = vi.fn();

vi.mock("@/services/supabase", () => ({
  get supabase() {
    return configured ? {} : null;
  },
  isSupabaseConfigured: () => configured,
}));
vi.mock("@/services/cloudSync", async (importActual) => {
  const actual = await importActual<typeof import("@/services/cloudSync")>();
  // Seules les fonctions réseau restent stubées ; les convertisseurs exécutent
  // la VRAIE logique (enrobée d'un spy pour pouvoir aussi compter les appels).
  deckToCloud.mockImplementation(actual.deckToCloud);
  cloudToDeck.mockImplementation(actual.cloudToDeck);
  return {
    loadDecksFromCloud: (...a: any[]) => loadDecksFromCloud(...a),
    saveDecksToCloud: (...a: any[]) => saveDecksToCloud(...a),
    deleteDeckFromCloud: (...a: any[]) => deleteDeckFromCloud(...a),
    deckToCloud: (...a: any[]) => deckToCloud(...a),
    cloudToDeck: (...a: any[]) => cloudToDeck(...a),
  };
});
vi.mock("@/stores/authStore", () => ({
  useAuthStore: () => ({
    isAuthenticated: authenticated,
    userId: authenticated ? "user-1" : null,
  }),
}));

import { useDeckStore } from "@/stores/deckStore";
import { useCardStore } from "@/stores/cardStore";

describe("deckStore — synchronisation cloud des decks", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // pullCloudDecks exige un catalogue chargé (sinon il s'abstient pour ne pas
    // écraser les decks par des coquilles vides).
    useCardStore().setCards([{ id: "c1", name: "C1" } as never]);
    configured = true;
    authenticated = true;
    loadDecksFromCloud.mockReset();
    saveDecksToCloud.mockClear();
    deleteDeckFromCloud.mockClear();
    deckToCloud.mockClear();
    cloudToDeck.mockClear();
  });

  it("pullCloudDecks: le cloud fait autorité quand il contient des decks", async () => {
    loadDecksFromCloud.mockResolvedValue([{ id: "d1", name: "Cloud Deck" }]);
    const store = useDeckStore();

    await store.pullCloudDecks();

    expect(loadDecksFromCloud).toHaveBeenCalled();
    expect(cloudToDeck).toHaveBeenCalled();
    expect(store.decks).toHaveLength(1);
    expect(store.decks[0].id).toBe("d1");
    // {skipCloud:true} → pas de re-push après un pull
    expect(saveDecksToCloud).not.toHaveBeenCalled();
  });

  it("pullCloudDecks: initialise le cloud depuis le local quand le cloud est vide", async () => {
    loadDecksFromCloud.mockResolvedValue([]);
    const store = useDeckStore();
    store.createDeck("Local Deck");
    saveDecksToCloud.mockClear();
    deckToCloud.mockClear();

    await store.pullCloudDecks();

    expect(saveDecksToCloud).toHaveBeenCalled();
    expect(deckToCloud).toHaveBeenCalled();
  });

  it("pullCloudDecks: ne fait rien si non configuré", async () => {
    configured = false;
    const store = useDeckStore();
    await store.pullCloudDecks();
    expect(loadDecksFromCloud).not.toHaveBeenCalled();
  });

  it("pullCloudDecks: ne fait rien si non connecté", async () => {
    authenticated = false;
    const store = useDeckStore();
    await store.pullCloudDecks();
    expect(loadDecksFromCloud).not.toHaveBeenCalled();
  });

  it("saveDecks pousse les decks vers le cloud (différé)", async () => {
    vi.useFakeTimers();
    const store = useDeckStore();
    store.createDeck("X"); // déclenche saveDecks → push différé (1500ms)
    await vi.advanceTimersByTimeAsync(1600);
    expect(saveDecksToCloud).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("deleteDeck supprime aussi le deck côté cloud", async () => {
    const store = useDeckStore();
    const id = store.createDeck("À supprimer");
    deleteDeckFromCloud.mockClear();

    store.deleteDeck(id);
    await flushPromises();

    expect(deleteDeckFromCloud).toHaveBeenCalledWith(id);
  });

  it("saveDecks sérialise le deck via le VRAI deckToCloud (payload CloudDeck correct)", async () => {
    vi.useFakeTimers();
    const cardStore = useCardStore();
    const hero = createMockHeroCard({ id: "h1", name: "Héros" });
    const hs = createMockHavreSacCard({ id: "hs1", name: "HS" });
    const ally = createMockAllyCard({ id: "a1", name: "Allié" });
    cardStore.setCards([hero, hs, ally]);

    const store = useDeckStore();
    const id = store.createDeck("Deck Réel");
    store.setHero(hero);
    store.setHavreSac(hs);
    store.addCard(ally, 2);
    saveDecksToCloud.mockClear();

    // Flush du push différé (debounce 1500ms)
    await vi.advanceTimersByTimeAsync(1600);
    vi.useRealTimers();

    expect(saveDecksToCloud).toHaveBeenCalled();
    const calls = saveDecksToCloud.mock.calls;
    const payload = calls[calls.length - 1][0] as Array<
      Record<string, unknown>
    >;
    const cloudDeck = payload.find((d) => d.id === id);

    // Vrai format CloudDeck (snake_case) produit par deckToCloud, pas le stub.
    expect(cloudDeck).toMatchObject({
      id,
      name: "Deck Réel",
      hero_id: "h1",
      havre_sac_id: "hs1",
      user_id: "user-1",
    });
    expect(cloudDeck!.cards).toContainEqual({ cardId: "a1", quantity: 2 });
  });
});
