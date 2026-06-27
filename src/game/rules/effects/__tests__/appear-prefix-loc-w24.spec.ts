/**
 * Tranche W24 — PRÉFIXE D'APPARITION : clauses de LIEU / PROVENANCE intégrées.
 *
 * Le déclencheur d'apparition « Quand/Lorsque [self] apparaît, … » (onArrive)
 * et « Quand un Allié … apparaît, … » (onOtherAppears) admettent désormais une
 * phrase de LIEU optionnelle entre « apparaît » et la virgule (« apparaît DANS
 * LE MONDE, … », « apparaît DEPUIS VOTRE PIOCHE, … », « apparaît EN RENFORT,
 * … »). Purement locative : la sémantique est INCHANGÉE (même trigger, même
 * corps). Une clause ARBITRAIRE (condition « si … », « et que … ») n'est PAS un
 * lieu connu → ne matche pas (reste manuel).
 */
import { describe, it, expect } from "vitest";
import { compileEffectText, compileAppearanceTriggerText } from "../dsl";

describe("compileEffectText — clause de lieu intégrée (onArrive)", () => {
  it("« apparaît dans le Monde, … » compile en onArrive + corps (Démone XX)", () => {
    const c = compileEffectText(
      "Quand la Démone XX apparaît dans le Monde, inclinez tous les Alliés et Héros adverses de Force inférieure ou égale à 5.",
      "Démone XX",
      "Feu",
    );
    expect(c).toEqual({
      trigger: "onArrive",
      ops: [
        {
          op: "tapAll",
          controller: "opponent",
          heroes: true,
          maxForce: 5,
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("« apparaît dans le Monde, vous pouvez détruire … » → onArrive optional (Grasmera)", () => {
    const c = compileEffectText(
      "Quand Grasmera apparaît dans le Monde, vous pouvez détruire l'Allié de votre choix.",
      "Grasmera",
      "Feu",
    );
    expect(c).toEqual({
      trigger: "onArrive",
      optional: true,
      ops: [{ op: "destroyTarget", what: "Allié", zones: ["monde"] }],
    });
  });

  it("« apparaît depuis votre Pioche, … » (provenance) compile aussi", () => {
    const c = compileEffectText(
      "Quand Baz apparaît depuis votre Pioche, piochez une carte.",
      "Baz",
    );
    expect(c).toEqual({ trigger: "onArrive", ops: [{ op: "draw", n: 1 }] });
  });

  it("« apparaît en Renfort, … » compile aussi", () => {
    const c = compileEffectText(
      "Quand Qux apparaît en Renfort, piochez une carte.",
      "Qux",
    );
    expect(c).toEqual({ trigger: "onArrive", ops: [{ op: "draw", n: 1 }] });
  });

  it("le préfixe nu « apparaît, … » (sans lieu) reste compilé (régression)", () => {
    const c = compileEffectText("Quand Foo apparaît, piochez une carte.", "Foo");
    expect(c).toEqual({ trigger: "onArrive", ops: [{ op: "draw", n: 1 }] });
  });

  it("clause ARBITRAIRE (« et que vous le contrôlez ») n'est PAS un lieu → null", () => {
    expect(
      compileEffectText(
        "Quand Foo apparaît et que vous le contrôlez, piochez une carte.",
        "Foo",
      ),
    ).toBeNull();
  });

  it("condition « si … » entre apparaît et virgule → null", () => {
    expect(
      compileEffectText(
        "Quand Bar apparaît si vous avez trois cartes, piochez une carte.",
        "Bar",
      ),
    ).toBeNull();
  });
});

describe("compileAppearanceTriggerText — clause de lieu intégrée (onOtherAppears)", () => {
  it("« un Allié … apparaît depuis votre Défausse, … »", () => {
    const c = compileAppearanceTriggerText(
      "Quand un Allié apparaît depuis votre Défausse, piochez une carte.",
      "Veilleur",
    );
    expect(c).toEqual({
      trigger: "onOtherAppears",
      watch: { mainType: "Allié" },
      ops: [{ op: "draw", n: 1 }],
    });
  });

  it("« un Allié [Famille] apparaît dans le Monde, … » (régression : lieu connu)", () => {
    const c = compileAppearanceTriggerText(
      "Quand un Allié Wabbit apparaît dans le Monde, piochez une carte.",
      "Veilleur",
    );
    expect(c).toEqual({
      trigger: "onOtherAppears",
      watch: { mainType: "Allié", sub: "wabbit" },
      ops: [{ op: "draw", n: 1 }],
    });
  });

  it("« sous votre contrôle » reste admis (régression)", () => {
    const c = compileAppearanceTriggerText(
      "Quand un Allié apparaît sous votre contrôle, piochez une carte.",
      "Veilleur",
    );
    expect(c).toEqual({
      trigger: "onOtherAppears",
      watch: { mainType: "Allié" },
      ops: [{ op: "draw", n: 1 }],
    });
  });

  it("clause arbitraire entre apparaît et virgule → null", () => {
    expect(
      compileAppearanceTriggerText(
        "Quand un Allié apparaît et que vous gagnez, piochez une carte.",
        "Veilleur",
      ),
    ).toBeNull();
  });
});
