/**
 * Vague W40 (deck-driven, starters Incarnam) — VERROU « une seule fois par
 * tour » sur pouvoir NON-tap + COÛT COMPOSÉ inclinaison+défausse.
 *
 *  - `oncePerTurn` (Bwork Mage : « Défaussez une carte : … N'utilisez ce
 *    pouvoir qu'une seule fois par tour. ») : la clause EST le verrou (le
 *    pouvoir n'incline pas la source) → flag sur l'effet compilé ; l'activation
 *    pose un jeton `powerUses0` (purgé en fin de tour, isTurnToken) qui bloque
 *    toute réactivation ce tour.
 *  - `tapsSource` (Amulette Akwadala : requiresIncline + « Défaussez une
 *    carte : Piochez une carte. ») : le chemin paidOps incline AUSSI la source.
 *  - Corps FIXE sur coût de défausse (repli compileBody dans
 *    compileDiscardCountCost, au-delà des corps fromCount).
 */
import { describe, it, expect } from "vitest";
import { compileTapEffectText } from "../dsl";
import { compiledEffectSchema } from "@/schema/effects";

describe("DSL — coût de défausse : oncePerTurn / tapsSource / corps fixe", () => {
  it("Bwork Mage → costDiscard{n:1} + damageTarget + oncePerTurn:true", () => {
    const c = compileTapEffectText(
      "Défaussez une carte : Le Bwork Mage inflige 1 Dommage à l'Allié ou Héros de votre choix. N'utilisez ce pouvoir qu'une seule fois par tour.",
      "Bwork Mage",
      "Feu",
      false,
      false, // pouvoir NON-tap : la clause once-per-turn est le verrou
    );
    expect(c).toEqual({
      trigger: "onTap",
      cost: "paidOps",
      oncePerTurn: true,
      ops: [
        { op: "costDiscard", n: 1 },
        {
          op: "damageTarget",
          n: 1,
          element: "Feu",
          heroes: true,
          zones: ["monde", "havreSac"],
        },
      ],
    });
    expect(compiledEffectSchema.safeParse(c).success).toBe(true);
  });

  it("Amulette Akwadala (requiresIncline) → tapsSource:true, sans oncePerTurn", () => {
    const c = compileTapEffectText(
      "Défaussez une carte : Piochez une carte.",
      "Amulette Akwadala",
      "Neutre",
      false,
      true, // requiresIncline → l'inclinaison est le verrou, PAS de flag oncePerTurn
    );
    expect(c).toEqual({
      trigger: "onTap",
      cost: "paidOps",
      tapsSource: true,
      ops: [
        { op: "costDiscard", n: 1 },
        { op: "draw", n: 1 },
      ],
    });
    expect(compiledEffectSchema.safeParse(c).success).toBe(true);
  });

  it("STRICT : corps inconnu malgré la clause strippée → non compilé", () => {
    expect(
      compileTapEffectText(
        "Défaussez une carte : Copiez les effets du Sort que vous venez de jouer. N'utilisez ce pouvoir qu'une seule fois par tour.",
        "Toad",
        "Neutre",
        false,
        false,
      ),
    ).toBeNull();
  });

  it("non-régression : corps fromCount (Flétrissement) inchangé, sans flags", () => {
    const c = compileTapEffectText(
      "Défaussez jusqu'à 3 cartes : Infligez le même nombre de Dommages à l'Allié ou Héros de votre choix.",
      "Flétrissement",
      "Feu",
      true,
    );
    expect(c?.oncePerTurn).toBeUndefined();
    expect(c?.tapsSource).toBeUndefined();
    expect(c?.ops[0]).toEqual({ op: "costDiscard", n: 3, max: true });
  });
});
