/**
 * Vague « BUFF MULTI-CIBLES BORNÉ » (Volet B) : « Choisissez jusqu'à N de vos
 * Alliés ou Héros <Sub> : Ils gagnent +N en Force [et <Mot-clé>] jusqu'à la fin
 * du tour » → op `buffForceMultiTarget` : ciblage RÉPÉTÉ (machinerie multi de
 * damageMultiTarget/tapMultiTarget), chaque cible choisie reçoit forceMod
 * (+ <kw>TurnMod via alsoKeyword) ; « jusqu'à » = effectTargetSkip clôt.
 * Cartes : Attaque Bontarienne (Bonta, Agilité), Attaque Brâkmarienne
 * (Brâkmar, Géant — coquille « Allié » singulier tolérée).
 */
import { describe, it, expect } from "vitest";
import { compileActionEffectText } from "../dsl";

describe("buffForceMultiTarget — DSL", () => {
  it("Attaque Bontarienne : jusqu'à trois Alliés ou Héros Bonta, +1 Force et Agilité", () => {
    const c = compileActionEffectText(
      "Choisissez jusqu'à trois de vos Alliés ou Héros Bonta : Ils gagnent +1 en Force et Agilité jusqu'à la fin du tour.",
      "Attaque Bontarienne",
    );
    expect(c).toEqual({
      trigger: "onPlay",
      ops: [
        {
          op: "buffForceMultiTarget",
          n: 1,
          alsoKeyword: "Agilité",
          count: 3,
          heroes: true,
          sub: "bonta",
          controller: "self",
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("Attaque Brâkmarienne : coquille « Allié » singulier tolérée, Géant", () => {
    const c = compileActionEffectText(
      "Choisissez jusqu'à trois de vos Allié ou Héros Brâkmar : Ils gagnent +1 en Force et Géant jusqu'à la fin du tour.",
      "Attaque Brâkmarienne",
    );
    expect(c).toEqual({
      trigger: "onPlay",
      ops: [
        {
          op: "buffForceMultiTarget",
          n: 1,
          alsoKeyword: "Géant",
          count: 3,
          heroes: true,
          sub: "brakmar",
          controller: "self",
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("mot-clé non câblé / mot de liaison en position Sub → manuel", () => {
    // Mot-clé hors GRANTABLE_KEYWORDS → manuel (octroi no-op = approximation).
    expect(
      compileActionEffectText(
        "Choisissez jusqu'à trois de vos Alliés ou Héros Bonta : Ils gagnent +1 en Force et Fantôme jusqu'à la fin du tour.",
        "X",
      ),
    ).toBeNull();
    // Mot de liaison capturé comme pseudo-Famille → manuel (garde anti-faux-positif).
    expect(
      compileActionEffectText(
        "Choisissez jusqu'à trois de vos Alliés ou Héros de : Ils gagnent +1 en Force et Géant jusqu'à la fin du tour.",
        "X",
      ),
    ).toBeNull();
  });
});
