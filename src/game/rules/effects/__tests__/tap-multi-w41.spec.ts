/**
 * Vague W41 (deck-driven, starters Incarnam) — INCLINAISON / REDRESSEMENT
 * MULTI-CIBLES À COMPTE LIÉ (« Inclinez / Redressez LE MÊME NOMBRE d'Alliés ou
 * Héros de votre choix ») : ops tapMultiTarget / untapMultiTarget, ciblage
 * répété borné dont le nombre = compte lié à la frame (fromCount → boundCount).
 * Débloque, sur UN sous-système : choc-temporel (coût de défausse) ET
 * parchemin-d-agilite (coût de recyclage).
 */
import { describe, it, expect } from "vitest";
import { compileTapEffectText } from "../dsl";

describe("DSL — Inclinez/Redressez le même nombre (tap/untap multi fromCount)", () => {
  it("Choc Temporel (défausse) → costDiscard{max} + tapMultiTarget{fromCount}", () => {
    const c = compileTapEffectText(
      "Défaussez jusqu'à 3 cartes : Inclinez le même nombre d'Alliés ou Héros de votre choix, dans l'ordre de votre choix.",
      "Choc Temporel",
      "Neutre",
      true,
    );
    expect(c?.ops[0]).toEqual({ op: "costDiscard", n: 3, max: true });
    expect(c?.ops[1]).toEqual({
      op: "tapMultiTarget",
      heroes: true,
      fromCount: true,
      zones: ["monde", "havreSac"],
    });
  });

  it("Parchemin d'Agilité (recyclage) → costRecycle{max} + untapMultiTarget{fromCount}", () => {
    const c = compileTapEffectText(
      "Recyclez jusqu'à 3 cartes de votre Défausse : Redressez le même nombre d'Alliés ou Héros de votre choix.",
      "Parchemin d'Agilité",
      "Neutre",
      true,
    );
    expect(c?.ops[0]).toMatchObject({ op: "costRecycle", n: 3, max: true });
    expect(c?.ops[1]).toEqual({
      op: "untapMultiTarget",
      heroes: true,
      fromCount: true,
      zones: ["monde", "havreSac"],
    });
  });
});
