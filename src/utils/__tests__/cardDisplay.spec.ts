import { describe, it, expect } from "vitest";
import { cardElement } from "../cardDisplay";
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
