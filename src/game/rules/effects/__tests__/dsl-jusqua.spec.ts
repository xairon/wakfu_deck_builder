/**
 * Variantes « jusqu'à N » → ops existantes (recycleFromDiscard / discardFromHand).
 *
 * L'interaction de pioche/défausse est annulable (le joueur peut en prendre 0..N),
 * donc ces formulations sont fidèles aux ops à compte exact déjà gérées par le
 * moteur — aucune sémantique nouvelle.
 */
import { describe, it, expect } from "vitest";
import { compileActionEffectText, compileEffectText } from "../dsl.ts";

describe("DSL — variantes « jusqu'à N » (recycle / défausse)", () => {
  it("devrait compiler « Recyclez jusqu'à trois cartes de votre Défausse » en recycleFromDiscard{n:3}", () => {
    const compiled = compileActionEffectText(
      "Recyclez jusqu'à trois cartes de votre Défausse.",
      "Test",
    );
    expect(compiled).toEqual({
      trigger: "onPlay",
      ops: [{ op: "recycleFromDiscard", n: 3 }],
    });
  });

  it("devrait compiler la forme numérique « jusqu'à 2 cartes »", () => {
    const compiled = compileActionEffectText(
      "Recyclez jusqu'à 2 cartes.",
      "Test",
    );
    expect(compiled).toEqual({
      trigger: "onPlay",
      ops: [{ op: "recycleFromDiscard", n: 2 }],
    });
  });

  it("devrait compiler la forme avec Élément en recycleFromDiscard{n,element} (Élément capitalisé)", () => {
    const compiled = compileActionEffectText(
      "Recyclez jusqu'à une carte (feu) de votre Défausse.",
      "Test",
    );
    expect(compiled).toEqual({
      trigger: "onPlay",
      ops: [{ op: "recycleFromDiscard", n: 1, element: "Feu" }],
    });
  });

  it("devrait compiler « Défaussez-vous de jusqu'à deux cartes » en discardFromHand{n:2}", () => {
    const compiled = compileActionEffectText(
      "Défaussez-vous de jusqu'à deux cartes.",
      "Test",
    );
    expect(compiled).toEqual({
      trigger: "onPlay",
      ops: [{ op: "discardFromHand", n: 2 }],
    });
  });

  it("devrait fonctionner dans un déclencheur « Quand … apparaît »", () => {
    const compiled = compileEffectText(
      "Quand Test apparaît, recyclez jusqu'à trois cartes de votre Défausse.",
      "Test",
    );
    expect(compiled).toEqual({
      trigger: "onArrive",
      ops: [{ op: "recycleFromDiscard", n: 3 }],
    });
  });

  // NÉGATIF : « jusqu'à N Monstres » est un filtre par TYPE, non supporté par
  // recycleFromDiscard (qui ne filtre que par Élément). Doit rester non compilé.
  it("ne devrait PAS compiler « Recyclez jusqu'à trois Monstres » (filtre de type non supporté)", () => {
    const compiled = compileActionEffectText(
      "Recyclez jusqu'à trois Monstres.",
      "Test",
    );
    expect(compiled).toBeNull();
  });
});
