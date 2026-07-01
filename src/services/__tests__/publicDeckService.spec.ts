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
  publishDeck,
  unpublishDeck,
  loadPublicDecks,
  snapshotCards,
} from "@/services/publicDeckService";
import type { Deck } from "@/types/cards";

function card(id: string) {
  return { id, name: id, mainType: "Allié" } as any;
}

const deck = {
  id: "deck-1",
  name: "Mono Feu",
  hero: card("hero-1"),
  havreSac: card("hs-1"),
  cards: [
    { card: card("c1"), quantity: 3 },
    { card: card("r1"), quantity: 2, isReserve: true },
  ],
  createdAt: "a",
  updatedAt: "b",
} as unknown as Deck;

describe("publicDeckService", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    supabaseStub = null;
  });

  it("snapshotCards inclut la réserve avec son drapeau", () => {
    expect(snapshotCards(deck)).toEqual([
      { cardId: "c1", quantity: 3 },
      { cardId: "r1", quantity: 2, isReserve: true },
    ]);
  });

  it("publishDeck upsert un snapshot sur onConflict 'deck_id'", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    supabaseStub = { from: vi.fn(() => ({ upsert })) };

    const ok = await publishDeck(deck, {
      source: "Création",
      tagline: "Rapide",
      guide: "",
    });

    expect(ok).toBe(true);
    expect(supabaseStub.from).toHaveBeenCalledWith("deck_publications");
    const [row, opts] = upsert.mock.calls[0];
    expect(opts).toEqual({ onConflict: "deck_id" });
    expect(row).toMatchObject({
      deck_id: "deck-1",
      user_id: "user-1",
      name: "Mono Feu",
      hero_id: "hero-1",
      havre_sac_id: "hs-1",
      source: "Création",
      tagline: "Rapide",
      guide: null, // vide → null
    });
    // Le snapshot embarque la réserve.
    expect(row.cards).toEqual([
      { cardId: "c1", quantity: 3 },
      { cardId: "r1", quantity: 2, isReserve: true },
    ]);
  });

  it("unpublishDeck supprime la ligne par deck_id", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const del = vi.fn(() => ({ eq }));
    supabaseStub = { from: vi.fn(() => ({ delete: del })) };

    const ok = await unpublishDeck("deck-1");

    expect(ok).toBe(true);
    expect(supabaseStub.from).toHaveBeenCalledWith("deck_publications");
    expect(eq).toHaveBeenCalledWith("deck_id", "deck-1");
  });

  it("loadPublicDecks retourne [] si Supabase non configuré", async () => {
    supabaseStub = null;
    expect(await loadPublicDecks()).toEqual([]);
  });

  it("loadPublicDecks trie par updated_at desc", async () => {
    const limit = vi
      .fn()
      .mockResolvedValue({ data: [{ id: "p1" }], error: null });
    const order = vi.fn(() => ({ limit }));
    const select = vi.fn(() => ({ order }));
    supabaseStub = { from: vi.fn(() => ({ select })) };

    const rows = await loadPublicDecks();

    expect(rows).toEqual([{ id: "p1" }]);
    expect(order).toHaveBeenCalledWith("updated_at", { ascending: false });
  });
});
