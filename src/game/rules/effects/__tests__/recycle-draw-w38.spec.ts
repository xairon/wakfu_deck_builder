/**
 * Vague W38 (deck-driven, starter Incarnam Parchemin de Chance) — corps
 * « Piochez le même nombre de cartes » lié au coût « Recyclez jusqu'à N … »
 * (draw fromCount, magnitude = nombre recyclé via frame.boundCount). Réutilise
 * costRecycle{max} existant. Le préfixe accepte l'INFINITIF « Recycler ».
 */
import { describe, it, expect } from "vitest";
import { compileTapEffectText } from "../dsl";

describe("DSL — « Recycler jusqu'à N : Piochez le même nombre » (draw fromCount)", () => {
  it("Parchemin de Chance → costRecycle{max, defausse} + draw{fromCount}", () => {
    const c = compileTapEffectText(
      "Recycler jusqu'à 3 cartes de votre Défausse : Piochez le même nombre de cartes.",
      "Parchemin de Chance",
      "Neutre",
      true, // Action → onPlay
    );
    expect(c?.cost).toBe("paidOps");
    expect(c?.trigger).toBe("onPlay");
    expect(c?.ops[0]).toEqual({
      op: "costRecycle",
      from: "defausse",
      n: 3,
      max: true,
    });
    expect(c?.ops[1]).toEqual({ op: "draw", n: 0, fromCount: true });
  });

  it("forme impérative « Recyclez … » reste reconnue", () => {
    const c = compileTapEffectText(
      "Recyclez jusqu'à 2 cartes de votre Défausse : Piochez le même nombre de cartes.",
      "Test",
      "Neutre",
      true,
    );
    expect(c?.ops[0]).toMatchObject({ op: "costRecycle", n: 2, max: true });
    expect(c?.ops[1]).toEqual({ op: "draw", n: 0, fromCount: true });
  });
});
