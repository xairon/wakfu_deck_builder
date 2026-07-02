/**
 * Vague W49 (deck-driven, starter Incarnam Jeunesse d'Ogrest) — ACTOR-BIND
 * MÊME-CIBLE : « <op de ciblage de créature>. Il/Elle <corps lié> » — la créature
 * CHOISIE par l'op de ciblage devient le sujet du corps « Il/Elle … » (actor:
 * "target" ; le moteur réécrit sourceId à la résolution du ciblage, puis lie une
 * fois). Jeunesse d'Ogrest : « Redressez X. Il gagne +2 en Force ». STRICT : la
 * tête doit être UN op de ciblage mono-cible, le corps lié doit compiler.
 *
 * AUSSI : correctif de zones — « … ou Héros de votre choix » inclut désormais le
 * Havre-Sac (le Héros y réside, setup.ts) — sinon le Héros serait inciblable.
 */
import { describe, it, expect } from "vitest";
import { compileActionEffectText } from "@/game/rules";

// ── Volet 1 : DSL ────────────────────────────────────────────────────────────
describe("DSL — actor-bind même-cible (compileActionEffectText)", () => {
  it("Jeunesse d'Ogrest : « Redressez X. Il gagne +2 en Force jusqu'à la fin du tour »", () => {
    const c = compileActionEffectText(
      "Redressez l'Allié ou Héros de votre choix. Il gagne +2 en Force jusqu'à la fin du tour.",
      "Jeunesse d'Ogrest",
    );
    expect(c).toEqual({
      trigger: "onPlay",
      actor: "target",
      ops: [
        // heroes ⇒ zones incluent le Havre-Sac (le Héros y réside)
        { op: "untapTarget", heroes: true, zones: ["monde", "havreSac"] },
        { op: "buffForceSelf", n: 2 },
      ],
    });
  });

  it("STRICT : tête NON ciblage de créature (« Piochez une carte. Il gagne +2 ») → manuel", () => {
    // La tête « Piochez une carte » n'est pas un op de ciblage mono-cible → pas
    // d'actor-bind ; le chemin normal échoue sur « il gagne … » (sujet flottant) → null.
    expect(
      compileActionEffectText(
        "Piochez une carte. Il gagne +2 en Force jusqu'à la fin du tour.",
        "X",
      ),
    ).toBeNull();
  });

  it("RÉGRESSION : une Action sans « Il/Elle » compile normalement (chemin inchangé)", () => {
    expect(compileActionEffectText("Piochez deux cartes.", "X")).toEqual({
      trigger: "onPlay",
      ops: [{ op: "draw", n: 2 }],
    });
  });
});
