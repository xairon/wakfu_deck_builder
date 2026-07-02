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
  it("« Chaque joueur peut piocher une carte » → eachPlayerOptional{draw}", () => {
    expect(
      compileActionEffectText("Chaque joueur peut piocher une carte.", "T")
        ?.ops,
    ).toEqual([{ op: "eachPlayerOptional", ops: [{ op: "draw", n: 1 }] }]);
  });

  it("Coffre Malveillant (onSelfDestroyed) → trigger + eachPlayerOptional{draw}", () => {
    const c = compileSelfDestroyedText(
      "Quand le Coffre Malveillant est détruit, chaque joueur peut piocher une carte.",
      "Coffre Malveillant",
      "Eau",
    );
    expect(c?.trigger).toBe("onSelfDestroyed");
    expect(c?.ops).toEqual([
      { op: "eachPlayerOptional", ops: [{ op: "draw", n: 1 }] },
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
});
