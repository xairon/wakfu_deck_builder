/**
 * Vague « COMPOSÉS FORCE + MOT-CLÉ » (Volet B — textes récupérés du scrape) :
 * « … gagne +N en Force et <Mot-clé> jusqu'à la fin du tour » s'applique à la
 * MÊME cible — modélisé par UN op (`alsoKeyword` sur buffForceTarget /
 * buffForceSelf), la résolution posant les DEUX jetons TURN-scoped (forceMod +
 * <kw>TurnMod) sur la créature. Pas d'actor-binding : un seul op, une cible.
 * Cartes : Blops Royaux ×3 (pouvoir [Incliner],[Terre]), Kabrok (onArrive,
 * « le Monstre de votre choix »), Yokaï Firefoux (self, [Incliner]).
 */
import { describe, it, expect } from "vitest";
import { compileEffectText, compileTapEffectText } from "../dsl";

describe("composé Force+Mot-clé — DSL", () => {
  it("Blop Royal (corps de pouvoir) : « L'Allié ou Héros de votre choix gagne +2 en Force et Géant … »", () => {
    const c = compileTapEffectText(
      "[Incliner], [Terre] : L'Allié ou Héros de votre choix gagne +2 en Force et Géant jusqu'à la fin du tour.",
      "Blop Coco Royal",
      undefined,
      false,
      true,
    );
    expect(c).toEqual({
      trigger: "onTap",
      // « [Incliner], [Terre] : » — l'[Incliner] textuel est l'inclinaison par
      // défaut du pouvoir (flag) ; [Terre] = coût de Ressource payé en tête,
      // tapsSource (généralisation DSL du script Yomtella).
      cost: "paidOps",
      tapsSource: true,
      ops: [
        { op: "costTapResource", element: "Terre" },
        {
          op: "buffForceTarget",
          n: 2,
          heroes: true,
          alsoKeyword: "Géant",
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("Kabrok (onArrive) : « le Monstre de votre choix gagne +1 en Force et Agressivité … »", () => {
    const c = compileEffectText(
      "Quand Kabrok apparaît, le Monstre de votre choix gagne +1 en Force et Agressivité jusqu'à la fin du tour.",
      "Kabrok",
    );
    expect(c).toEqual({
      trigger: "onArrive",
      ops: [
        {
          op: "buffForceTarget",
          n: 1,
          heroes: false,
          sub: "monstre",
          alsoKeyword: "Agressivité",
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("Yokaï Firefoux (self) : « Le Yokaï Firefoux gagne +2 en Force et Géant … »", () => {
    const c = compileTapEffectText(
      "[Incliner] : Le Yokaï Firefoux gagne +2 en Force et Géant jusqu'à la fin du tour.",
      "Yokaï Firefoux",
      undefined,
      false,
      true,
    );
    expect(c).toMatchObject({
      trigger: "onTap",
      ops: expect.arrayContaining([
        expect.objectContaining({
          op: "buffForceSelf",
          n: 2,
          alsoKeyword: "Géant",
        }),
      ]),
    });
  });

  it("mot-clé NON câblé (« et Fantôme ») → manuel", () => {
    expect(
      compileEffectText(
        "Quand Kabrok apparaît, le Monstre de votre choix gagne +1 en Force et Fantôme jusqu'à la fin du tour.",
        "Kabrok",
      ),
    ).toBeNull();
  });
});
