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
  toggleDeckUpvote,
  getUserUpvotedDeckIds,
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

  it("publishDeck upsert un snapshot sur onConflict 'deck_id,user_id'", async () => {
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
    expect(opts).toEqual({ onConflict: "deck_id,user_id" });
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

  it("loadPublicDecks trie par upvote_count desc puis updated_at desc", async () => {
    const limit = vi
      .fn()
      .mockResolvedValue({ data: [{ id: "p1" }], error: null });
    const order = vi.fn();
    order.mockReturnValue({ limit, order });
    const select = vi.fn(() => ({ order }));
    supabaseStub = { from: vi.fn(() => ({ select })) };

    const rows = await loadPublicDecks();

    expect(rows).toEqual([{ id: "p1" }]);
    expect(order).toHaveBeenCalledWith("upvote_count", { ascending: false });
    expect(order).toHaveBeenCalledWith("updated_at", { ascending: false });
  });

  it("toggleDeckUpvote appelle la RPC toggle_deck_upvote", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: { upvoted: true, upvoteCount: 1 }, error: null });
    supabaseStub = { rpc };

    const res = await toggleDeckUpvote("deck-1");
    expect(res).toEqual({ upvoted: true, upvoteCount: 1 });
    expect(rpc).toHaveBeenCalledWith("toggle_deck_upvote", { p_deck_id: "deck-1" });
  });

  it("getUserUpvotedDeckIds renvoie un Set des deck_id votés", async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [{ deck_id: "deck-1" }, { deck_id: "deck-2" }],
      error: null,
    });
    const select = vi.fn(() => ({ eq }));
    supabaseStub = { from: vi.fn(() => ({ select })) };

    const ids = await getUserUpvotedDeckIds();
    expect(ids.has("deck-1")).toBe(true);
    expect(ids.has("deck-2")).toBe(true);
    expect(ids.size).toBe(2);
  });
});
