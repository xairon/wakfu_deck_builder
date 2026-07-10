/**
 * Vague W44 (deck-driven, starters Incarnam) — « CHAQUE JOUEUR PEUT <corps> » :
 * op eachPlayerOptional (une confirmation indépendante par siège, le corps se
 * résout du point de vue de chaque joueur). Coffre Malveillant (onSelfDestroyed
 * + chaque joueur peut piocher) et Djakky Chwan (onArrive + chaque joueur peut
 * redresser un Allié de son choix). Le « peut » est réel (pas mandatory).
 */
import { describe, it, expect } from "vitest";
import {
  compileActionEffectText,
  compileSelfDestroyedText,
  compileEffectText,
} from "@/game/rules";

describe("DSL — eachPlayerOptional", () => {
  it("« Chaque joueur peut piocher une carte » → eachPlayerOptional{draw} + prompt lisible", () => {
    expect(
      compileActionEffectText("Chaque joueur peut piocher une carte.", "T")
        ?.ops,
    ).toEqual([
      {
        op: "eachPlayerOptional",
        prompt: "peut piocher une carte",
        ops: [{ op: "draw", n: 1 }],
      },
    ]);
  });

  it("Coffre Malveillant (onSelfDestroyed) → trigger + eachPlayerOptional{draw}", () => {
    const c = compileSelfDestroyedText(
      "Quand le Coffre Malveillant est détruit, chaque joueur peut piocher une carte.",
      "Coffre Malveillant",
      "Eau",
    );
    expect(c?.trigger).toBe("onSelfDestroyed");
    expect(c?.ops).toEqual([
      {
        op: "eachPlayerOptional",
        prompt: "peut piocher une carte",
        ops: [{ op: "draw", n: 1 }],
      },
    ]);
  });

  it("Djakky Chwan (onArrive de soi) → eachPlayerOptional{untapTarget controller:self}", () => {
    // « Quand <self> apparaît, … » = déclenché d'apparition de SOI → compileEffectText
    // (compileAppearanceTriggerText gère « un Allié apparaît », sujet ≠ soi).
    const c = compileEffectText(
      "Quand Djakky Chwan apparaît, chaque joueur peut redresser un Allié de son choix.",
      "Djakky Chwan",
      "Eau",
    );
    expect(c?.trigger).toBe("onArrive");
    expect(c?.ops).toEqual([
      {
        op: "eachPlayerOptional",
        prompt: "peut redresser un Allié de son choix",
        ops: [
          {
            op: "untapTarget",
            controller: "self",
            zones: ["monde", "havreSac"],
          },
        ],
      },
    ]);
  });

  it("le prompt est utilisé par la confirmation (plus de « peut agir » générique quand il existe)", () => {
    // UX audit 2026-07 : la fenêtre disait « <Carte> — <Joueur> : peut agir »
    // sans dire CE QUE fait l'effet. Le DSL embarque désormais le libellé.
    const c = compileActionEffectText(
      "Chaque joueur peut piocher deux cartes.",
      "T",
    );
    const op = c?.ops[0] as { prompt?: string };
    expect(op.prompt).toBe("peut piocher 2 cartes");
  });
});
