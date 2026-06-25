import { describe, it, expect } from "vitest";
import { cardElement, cardPaLabel, cardSpineColor } from "@/utils/cardDisplay";
import { elementColors } from "@/config/elementColors";
import type { Card } from "@/types/cards";

const fire = {
  id: "x",
  name: "X",
  mainType: "Action",
  stats: { pa: 3, niveau: { value: 1, element: "Feu" } },
} as Card;
const neutral = { id: "y", name: "Y", mainType: "Action" } as Card;

describe("cardDisplay", () => {
  it("cardElement renvoie l'élément en minuscule, repli neutre", () => {
    expect(cardElement(fire)).toBe("feu");
    expect(cardElement(neutral)).toBe("neutre");
  });

  it("cardPaLabel formate « PA · Élément », ou l'élément seul sans PA", () => {
    expect(cardPaLabel(fire)).toBe("3 PA · Feu");
    expect(cardPaLabel(neutral)).toBe("Neutre");
  });

  it("cardSpineColor mappe sur la couleur d'élément", () => {
    expect(cardSpineColor(fire)).toBe(elementColors.feu);
    expect(cardSpineColor(neutral)).toBe(elementColors.neutre);
  });
});
