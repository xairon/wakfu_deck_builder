import { describe, it, expect } from "vitest";
import { buildGalleryGroups } from "@/components/deck/deckGallery";
import type { DeckCard } from "@/types/cards";
import {
  createMockAllyCard,
  createMockActionCard,
  createMockEquipmentCard,
} from "tests/factories/card";

describe("deckGallery — buildGalleryGroups", () => {
  const c5 = {
    card: createMockAllyCard({
      name: "Allié Coût 5",
      stats: { niveau: { value: 5, element: "Neutre" } },
    }),
    quantity: 1,
  } as DeckCard;

  const c4 = {
    card: createMockAllyCard({
      name: "Allié Coût 4",
      stats: { niveau: { value: 4, element: "Neutre" } },
    }),
    quantity: 1,
  } as DeckCard;

  const c2 = {
    card: createMockAllyCard({
      name: "Allié Coût 2",
      stats: { niveau: { value: 2, element: "Neutre" } },
    }),
    quantity: 2,
  } as DeckCard;

  const c1 = {
    card: createMockActionCard({
      name: "Action Coût 1",
      stats: { niveau: { value: 1, element: "Neutre" } },
    }),
    quantity: 1,
  } as DeckCard;

  const c8 = {
    card: createMockEquipmentCard({
      name: "Équipement Coût 8",
      stats: { niveau: { value: 8, element: "Neutre" } },
    }),
    quantity: 1,
  } as DeckCard;

  it("trie par PA croissant avec le mode 'cost'", () => {
    // Ordre non trié fourni : 5, 4, 2, 1, 8
    const cards: DeckCard[] = [c5, c4, c2, c1, c8];
    const groups = buildGalleryGroups(cards, "cost");

    expect(groups).toHaveLength(1);
    expect(groups[0].section).toBe("Cartes du deck");
    expect(groups[0].total).toBe(6);

    const names = groups[0].entries.map((e) => e.name);
    expect(names).toEqual([
      "Action Coût 1",
      "Allié Coût 2",
      "Allié Coût 4",
      "Allié Coût 5",
      "Équipement Coût 8",
    ]);
  });

  it("trie par PA au sein de chaque groupe de type avec le mode 'type'", () => {
    const cards: DeckCard[] = [c5, c4, c2, c1, c8];
    const groups = buildGalleryGroups(cards, "type");

    // 3 groupes : Allié (total: 4), Action (total: 1), Équipement (total: 1)
    expect(groups).toHaveLength(3);

    const allyGroup = groups.find((g) => g.section === "Allié");
    expect(allyGroup).toBeDefined();
    expect(allyGroup!.entries.map((e) => e.name)).toEqual([
      "Allié Coût 2",
      "Allié Coût 4",
      "Allié Coût 5",
    ]);
  });

  it("trie par nom avec le mode 'name'", () => {
    const cards: DeckCard[] = [c5, c4, c2, c1, c8];
    const groups = buildGalleryGroups(cards, "name");

    expect(groups).toHaveLength(1);
    const names = groups[0].entries.map((e) => e.name);
    expect(names).toEqual([
      "Action Coût 1",
      "Allié Coût 2",
      "Allié Coût 4",
      "Allié Coût 5",
      "Équipement Coût 8",
    ]);
  });
});
