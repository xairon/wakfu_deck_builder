import { describe, it, expect } from "vitest";
import { buildGalleryGroups } from "@/components/deck/deckGallery";
import type { DeckCard } from "@/types/cards";

function dc(
  name: string,
  mainType: string,
  pa: number,
  quantity = 1,
): DeckCard {
  return {
    card: { id: name, name, mainType, stats: { pa } },
    quantity,
    isReserve: false,
  } as DeckCard;
}

describe("buildGalleryGroups", () => {
  it("renvoie [] pour un deck vide", () => {
    expect(buildGalleryGroups([], "type")).toEqual([]);
  });

  it("mode type : un groupe par mainType, ordonné par effectif décroissant", () => {
    const cards = [
      dc("A", "Action", 2, 1),
      dc("B", "Allié", 1, 3),
      dc("C", "Allié", 3, 2),
    ];
    const groups = buildGalleryGroups(cards, "type");
    expect(groups.map((g) => g.section)).toEqual(["Allié", "Action"]); // 5 vs 1
    expect(groups[0].total).toBe(5);
    expect(groups[0].entries.map((e) => e.name)).toEqual(["B", "C"]); // tri PA croissant
  });

  it("mode cost : un seul groupe « Cartes du deck » trié par PA croissant", () => {
    const cards = [dc("A", "Action", 3), dc("B", "Allié", 1)];
    const groups = buildGalleryGroups(cards, "cost");
    expect(groups).toHaveLength(1);
    expect(groups[0].section).toBe("Cartes du deck");
    expect(groups[0].entries.map((e) => e.name)).toEqual(["B", "A"]);
  });

  it("mode name : un seul groupe trié par nom", () => {
    const cards = [dc("Zelda", "Action", 1), dc("Arthur", "Allié", 1)];
    const groups = buildGalleryGroups(cards, "name");
    expect(groups[0].entries.map((e) => e.name)).toEqual(["Arthur", "Zelda"]);
  });
});
