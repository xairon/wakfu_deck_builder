import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { flushPromises } from "@vue/test-utils";

let configured = true;
let authenticated = true;
const loadDecksFromCloud = vi.fn();
const saveDecksToCloud = vi.fn().mockResolvedValue(true);
const deleteDeckFromCloud = vi.fn().mockResolvedValue(true);
const deckToCloud = vi.fn((d: any) => ({ id: d.id, name: d.name, cards: [] }));
const cloudToDeck = vi.fn((cd: any) => ({
  id: cd.id,
  name: cd.name,
  hero: null,
  havreSac: null,
  cards: [],
  reserve: [],
  createdAt: "a",
  updatedAt: "b",
}));

vi.mock("@/services/supabase", () => ({
  get supabase() {
    return configured ? {} : null;
  },
  isSupabaseConfigured: () => configured,
}));
vi.mock("@/services/cloudSync", () => ({
  loadDecksFromCloud: (...a: any[]) => loadDecksFromCloud(...a),
  saveDecksToCloud: (...a: any[]) => saveDecksToCloud(...a),
  deleteDeckFromCloud: (...a: any[]) => deleteDeckFromCloud(...a),
  deckToCloud: (...a: any[]) => deckToCloud(...a),
  cloudToDeck: (...a: any[]) => cloudToDeck(...a),
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: () => ({
    isAuthenticated: authenticated,
    userId: authenticated ? "user-1" : null,
  }),
}));

import { useDeckStore } from "@/stores/deckStore";

describe("deckStore — synchronisation cloud des decks", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
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
});
