import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

// État contrôlable par test
let configured = true;
let authenticated = true;
const loadCollectionFromCloud = vi.fn();
const saveCollectionToCloud = vi.fn();

vi.mock("@/services/supabase", () => ({
  get supabase() {
    return configured ? {} : null;
  },
  isSupabaseConfigured: () => configured,
}));

vi.mock("@/services/cloudSync", () => ({
  loadCollectionFromCloud: (...args: any[]) => loadCollectionFromCloud(...args),
  saveCollectionToCloud: (...args: any[]) => saveCollectionToCloud(...args),
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
});
