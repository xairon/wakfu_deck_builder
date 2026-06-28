/**
 * Tranche « harvest-final » — phrasing DSL « Détruisez X, Y ou Z de votre choix »
 * (destruction multi-type à TROIS compléments, jumeau de la forme returnToHand
 * « Renvoyez X, Y ou Z … »). Couvre le parseur (forme positive + négatifs :
 * doublon de type, deux types seulement → autre branche). « Une approximation
 * vaut moins qu'un effet manuel » — seule la forme exacte est compilée.
 */
import { describe, it, expect } from "vitest";
import { compileActionEffectText } from "@/game/rules";

function ops(text: string) {
  return compileActionEffectText(text, "Test")?.ops ?? null;
}

describe("DSL — Détruisez X, Y ou Z (destroyTarget 3-type)", () => {
  it("compile « l'Allié, la Zone ou l'Équipement de votre choix dans le Monde »", () => {
    expect(
      ops(
        "Détruisez l'Allié, la Zone ou l'Équipement de votre choix dans le Monde.",
      ),
    ).toEqual([
      {
        op: "destroyTarget",
        whatAny: ["Allié", "Zone", "Équipement"],
        zones: ["monde"],
      },
    ]);
  });

  it("compile l'ordre Équipement, Zone ou Dofus (zone Monde par défaut)", () => {
    expect(
      ops("Détruisez l'Équipement, la Zone ou le Dofus de votre choix."),
    ).toEqual([
      {
        op: "destroyTarget",
        whatAny: ["Équipement", "Zone", "Dofus"],
        zones: ["monde"],
      },
    ]);
  });

  it("étend aux Havres-Sacs avec « ou dans un Havre-Sac »", () => {
    expect(
      ops(
        "Détruisez l'Allié, la Zone ou l'Équipement de votre choix dans le Monde ou dans un Havre-Sac.",
      ),
    ).toEqual([
      {
        op: "destroyTarget",
        whatAny: ["Allié", "Zone", "Équipement"],
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("rejette un type dupliqué (« l'Allié, l'Allié ou la Zone »)", () => {
    expect(
      ops("Détruisez l'Allié, l'Allié ou la Zone de votre choix."),
    ).toBeNull();
  });
});
