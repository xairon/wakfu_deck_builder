import { describe, it, expect } from "vitest";
import { distinctExtensionCount, pickFeaturedDecks } from "@/utils/homeStats";
import type { OfficialDeck } from "@/data/officialDecks";

describe("homeStats", () => {
  it("distinctExtensionCount compte les extensions distinctes, ignore les vides", () => {
    const cards = [
      { extension: { name: "Incarnam" } },
      { extension: { name: "Incarnam" } },
      { extension: { name: "Astrub" } },
      {},
      { extension: {} },
    ];
    expect(distinctExtensionCount(cards)).toBe(2);
  });

  it("pickFeaturedDecks priorise les decks avec lore puis complète, longueur n", () => {
    const mk = (id: string, lore?: string): OfficialDeck => ({
      id,
      name: id,
      description: "",
      extension: "dofus-mag",
      hero: "H",
      havreSac: "HS",
      cards: [],
      ...(lore ? { lore } : {}),
    });
    const decks = [mk("a"), mk("b", "histoire"), mk("c"), mk("d", "récit")];
    const picked = pickFeaturedDecks(decks, 3);
    expect(picked).toHaveLength(3);
    expect(picked.slice(0, 2).map((d) => d.id)).toEqual(["b", "d"]);
  });
});
