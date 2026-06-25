import { describe, it, expect } from "vitest";
import {
  norm,
  buildNameIndex,
  classifyDeck,
} from "../../scripts/lib/dofusMagMatch";
import type { OfficialDeck } from "@/data/officialDecks";

describe("dofusMagMatch", () => {
  it("norm enlève accents/casse/espaces", () => {
    expect(norm("  Brisé ! ")).toBe("brise !");
    expect(norm("Klore  Ofil")).toBe("klore ofil");
  });

  it("buildNameIndex indexe par nom normalisé", () => {
    const idx = buildNameIndex([
      { name: "Klore Ofil", extension: { name: "Incarnam" } },
      { name: "Smare", extension: { name: "Incarnam" } },
    ]);
    expect(idx.has("klore ofil")).toBe(true);
    expect(idx.get("smare")?.[0].extension.name).toBe("Incarnam");
  });

  it("classifyDeck sépare résolus et non résolus", () => {
    const idx = buildNameIndex([
      { name: "Smare", extension: { name: "Incarnam" } },
    ]);
    const deck = {
      id: "d",
      name: "D",
      description: "",
      extension: "dofus-mag",
      hero: "Smare",
      havreSac: "Inconnu HS",
      cards: [
        { name: "Smare", quantity: 2, type: "card" },
        { name: "Carte Fantôme", quantity: 1, type: "card" },
      ],
    } as OfficialDeck;
    const r = classifyDeck(deck, idx);
    expect(r.resolved).toContain("Smare");
    expect(r.unresolved).toContain("Carte Fantôme");
    expect(r.unresolved).toContain("Inconnu HS");
  });
});
