/**
 * Vague « BUFF DE MASSE Force + Mot-clé » (Volet B — textes récupérés) :
 * « Tous vos/les [autres] <X> gagnent +N en Force et <Mot-clé> jusqu'à la fin
 * du tour » → op `buffAllTurn` NON interactif : à la résolution, chaque
 * instance éligible (instantané) reçoit forceMod + <kw>TurnMod (jetons
 * TURN-scoped existants). `others` exclut la SOURCE (Rat Batteur).
 * Cartes : Rat Batteur ([Incliner] : … vos autres Rats), La Dernière Rasade
 * (vos Alliés et Héros), Apioucalypse (LES Alliés Piou — les deux camps).
 */
import { describe, it, expect } from "vitest";
import { compileActionEffectText, compileTapEffectText } from "../dsl";

describe("buffAllTurn — DSL", () => {
  it("Rat Batteur : « Tous vos autres Rats gagnent +1 en Force et Géant … » (pouvoir)", () => {
    const c = compileTapEffectText(
      "[Incliner] : Tous vos autres Rats gagnent +1 en Force et Géant jusqu'à la fin du tour.",
      "Rat Batteur",
      undefined,
      false,
      true,
    );
    expect(c).toEqual({
      trigger: "onTap",
      ops: [
        {
          op: "buffAllTurn",
          n: 1,
          alsoKeyword: "Géant",
          controller: "self",
          others: true,
          sub: "rat",
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("La Dernière Rasade : « Tous vos Alliés et Héros gagnent +3 en Force et Géant … »", () => {
    const c = compileActionEffectText(
      "Tous vos Alliés et Héros gagnent +3 en Force et Géant jusqu'à la fin du tour.",
      "La Dernière Rasade",
    );
    expect(c).toEqual({
      trigger: "onPlay",
      ops: [
        {
          op: "buffAllTurn",
          n: 3,
          alsoKeyword: "Géant",
          controller: "self",
          heroes: true,
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("Apioucalypse : « Tous les Alliés Piou … » → controller any (les deux camps)", () => {
    const c = compileActionEffectText(
      "Tous les Alliés Piou gagnent +2 en Force et Agilité jusqu'à la fin du tour.",
      "Apioucalypse",
    );
    expect(c).toEqual({
      trigger: "onPlay",
      ops: [
        {
          op: "buffAllTurn",
          n: 2,
          alsoKeyword: "Agilité",
          controller: "any",
          sub: "piou",
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("mot-clé non câblé / famille inconnue → manuel", () => {
    expect(
      compileActionEffectText(
        "Tous vos Alliés gagnent +1 en Force et Fantôme jusqu'à la fin du tour.",
        "X",
      ),
    ).toBeNull();
    expect(
      compileActionEffectText(
        "Tous vos autres Machins gagnent +1 en Force et Géant jusqu'à la fin du tour.",
        "X",
      ),
    ).toBeNull();
  });
});
