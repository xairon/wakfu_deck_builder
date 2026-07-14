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
// vi.hoisted : le deckStore importe désormais cloudSync STATIQUEMENT, donc les
// factories vi.mock s'exécutent pendant l'import hoisté du spec — avant
// l'initialisation de `const` top-level (TDZ).
const {
  loadDecksFromCloud,
  saveDecksToCloud,
  deleteDeckFromCloud,
  deckToCloud,
  cloudToDeck,
} = vi.hoisted(() => ({
  loadDecksFromCloud: vi.fn(),
  saveDecksToCloud: vi.fn(),
  deleteDeckFromCloud: vi.fn(),
  // Spies qui ENROBENT la vraie implémentation des convertisseurs purs (impl
  // posée dans la factory via importActual). On vérifie ainsi la vraie
  // sérialisation CloudDeck assemblée par le store, pas un stub trivial.
  deckToCloud: vi.fn(),
  cloudToDeck: vi.fn(),
}));
saveDecksToCloud.mockResolvedValue(true);
deleteDeckFromCloud.mockResolvedValue(true);

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

  // -------------------------------------------------------------------------
  // Fusion anti-perte au pull (bug « 48/48 → 26 cartes » signalé en prod) :
  // le cloud ne fait autorité que s'il est RÉSOLU et plus récent, deck par deck.
  // -------------------------------------------------------------------------

  it("pullCloudDecks: conserve le deck local quand des cartes cloud ne se résolvent pas (catalogue incomplet)", async () => {
    const ally = createMockAllyCard({ id: "c1", name: "C1" });
    useCardStore().setCards([ally]);
    const store = useDeckStore();
    const id = store.createDeck("Mon deck");
    store.addCard(ally, 3);

    // Le cloud renvoie le même deck, mais avec des cartes que le catalogue ne
    // sait pas résoudre (extension non chargée). L'ancienne logique écrasait le
    // local avec une version TRONQUÉE (les introuvables étaient jetées).
    loadDecksFromCloud.mockResolvedValue([
      {
        id,
        user_id: "user-1",
        name: "Mon deck",
        hero_id: null,
        havre_sac_id: null,
        cards: [{ cardId: "carte-extension-manquante", quantity: 22 }],
        created_at: "2026-07-01T00:00:00.000Z",
        // Même « plus récent », un deck non résolu ne doit PAS écraser le local.
        updated_at: "2099-01-01T00:00:00.000Z",
      },
    ]);

    await store.pullCloudDecks();

    const deck = store.decks.find((d) => d.id === id);
    expect(deck).toBeDefined();
    expect(deck!.cards.reduce((a, c) => a + c.quantity, 0)).toBe(3);
    expect(deck!.cards[0].card.id).toBe("c1");
  });

  it("pullCloudDecks: garde la version locale plus récente (updated_at deck par deck)", async () => {
    const ally = createMockAllyCard({ id: "c1", name: "C1" });
    useCardStore().setCards([ally]);
    const store = useDeckStore();
    const id = store.createDeck("Mon deck"); // updatedAt = maintenant
    store.addCard(ally, 3);

    // Version cloud PÉRIMÉE (push perdu / jamais parti) mais 100 % résolvable.
    loadDecksFromCloud.mockResolvedValue([
      {
        id,
        user_id: "user-1",
        name: "Mon deck",
        hero_id: null,
        havre_sac_id: null,
        cards: [{ cardId: "c1", quantity: 1 }],
        created_at: "2020-01-01T00:00:00.000Z",
        updated_at: "2020-01-01T00:00:00.000Z",
      },
    ]);

    await store.pullCloudDecks();

    const deck = store.decks.find((d) => d.id === id);
    expect(deck!.cards.reduce((a, c) => a + c.quantity, 0)).toBe(3);
  });

  it("pullCloudDecks: le cloud plus récent remplace bien le local (multi-appareils)", async () => {
    const ally = createMockAllyCard({ id: "c1", name: "C1" });
    useCardStore().setCards([ally]);
    const store = useDeckStore();
    const id = store.createDeck("Mon deck");
    store.addCard(ally, 3);
    store.decks[0].updatedAt = "2026-07-01T00:00:00.000Z"; // local ancien

    loadDecksFromCloud.mockResolvedValue([
      {
        id,
        user_id: "user-1",
        name: "Mon deck",
        hero_id: null,
        havre_sac_id: null,
        cards: [{ cardId: "c1", quantity: 1 }],
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-14T12:00:00.000Z", // édité depuis un autre appareil
      },
    ]);

    await store.pullCloudDecks();

    const deck = store.decks.find((d) => d.id === id);
    expect(deck!.cards.reduce((a, c) => a + c.quantity, 0)).toBe(1);
  });

  it("pullCloudDecks: conserve les decks locaux absents du cloud (push jamais parti)", async () => {
    const store = useDeckStore();
    const orphanId = store.createDeck("Orphelin local");

    loadDecksFromCloud.mockResolvedValue([
      {
        id: "d-cloud",
        user_id: "user-1",
        name: "Deck Cloud",
        hero_id: null,
        havre_sac_id: null,
        cards: [],
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      },
    ]);

    await store.pullCloudDecks();

    expect(store.decks.map((d) => d.id)).toContain("d-cloud");
    expect(store.decks.map((d) => d.id)).toContain(orphanId);
  });

  // -------------------------------------------------------------------------
  // Push résilient : retry sur échec, état honnête, flush au déchargement.
  // -------------------------------------------------------------------------

  it("le push re-tente après un échec réseau puis se rétablit", async () => {
    vi.useFakeTimers();
    const store = useDeckStore();
    saveDecksToCloud.mockResolvedValueOnce(false); // 1er push : échec
    store.createDeck("X");

    await vi.advanceTimersByTimeAsync(1600); // debounce → push #1 (échec)
    expect(saveDecksToCloud).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5100); // retry → push #2 (succès)
    expect(saveDecksToCloud).toHaveBeenCalledTimes(2);
    expect(store.syncState).toBe("synced");
    vi.useRealTimers();
  });

  it("après épuisement des retries, syncState = error et plus de re-tentative", async () => {
    vi.useFakeTimers();
    const store = useDeckStore();
    saveDecksToCloud.mockResolvedValue(false); // échec persistant
    store.createDeck("X");

    await vi.advanceTimersByTimeAsync(1600); // push initial
    await vi.advanceTimersByTimeAsync(5100); // retry 1
    await vi.advanceTimersByTimeAsync(5100); // retry 2
    const calls = saveDecksToCloud.mock.calls.length;
    expect(calls).toBe(3);
    expect(store.syncState).toBe("error");

    await vi.advanceTimersByTimeAsync(20000); // plus aucune tentative
    expect(saveDecksToCloud).toHaveBeenCalledTimes(calls);
    saveDecksToCloud.mockResolvedValue(true);
    vi.useRealTimers();
  });

  it("syncState passe à error quand le push est sauté sans session valide", async () => {
    vi.useFakeTimers();
    authenticated = false;
    const store = useDeckStore();
    store.createDeck("X");

    await vi.advanceTimersByTimeAsync(1600);

    // Supabase configuré mais session absente : la modification n'est PAS
    // persistée côté cloud — l'UI ne doit pas laisser croire le contraire.
    expect(saveDecksToCloud).not.toHaveBeenCalled();
    expect(store.syncState).toBe("error");
    vi.useRealTimers();
  });

  it("un pagehide force le push en attente (pas de perte au rechargement)", async () => {
    vi.useFakeTimers();
    const store = useDeckStore();
    store.createDeck("Deck en cours"); // push différé programmé (1500 ms)
    saveDecksToCloud.mockClear();

    window.dispatchEvent(new Event("pagehide"));
    await vi.advanceTimersByTimeAsync(0);

    expect(saveDecksToCloud).toHaveBeenCalled();
    expect(store.syncState).toBe("synced");
    vi.useRealTimers();
  });

  it("le passage de l'onglet en arrière-plan force aussi le push en attente", async () => {
    vi.useFakeTimers();
    const store = useDeckStore();
    store.createDeck("Deck en cours");
    saveDecksToCloud.mockClear();

    const original = Object.getOwnPropertyDescriptor(
      Document.prototype,
      "visibilityState",
    );
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);

    expect(saveDecksToCloud).toHaveBeenCalled();

    if (original) {
      Object.defineProperty(document, "visibilityState", original);
    } else {
      delete (document as any).visibilityState;
    }
    vi.useRealTimers();
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
