/**
 * Vague W55 (deck-driven, starter Incarnam Bonne Affaire !) — LOOK-N :
 * « Regardez les deux premières cartes de votre Pioche. Prenez l'une de ces
 * cartes en main, puis recyclez l'autre. » → op lookTopPick{n:2} (combo
 * DEUX phrases dans compileBody). STRICT : n = 2 et reste SINGULIER
 * (« l'autre ») exigés — toute variante reste manuelle.
 */
import { describe, it, expect } from "vitest";
import { compileActionEffectText } from "@/game/rules";

describe("DSL — lookTopPick (Bonne Affaire !)", () => {
  it("texte complet (2 phrases) → un seul op lookTopPick{n:2}", () => {
    const c = compileActionEffectText(
      "Regardez les deux premières cartes de votre Pioche. Prenez l'une de ces cartes en main, puis recyclez l'autre.",
      "Bonne Affaire !",
    );
    expect(c).toEqual({
      trigger: "onPlay",
      ops: [{ op: "lookTopPick", n: 2, dest: "main", rest: "recycle" }],
    });
  });

  it("STRICT : « les trois premières … remettez les autres » (multi-reste) → manuel", () => {
    expect(
      compileActionEffectText(
        "Regardez les trois premières cartes de votre Pioche. Recyclez les cartes de votre choix et remettez les autres sur le dessus de votre Pioche dans l'ordre de votre choix.",
        "Anneau Fioutioure",
      ),
    ).toBeNull();
  });

  it("STRICT : « Regardez … » sans phrase suivante comprise → manuel", () => {
    expect(
      compileActionEffectText(
        "Regardez les deux premières cartes de votre Pioche.",
        "X",
      ),
    ).toBeNull();
  });

  it("STRICT : variante X (« les X premières … sans les révéler ») → manuel", () => {
    expect(
      compileActionEffectText(
        "Regardez les X premières cartes du dessus de votre Pioche sans les révéler. Prenez une de ces cartes en main.",
        "Faille Temporelle",
      ),
    ).toBeNull();
  });
});
