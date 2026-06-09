import { describe, it, expect } from "vitest";
import { deckToCloud, cloudToDeck } from "@/services/cloudSync";

function card(id: string, name = id) {
  return { id, name, mainType: "Allié" } as any;
}

describe("cloudSync — conversion Deck <-> CloudDeck", () => {
  it("deckToCloud sérialise héros, havre-sac, cartes et réserve", () => {
    const deck = {
      id: "d1",
      name: "Mono Feu",
      hero: card("hero1"),
      havreSac: card("hs1"),
      cards: [
        { card: card("c1"), quantity: 3 },
        { card: card("c2"), quantity: 1 },
      ],
      reserve: [{ card: card("r1"), quantity: 2 }],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    } as any;

    const cloud = deckToCloud(deck, "user-42");

    expect(cloud.id).toBe("d1");
    expect(cloud.user_id).toBe("user-42");
    expect(cloud.name).toBe("Mono Feu");
    expect(cloud.hero_id).toBe("hero1");
    expect(cloud.havre_sac_id).toBe("hs1");
    expect(cloud.cards).toEqual([
      { cardId: "c1", quantity: 3 },
      { cardId: "c2", quantity: 1 },
      { cardId: "r1", quantity: 2, isReserve: true },
    ]);
  });

  it("deckToCloud gère héros/havre-sac absents", () => {
    const deck = {
      id: "d2",
      name: "WIP",
      hero: null,
      havreSac: null,
      cards: [],
      reserve: [],
      createdAt: "x",
      updatedAt: "y",
    } as any;
    const cloud = deckToCloud(deck, "u");
    expect(cloud.hero_id).toBeNull();
    expect(cloud.havre_sac_id).toBeNull();
    expect(cloud.cards).toEqual([]);
  });

  it("cloudToDeck reconstruit le deck et résout les cartes", () => {
    const catalog: Record<string, any> = {
      hero1: card("hero1"),
      hs1: card("hs1"),
      c1: card("c1"),
      r1: card("r1"),
    };
    const cloud = {
      id: "d1",
      user_id: "u",
      name: "Mono Feu",
      hero_id: "hero1",
      havre_sac_id: "hs1",
      cards: [
        { cardId: "c1", quantity: 3 },
        { cardId: "r1", quantity: 2, isReserve: true },
      ],
      created_at: "a",
      updated_at: "b",
    } as any;

    const deck = cloudToDeck(cloud, (id) => catalog[id]);

    expect(deck.id).toBe("d1");
    expect(deck.hero?.id).toBe("hero1");
    expect(deck.havreSac?.id).toBe("hs1");
    // Modèle réel : la réserve vit dans `cards` avec isReserve:true.
    expect(deck.cards).toHaveLength(2);
    expect(deck.cards[0]).toEqual({ card: catalog.c1, quantity: 3 });
    expect(deck.cards[1]).toEqual({
      card: catalog.r1,
      quantity: 2,
      isReserve: true,
    });
    expect(deck.reserve).toHaveLength(0);
  });

  it("cloudToDeck ignore les cartes introuvables dans le catalogue", () => {
    const cloud = {
      id: "d3",
      user_id: "u",
      name: "Deck",
      hero_id: "unknown-hero",
      havre_sac_id: null,
      cards: [
        { cardId: "known", quantity: 1 },
        { cardId: "missing", quantity: 2 },
      ],
      created_at: "a",
      updated_at: "b",
    } as any;
    const deck = cloudToDeck(cloud, (id) =>
      id === "known" ? card("known") : undefined,
    );
    expect(deck.hero).toBeNull(); // héros introuvable
    expect(deck.cards).toHaveLength(1);
    expect(deck.cards[0].card.id).toBe("known");
  });

  it("aller-retour deckToCloud -> cloudToDeck préserve la structure", () => {
    const catalog: Record<string, any> = {
      h: card("h"),
      s: card("s"),
      a: card("a"),
      b: card("b"),
    };
    const deck = {
      id: "rt",
      name: "RT",
      hero: catalog.h,
      havreSac: catalog.s,
      cards: [{ card: catalog.a, quantity: 2 }],
      reserve: [{ card: catalog.b, quantity: 1 }],
      createdAt: "c",
      updatedAt: "d",
    } as any;

    const back = cloudToDeck(deckToCloud(deck, "u"), (id) => catalog[id]);
    expect(back.hero?.id).toBe("h");
    expect(back.havreSac?.id).toBe("s");
    // La réserve (b) revient dans `cards` avec isReserve:true (modèle réel).
    expect(back.cards).toEqual([
      { card: catalog.a, quantity: 2 },
      { card: catalog.b, quantity: 1, isReserve: true },
    ]);
    expect(back.reserve).toEqual([]);
  });
});
