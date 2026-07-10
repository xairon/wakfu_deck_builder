/**
 * Vague « POUVOIR-MAIN À AUTO-DÉFAUSSE » (Volet B — Champas ×4, Bonta-Brâkmar) :
 * « [Élément], Défaussez le <Nom> de votre main : L'Allié ou Héros de votre
 * choix gagne +1 en Force et <Mot-clé> jusqu'à la fin du tour. » → pouvoir
 * activable depuis la MAIN (trigger onHandActivate, machinerie W66), coût payé
 * = incliner un producteur de l'Élément (costTapResource) PUIS se défausser
 * soi-même (NOUVEL op costDiscardSelf). STRICT : le nom défaussé doit être la
 * carte ELLE-MÊME (sinon manuel).
 */
import { describe, it, expect } from "vitest";
import { compileTapEffectText, isHandDiscardCostText } from "../dsl";

describe("costDiscardSelf / pouvoir-main Champa — DSL", () => {
  it("Champa Bleu : [Eau] + auto-défausse → onHandActivate paidOps", () => {
    const c = compileTapEffectText(
      "[Eau], Défaussez le Champa Bleu de votre main : l'Allié ou Héros de votre choix gagne +1 en Force et Tacle jusqu'à la fin du tour.",
      "Champa Bleu",
      undefined,
      false,
      false,
    );
    expect(c).toEqual({
      trigger: "onHandActivate",
      cost: "paidOps",
      ops: [
        { op: "costTapResource", element: "Eau" },
        { op: "costDiscardSelf" },
        {
          op: "buffForceTarget",
          n: 1,
          heroes: true,
          alsoKeyword: "Tacle",
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("Champa Marron : préfixe long (>40 car.) + Agilité", () => {
    const c = compileTapEffectText(
      "[Air], Défaussez le Champa Marron de votre main : L'Allié ou Héros de votre choix gagne +1 en Force et Agilité jusqu'à la fin du tour.",
      "Champa Marron",
      undefined,
      false,
      false,
    );
    expect(c).toEqual({
      trigger: "onHandActivate",
      cost: "paidOps",
      ops: [
        { op: "costTapResource", element: "Air" },
        { op: "costDiscardSelf" },
        {
          op: "buffForceTarget",
          n: 1,
          heroes: true,
          alsoKeyword: "Agilité",
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("nom défaussé ≠ la carte elle-même → manuel (jamais défausser une AUTRE carte)", () => {
    expect(
      compileTapEffectText(
        "[Feu], Défaussez le Champa Rouge de votre main : L'Allié ou Héros de votre choix gagne +1 en Force et Agressivité jusqu'à la fin du tour.",
        "Champa Bleu",
        undefined,
        false,
        false,
      ),
    ).toBeNull();
  });

  it("prédicat de routage isHandDiscardCostText", () => {
    expect(
      isHandDiscardCostText(
        "[Terre], Défaussez le Champa Vert de votre main : L'Allié ou Héros de votre choix gagne +1 en Force et Géant jusqu'à la fin du tour.",
      ),
    ).toBe(true);
    // Coût de défausse CLASSIQUE (depuis la main, au choix) : pas ce prédicat.
    expect(
      isHandDiscardCostText("Défaussez une carte : Piochez une carte."),
    ).toBe(false);
    // Coût-icônes nu sans auto-défausse : pas ce prédicat (isIconCostText).
    expect(isHandDiscardCostText("[Neutre][Neutre] : Piochez une carte.")).toBe(
      false,
    );
  });
});
