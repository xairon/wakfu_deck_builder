import { describe, it, expect } from "vitest";
import { isUniqueCard, maxCopiesForCard } from "@/utils/cardRules";
import type { Card } from "@/types/cards";

function card(partial: Partial<Card>): Card {
  return {
    id: "x",
    name: "X",
    mainType: "Allié",
    subTypes: [],
    ...partial,
  } as Card;
}

describe("isUniqueCard", () => {
  it("détecte Unique dans subTypes (format réel des données)", () => {
    expect(isUniqueCard(card({ subTypes: ["Roi", "Unique"] }))).toBe(true);
  });

  it("détecte Unique dans keywords (sécurité)", () => {
    expect(
      isUniqueCard(card({ keywords: [{ name: "Unique" } as never] })),
    ).toBe(true);
  });

  it("retourne false pour une carte normale", () => {
    expect(isUniqueCard(card({ subTypes: ["Monstre"] }))).toBe(false);
  });

  it("gère subTypes/keywords absents", () => {
    expect(
      isUniqueCard({ id: "y", name: "Y", mainType: "Action" } as Card),
    ).toBe(false);
  });
});

describe("maxCopiesForCard", () => {
  it("limite à 1 une carte Unique", () => {
    expect(maxCopiesForCard(card({ subTypes: ["Unique"] }))).toBe(1);
  });

  it("autorise 3 (défaut) pour une carte normale", () => {
    expect(maxCopiesForCard(card({ subTypes: [] }))).toBe(3);
  });

  it("respecte un défaut personnalisé", () => {
    expect(maxCopiesForCard(card({ subTypes: [] }), 2)).toBe(2);
  });
});
