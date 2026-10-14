import { describe, it, expect } from "vitest";
import { cardElement, cardCost, cardPaLabel } from "../cardDisplay";
import {
  createMockEquipmentCard,
  createMockActionCard,
  createMockAllyCard,
} from "tests/factories/card";

describe("cardDisplay — cardElement (Élément dominant)", () => {
  it("orbe `element` prime sur un Niveau Neutre (Équipement coloré)", () => {
    const equip = createMockEquipmentCard({
      stats: { niveau: { value: 3, element: "Neutre" } },
      element: "Terre",
    });
    expect(cardElement(equip)).toBe("terre");
  });

  it("Action à Niveau Neutre + Force colorée → suit la Force (pas le Niveau)", () => {
    // Régression du bug `niveau || force` : "Neutre" étant truthy, l'ancienne
    // priorité renvoyait toujours neutre pour ces 12 Actions.
    const action = createMockActionCard({
      stats: {
        niveau: { value: 1, element: "Neutre" },
        force: { value: 1, element: "Feu" },
      },
    });
    expect(cardElement(action)).toBe("feu");
  });

  it("Allié coloré (Niveau = Force) inchangé", () => {
    const ally = createMockAllyCard({
      stats: {
        niveau: { value: 1, element: "Eau" },
        force: { value: 2, element: "Eau" },
      },
    });
    expect(cardElement(ally)).toBe("eau");
  });

  it("carte réellement Neutre → neutre", () => {
    const neutre = createMockActionCard({
      stats: { niveau: { value: 0, element: "Neutre" } },
    });
    expect(cardElement(neutre)).toBe("neutre");
  });
});

describe("cardDisplay — cardCost & cardPaLabel", () => {
  it("cardCost résout le niveau (PA) d'une carte standard", () => {
    const ally = createMockAllyCard({
      stats: {
        niveau: { value: 4, element: "Terre" },
        force: { value: 3, element: "Terre" },
      },
    });
    expect(cardCost(ally)).toBe(4);
  });

  it("cardCost résout stats.niveau en priorité même si stats.pa est présent (équipement donnant des PA)", () => {
    // Un équipement comme le Gelano (Niveau 3, PA +1) coûte 3 PA à jouer, pas 1 PA
    const equipment = createMockEquipmentCard({
      stats: {
        niveau: { value: 3, element: "Neutre" },
        pa: 1,
      },
    });
    expect(cardCost(equipment)).toBe(3);
    expect(cardPaLabel(equipment)).toBe("3 PA · Neutre");
  });

  it("cardCost résout stats.pa en repli si niveau absent", () => {
    const card = createMockActionCard({
      stats: {
        pa: 6,
      },
    });
    expect(cardCost(card)).toBe(6);
    expect(cardPaLabel(card)).toBe("6 PA · Neutre");
  });

  it("cardCost renvoie 0 si aucun coût n'est défini", () => {
    const card = createMockActionCard({});
    expect(cardCost(card)).toBe(0);
    expect(cardCost(null)).toBe(0);
    expect(cardCost(undefined)).toBe(0);
  });

  it("cardPaLabel formate le coût en PA et l'élément", () => {
    const ally = createMockAllyCard({
      stats: {
        niveau: { value: 5, element: "Air" },
      },
    });
    expect(cardPaLabel(ally)).toBe("5 PA · Air");
  });
});
