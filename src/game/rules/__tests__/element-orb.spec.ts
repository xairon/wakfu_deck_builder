/**
 * ÉLÉMENT ORB (« Élément : [X] ») — les Actions/Équipements/Zones/Salles/Dofus/
 * Protecteurs/Havre-Sacs portent leur Élément dans un champ dédié `card.element`
 * (l'orbe « en haut à droite »), distinct du Niveau (souvent Neutre = coût libre)
 * et de la Force (absente sur ces types). Cet Élément imprimé doit primer sur le
 * Niveau pour la production de Ressource, l'Élément de Dommages et les filtres.
 *
 * Régression du bug rapporté : ces cartes étaient stockées Neutre (l'orbe était
 * ignoré au scrape) → production Neutre + introuvables par couleur.
 */
import { describe, it, expect } from "vitest";
import type { EquipmentCard, ActionCard } from "@/types/cards";
import { producedElement, resourceElement } from "../cardAttrs";
import {
  createMockEquipmentCard,
  createMockActionCard,
} from "tests/factories/card";

/** Équipement à orbe Terre, Niveau Neutre, sans Force (cas « Alliance de Silimelle »). */
function terreEquip(): EquipmentCard {
  return createMockEquipmentCard({
    stats: { niveau: { value: 3, element: "Neutre" } },
    element: "Terre",
  });
}

describe("producedElement — l'orbe `element` prime sur le Niveau", () => {
  it("Équipement à orbe Terre + Niveau Neutre → Élément imprimé = terre", () => {
    expect(producedElement(terreEquip())).toBe("terre");
  });

  it("resourceElement (sans override producesElement) suit l'orbe → terre", () => {
    expect(resourceElement(terreEquip())).toBe("terre");
  });

  it("Action à orbe Eau + Niveau Neutre → eau (Dommages / filtres de pile)", () => {
    const action: ActionCard = createMockActionCard({
      stats: { niveau: { value: 1, element: "Neutre" } },
      element: "Eau",
    });
    expect(producedElement(action)).toBe("eau");
  });

  it("carte sans orbe conserve le repli Force puis Niveau", () => {
    const forceAction = createMockActionCard({
      stats: {
        niveau: { value: 1, element: "Neutre" },
        force: { value: 1, element: "Feu" },
      },
    });
    expect(producedElement(forceAction)).toBe("feu");
  });

  it("orbe Neutre explicite reste neutre (backfill de cohérence)", () => {
    const neutre = createMockEquipmentCard({
      stats: { niveau: { value: 2, element: "Neutre" } },
      element: "Neutre",
    });
    expect(producedElement(neutre)).toBe("neutre");
  });
});
