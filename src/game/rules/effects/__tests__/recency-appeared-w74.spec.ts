/**
 * Vague W74 — RÉCENCE D'APPARITION « … qui vient d'apparaître » : marqueur
 * `justAppeared` (jeton TURN-scoped posé à chaque entrée en jeu d'un permanent,
 * RÉINITIALISÉ à chaque nouvelle apparition — seule la PLUS RÉCENTE le porte,
 * miroir du patron `justInclined` W71) + flag de filtre `recentlyAppeared` sur
 * les ops de ciblage. Cartes : Homar Chérif (tapTarget), Potion d'Agression
 * (coût payé + actor-bind damageTargetByForce).
 */
import { describe, it, expect } from "vitest";
import { compileTapEffectText } from "../dsl";

describe("recentlyAppeared — DSL", () => {
  it("Homar Chérif : « Inclinez l'Allié de votre choix qui vient d'apparaître. » (pouvoir)", () => {
    const c = compileTapEffectText(
      "Inclinez l'Allié de votre choix qui vient d'apparaître.",
      "Homar Chérif",
      undefined,
      false,
      true,
    );
    expect(c).toEqual({
      trigger: "onTap",
      ops: [
        {
          op: "tapTarget",
          recentlyAppeared: true,
          zones: ["monde"],
        },
      ],
    });
  });

  it("Potion d'Agression : coût payé + actor-bind « Il inflige sa Force … qui vient d'apparaître »", () => {
    const c = compileTapEffectText(
      "Inclinez un de vos Alliés ou Héros : Il inflige sa Force en Dommages à l'Allié de votre choix qui vient d'apparaître.",
      "Potion d'Agression",
      "Neutre",
      true,
      false,
    );
    expect(c).toEqual({
      trigger: "onTap",
      cost: "paidOps",
      actor: "costTarget",
      ops: [
        {
          op: "costTapControlled",
          heroes: true,
          zones: ["monde", "havreSac"],
        },
        {
          op: "damageTargetByForce",
          element: "Neutre",
          recentlyAppeared: true,
          // Convention targetZones (W49) : sans clause de lieu, la cible par
          // Force est cherchée dans les deux zones de jeu.
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("« … vient d'apparaître DEPUIS VOTRE DÉFAUSSE » (provenance) → manuel", () => {
    // Échappé des Glaces : la PROVENANCE de l'apparition (Défausse) n'est pas
    // modélisée par le marqueur → doit rester manuel (jamais approximer).
    expect(
      compileTapEffectText(
        "Inclinez l'Allié de votre choix qui vient d'apparaître depuis votre Défausse.",
        "X de Test",
        undefined,
        false,
        true,
      ),
    ).toBeNull();
  });
});
