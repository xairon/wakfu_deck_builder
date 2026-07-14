import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

// État contrôlable par test
let configured = true;
let authenticated = true;
const loadCollectionFromCloud = vi.fn();
const saveCollectionToCloud = vi.fn();
const deleteCollectionEntryFromCloud = vi.fn();

vi.mock("@/services/supabase", () => ({
  get supabase() {
    return configured ? {} : null;
  },
  isSupabaseConfigured: () => configured,
}));

vi.mock("@/services/cloudSync", () => ({
  loadCollectionFromCloud: (...args: any[]) => loadCollectionFromCloud(...args),
  saveCollectionToCloud: (...args: any[]) => saveCollectionToCloud(...args),
  deleteCollectionEntryFromCloud: (...args: any[]) =>
    deleteCollectionEntryFromCloud(...args),
}));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: () => ({ isAuthenticated: authenticated }),
}));

import { useCardStore } from "@/stores/cardStore";

describe("cardStore — synchronisation cloud de la collection", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    configured = true;
    authenticated = true;
    loadCollectionFromCloud.mockReset();
    saveCollectionToCloud.mockReset();
    saveCollectionToCloud.mockResolvedValue(true);
    deleteCollectionEntryFromCloud.mockReset();
    deleteCollectionEntryFromCloud.mockResolvedValue(true);
  });

  it("le cloud fait autorité quand il contient des données", async () => {
    loadCollectionFromCloud.mockResolvedValue({
      cardX: { normal: 2, foil: 1 },
    });
    const store = useCardStore();

    await store.pullCloudCollection();

    expect(store.collection).toEqual({ cardX: { normal: 2, foil: 1 } });
    expect(saveCollectionToCloud).not.toHaveBeenCalled();
  });

  it("initialise le cloud depuis le local quand le cloud est vide", async () => {
    loadCollectionFromCloud.mockResolvedValue({});
    const store = useCardStore();
    store.collection = { localCard: { normal: 1, foil: 0 } };

    await store.pullCloudCollection();

    expect(saveCollectionToCloud).toHaveBeenCalledWith({
      localCard: { normal: 1, foil: 0 },
    });
  });

  it("ne fait rien si Supabase n'est pas configuré", async () => {
    configured = false;
    const store = useCardStore();

    await store.pullCloudCollection();

    expect(loadCollectionFromCloud).not.toHaveBeenCalled();
    expect(saveCollectionToCloud).not.toHaveBeenCalled();
  });

  it("ne fait rien si l'utilisateur n'est pas connecté", async () => {
    authenticated = false;
    const store = useCardStore();

    await store.pullCloudCollection();

    expect(loadCollectionFromCloud).not.toHaveBeenCalled();
    expect(saveCollectionToCloud).not.toHaveBeenCalled();
  });

  it("reste silencieux si le cloud lève une erreur", async () => {
    loadCollectionFromCloud.mockRejectedValue(new Error("offline"));
    const store = useCardStore();
    store.collection = { keep: { normal: 3, foil: 0 } };

    await expect(store.pullCloudCollection()).resolves.toBeUndefined();
    // la collection locale est préservée
    expect(store.collection).toEqual({ keep: { normal: 3, foil: 0 } });
  });

  // -------------------------------------------------------------------------
  // Fusion anti-perte (même architecture que les decks) : le cloud fait
  // autorité SAUF pour les cartes modifiées localement et pas encore poussées.
  // -------------------------------------------------------------------------

  it("le pull n'écrase pas une modification locale non poussée", async () => {
    const store = useCardStore();
    store.isInitialized = true;
    store.collection = { a: { normal: 1, foil: 0 } };
    await store.addToCollection({ id: "a" } as never, 1); // a → 2, non poussé

    loadCollectionFromCloud.mockResolvedValue({
      a: { normal: 1, foil: 0 }, // cloud périmé (push perdu)
      b: { normal: 5, foil: 0 }, // ajouté depuis un autre appareil
    });

    await store.pullCloudCollection();

    expect(store.collection.a).toEqual({ normal: 2, foil: 0 });
    expect(store.collection.b).toEqual({ normal: 5, foil: 0 });
  });

  it("le pull ne ressuscite pas une suppression locale non poussée", async () => {
    const store = useCardStore();
    store.isInitialized = true;
    store.collection = { a: { normal: 1, foil: 0 } };
    await store.removeFromCollection({ id: "a" } as never, 1); // supprimée

    loadCollectionFromCloud.mockResolvedValue({ a: { normal: 1, foil: 0 } });

    await store.pullCloudCollection();

    expect(store.collection.a).toBeUndefined();
    expect(deleteCollectionEntryFromCloud).toHaveBeenCalledWith("a");
  });

  it("après un push réussi, le cloud redevient prioritaire (état local purgé)", async () => {
    vi.useFakeTimers();
    const store = useCardStore();
    store.isInitialized = true;
    store.collection = {};
    await store.addToCollection({ id: "a" } as never, 2);
    await vi.advanceTimersByTimeAsync(1600); // push différé → succès

    loadCollectionFromCloud.mockResolvedValue({ a: { normal: 7, foil: 0 } });
    await store.pullCloudCollection();

    expect(store.collection.a).toEqual({ normal: 7, foil: 0 });
    vi.useRealTimers();
  });

  it("le push collection re-tente après un échec puis se rétablit", async () => {
    vi.useFakeTimers();
    const store = useCardStore();
    store.isInitialized = true;
    saveCollectionToCloud.mockResolvedValueOnce(false);
    await store.addToCollection({ id: "a" } as never, 1);

    await vi.advanceTimersByTimeAsync(1600); // push #1 (échec)
    expect(saveCollectionToCloud).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5100); // retry → succès
    expect(saveCollectionToCloud).toHaveBeenCalledTimes(2);
    expect(store.syncState).toBe("synced");
    vi.useRealTimers();
  });

  it("syncState passe à error quand le push est sauté sans session valide", async () => {
    vi.useFakeTimers();
    authenticated = false;
    const store = useCardStore();
    store.isInitialized = true;
    await store.addToCollection({ id: "a" } as never, 1);

    await vi.advanceTimersByTimeAsync(1600);

    expect(saveCollectionToCloud).not.toHaveBeenCalled();
    expect(store.syncState).toBe("error");
    vi.useRealTimers();
  });

  it("un pagehide force le push collection en attente", async () => {
    vi.useFakeTimers();
    const store = useCardStore();
    store.isInitialized = true;
    await store.addToCollection({ id: "a" } as never, 1);
    saveCollectionToCloud.mockClear();

    window.dispatchEvent(new Event("pagehide"));
    await vi.advanceTimersByTimeAsync(0);

    expect(saveCollectionToCloud).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
