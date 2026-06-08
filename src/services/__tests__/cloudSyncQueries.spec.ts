import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

let supabaseStub: any = null;

vi.mock("@/services/supabase", () => ({
  get supabase() {
    return supabaseStub;
  },
  isSupabaseConfigured: () => !!supabaseStub,
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: () => ({ isAuthenticated: true, userId: "user-1" }),
}));

import {
  saveCollectionToCloud,
  loadCollectionFromCloud,
  deleteDeckFromCloud,
} from "@/services/cloudSync";

describe("cloudSync — appels Supabase (query builder)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    supabaseStub = null;
  });

  it("saveCollectionToCloud upsert avec onConflict 'user_id,card_id'", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    supabaseStub = { from: vi.fn(() => ({ upsert })) };

    const ok = await saveCollectionToCloud({ cardA: { normal: 2, foil: 1 } });

    expect(ok).toBe(true);
    expect(supabaseStub.from).toHaveBeenCalledWith("collections");
    const [entries, opts] = upsert.mock.calls[0];
    expect(opts).toEqual({ onConflict: "user_id,card_id" });
    expect(entries[0]).toMatchObject({
      user_id: "user-1",
      card_id: "cardA",
      normal_quantity: 2,
      foil_quantity: 1,
    });
  });

  it("loadCollectionFromCloud mappe les lignes en record { normal, foil }", async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [{ card_id: "x", normal_quantity: 3, foil_quantity: 0 }],
      error: null,
    });
    const select = vi.fn(() => ({ eq }));
    supabaseStub = { from: vi.fn(() => ({ select })) };

    const res = await loadCollectionFromCloud();

    expect(res).toEqual({ x: { normal: 3, foil: 0 } });
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("deleteDeckFromCloud filtre par id ET user_id", async () => {
    const eqUser = vi.fn().mockResolvedValue({ error: null });
    const eqId = vi.fn(() => ({ eq: eqUser }));
    const del = vi.fn(() => ({ eq: eqId }));
    supabaseStub = { from: vi.fn(() => ({ delete: del })) };

    const ok = await deleteDeckFromCloud("deck-9");

    expect(ok).toBe(true);
    expect(supabaseStub.from).toHaveBeenCalledWith("decks");
    expect(eqId).toHaveBeenCalledWith("id", "deck-9");
    expect(eqUser).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("retourne false / null si Supabase non configuré", async () => {
    supabaseStub = null;
    expect(await saveCollectionToCloud({})).toBe(false);
    expect(await loadCollectionFromCloud()).toBeNull();
    expect(await deleteDeckFromCloud("x")).toBe(false);
  });
});
