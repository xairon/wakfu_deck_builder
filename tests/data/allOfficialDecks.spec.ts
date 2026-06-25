import { describe, it, expect } from "vitest";
import {
  ALL_OFFICIAL_DECKS,
  getOfficialDeckById,
  resolveDeckCardGroups,
} from "@/data/allOfficialDecks";
import type { Card } from "@/types/cards";

describe("allOfficialDecks", () => {
  it("fusionne starters + dofus-mag", () => {
    const exts = new Set(ALL_OFFICIAL_DECKS.map((d) => d.extension));
    expect(exts.has("incarnam")).toBe(true);
    expect(exts.has("dofus-mag")).toBe(true);
  });

  it("getOfficialDeckById trouve / renvoie undefined", () => {
    const first = ALL_OFFICIAL_DECKS[0];
    expect(getOfficialDeckById(first.id)?.id).toBe(first.id);
    expect(getOfficialDeckById("nope-xyz")).toBeUndefined();
  });

  it("resolveDeckCardGroups groupe par section, ordonne, compte, résout", () => {
    const fakeResolve = (name: string): Card | null =>
      name === "Carte A"
        ? ({ id: "a", name, mainType: "Allié" } as Card)
        : null;
    const deck = {
      id: "x",
      name: "X",
      description: "",
      extension: "dofus-mag",
      hero: "H",
      havreSac: "HS",
      cards: [
        { name: "Zone Z", quantity: 1, type: "card", section: "Zones" },
        { name: "Carte A", quantity: 3, type: "card", section: "Alliés" },
        { name: "Carte B", quantity: 2, type: "card", section: "Alliés" },
      ],
    } as const;
    const groups = resolveDeckCardGroups(deck, fakeResolve);
    expect(groups.map((g) => g.section)).toEqual(["Alliés", "Zones"]);
    expect(groups[0].total).toBe(5);
    expect(groups[0].entries[0]).toMatchObject({
      name: "Carte A",
      quantity: 3,
    });
    expect(groups[0].entries[0].card?.id).toBe("a");
    expect(groups[0].entries[1].card).toBeNull();
  });
});
