import { describe, it, expect } from "vitest";
import { buildOfficialDeck } from "@/composables/useOfficialDeckImport";
import type { Card } from "@/types/cards";
import type { OfficialDeck } from "@/data/officialDecks";

const card = (id: string, name: string, mainType = "Allié"): Card =>
  ({ id, name, mainType }) as Card;

const deck: OfficialDeck = {
  id: "d",
  name: "D",
  description: "desc",
  extension: "dofus-mag",
  hero: "Héros X",
  havreSac: "Havre Sac Y",
  cards: [
    { name: "Carte A", quantity: 2, type: "card" },
    { name: "Fantôme", quantity: 1, type: "card" },
  ],
};

describe("buildOfficialDeck", () => {
  it("résout héros, havre-sac, cartes ; liste les manquants", () => {
    const db: Record<string, Card> = {
      "Héros X": card("h", "Héros X", "Héros"),
      "Havre Sac Y": card("hs", "Havre Sac Y", "Havre-Sac"),
      "Carte A": card("a", "Carte A"),
    };
    const r = buildOfficialDeck(deck, (n) => db[n] ?? null);
    expect(r.heroCard?.id).toBe("h");
    expect(r.havreSacCard?.id).toBe("hs");
    expect(r.deckCards).toHaveLength(1);
    expect(r.deckCards[0]).toMatchObject({ quantity: 2 });
    expect(r.missing).toEqual(["Fantôme"]);
    expect(r.heroMissing).toBe(false);
  });

  it("signale héros/havre-sac manquants", () => {
    const r = buildOfficialDeck(deck, () => null);
    expect(r.heroMissing).toBe(true);
    expect(r.havreMissing).toBe(true);
    expect(r.missing).toContain("Carte A");
  });
});
