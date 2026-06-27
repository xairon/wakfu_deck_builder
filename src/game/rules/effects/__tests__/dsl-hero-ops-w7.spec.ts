/**
 * DSL — tranche W7 : ops à sujet DÉTERMINISTE (votre Héros / l'adversaire en
 * 1v1), sans « de votre choix » ni condition.
 *   - « Tous les joueurs piochent N carte(s). » → eachPlayerDraws
 *   - « Tous vos adversaires perdent N PA/PM jusqu'à la fin du tour. » → oppLoseStatTurn
 *   - « Votre Héros gagne +N en Force jusqu'à la fin du tour. » → buffForceHeroSelf
 *   - « Redressez votre Héros. » → untapHeroSelf
 * STRICT : seule la TOTALITÉ de la phrase compile (le `$` rejette toute clause
 * résiduelle).
 */
import { describe, it, expect } from "vitest";
import {
  compileActionEffectText,
  compileTapEffectText,
  compileEffectText,
} from "../dsl.ts";

function actionOps(text: string) {
  return compileActionEffectText(text, "Test")?.ops ?? null;
}
function tapOps(text: string) {
  return compileTapEffectText(text, "Test")?.ops ?? null;
}

describe("DSL — ops Héros/adversaire déterministes (W7)", () => {
  it("« Tous les joueurs piochent une carte » → eachPlayerDraws 1", () => {
    expect(actionOps("Tous les joueurs piochent une carte.")).toEqual([
      { op: "eachPlayerDraws", n: 1 },
    ]);
  });

  it("« Tous les joueurs piochent 2 cartes » → eachPlayerDraws 2", () => {
    expect(actionOps("Tous les joueurs piochent 2 cartes.")).toEqual([
      { op: "eachPlayerDraws", n: 2 },
    ]);
  });

  it("« Tous vos adversaires perdent 1 PA jusqu'à la fin du tour » → oppLoseStatTurn pa", () => {
    expect(
      tapOps("Tous vos adversaires perdent 1 PA jusqu'à la fin du tour."),
    ).toEqual([{ op: "oppLoseStatTurn", stat: "pa", n: 1 }]);
  });

  it("« Tous vos adversaires perdent 2 PM jusqu'à la fin du tour » → oppLoseStatTurn pm", () => {
    expect(
      tapOps("Tous vos adversaires perdent 2 PM jusqu'à la fin du tour."),
    ).toEqual([{ op: "oppLoseStatTurn", stat: "pm", n: 2 }]);
  });

  it("« Votre Héros gagne +2 en Force jusqu'à la fin du tour » → buffForceHeroSelf 2", () => {
    expect(
      tapOps("Votre Héros gagne +2 en Force jusqu'à la fin du tour."),
    ).toEqual([{ op: "buffForceHeroSelf", n: 2 }]);
  });

  it("forme onArrive : « Quand Mik apparaît, votre Héros gagne +2 en Force… »", () => {
    const compiled = compileEffectText(
      "Quand Mik apparaît, votre Héros gagne +2 en Force jusqu'à la fin du tour.",
      "Mik",
    );
    expect(compiled?.ops).toEqual([{ op: "buffForceHeroSelf", n: 2 }]);
  });

  it("« Redressez votre Héros » → untapHeroSelf", () => {
    expect(tapOps("Redressez votre Héros.")).toEqual([{ op: "untapHeroSelf" }]);
  });

  it("STRICT : clause résiduelle (« et … ») ne compile pas (buff Héros)", () => {
    expect(
      tapOps("Votre Héros gagne +2 en Force et 1 PM jusqu'à la fin du tour."),
    ).toBeNull();
  });

  // NB : « Le joueur de votre choix perd N PA/PM … » est désormais compilé en
  // playerLoseStatTurn (ciblage de Héros, contrôleur choisi) — voir
  // player-choice-ops-w26.spec.ts. Ce qui RESTE non déterministe et non compilé
  // est la variante « … jusqu'à la fin de SON prochain tour » (durée non modélisée).
  it("STRICT : « … gagne 1 PM jusqu'à la fin de son prochain tour » NE compile PAS (durée non modélisée)", () => {
    expect(
      tapOps(
        "Le joueur de votre choix gagne 1 PM jusqu'à la fin de son prochain tour.",
      ),
    ).toBeNull();
  });
});
