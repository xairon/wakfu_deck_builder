/**
 * Vague W43 (deck-driven, starter Incarnam Glyphe Revigorant) — RÉDUCTION DE
 * COMBAT D'ÉQUIPE : « Jusqu'à la fin du combat, tous les Dommages sur le point
 * d'être infligés à vos Alliés ou Héros attaquants ou bloqueurs sont réduits de
 * N » → op teamCombatDmgReduction (jeton teamDmgRedCombatMod sur le Héros, lu
 * par reduceDamage pour les cibles EN RÔLE DE COMBAT de ce siège).
 */
import { describe, it, expect } from "vitest";
import { compileActionEffectText, reduceDamage } from "@/game/rules";
import { setCounter } from "@/game";
import {
  HERO_B,
  bringToMonde,
  ctxOf,
  dispatch,
  fixture,
  instId,
  makeAlly,
} from "../../__tests__/harness";

describe("DSL — teamCombatDmgReduction (Glyphe Revigorant)", () => {
  it("« Jusqu'à la fin du combat … attaquants ou bloqueurs sont réduits de 1 » → op", () => {
    expect(
      compileActionEffectText(
        "Jusqu'à la fin du combat, tous les Dommages sur le point d'être infligés à vos Alliés ou Héros attaquants ou bloqueurs sont réduits de 1.",
        "Glyphe Revigorant",
        "Neutre",
      )?.ops,
    ).toEqual([{ op: "teamCombatDmgReduction", n: 1 }]);
  });
});

describe("reduceDamage — jeton d'équipe (Glyphe Revigorant)", () => {
  it("réduit de N les Dommages à une cible EN COMBAT du siège porteur ; hors combat inchangé", () => {
    const f = fixture([], [makeAlly("mien", { force: 5 })]);
    bringToMonde(f, "B", instId("B", 0)); // Allié de B
    // Le Héros de B porte le jeton (réduction d'équipe de B).
    dispatch(f, setCounter("B", HERO_B, "teamDmgRedCombatMod", 1, true));
    const hit = {
      targetId: instId("B", 0),
      amount: 3,
      element: "feu",
      combat: true,
    };
    // Sans posture de combat → pas de réduction.
    expect(reduceDamage(ctxOf(f), hit)).toBe(3);
    // La cible est attaquante → −1.
    const stance = { attackers: [instId("B", 0)], blocks: {}, targetId: null };
    expect(reduceDamage(ctxOf(f), hit, [], stance)).toBe(2);
  });

  it("ne s'applique PAS à une cible d'un siège SANS jeton", () => {
    const f = fixture([], [makeAlly("a", { force: 5 })]);
    bringToMonde(f, "B", instId("B", 0));
    // Aucun jeton posé.
    const hit = {
      targetId: instId("B", 0),
      amount: 3,
      element: "feu",
      combat: true,
    };
    const stance = { attackers: [instId("B", 0)], blocks: {}, targetId: null };
    expect(reduceDamage(ctxOf(f), hit, [], stance)).toBe(3);
  });
});
