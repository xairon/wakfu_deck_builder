import { describe, expect, it } from "vitest";
import { activeGlobalMods, reduceDamage } from "@/game/rules";
import {
  HERO_A,
  bringToMonde,
  ctxOf,
  dispatch,
  fixture,
  instId,
  makeAlly,
  setTurn,
} from "./harness";
import { setCounter } from "@/game";

describe("rules/damageMods — passe unique de Dommages (A2)", () => {
  it("déduit la Résistance de la cible (7469), plancher 0 (7482)", () => {
    const f = fixture([], [makeAlly("dur", { resist: ["Feu", 2] })]);
    bringToMonde(f, "B", instId("B", 0));
    const hit = (amount: number) => ({
      targetId: instId("B", 0),
      amount,
      element: "feu",
      combat: true,
    });
    expect(reduceDamage(ctxOf(f), hit(5))).toBe(3); // 5 − 2
    expect(reduceDamage(ctxOf(f), hit(1))).toBe(0); // 1 − 2 → plancher 0
  });

  it("n'applique combatDamageReduction (Poum) qu'en rôle de combat", () => {
    const poum = makeAlly("poum", { force: 4 });
    poum.effects = [
      {
        description:
          "Tant que Poum Ondacié est attaquant, bloqueur ou cible, il subit 1 Dommage de moins.",
        compiled: {
          trigger: "static",
          static: { kind: "combatDamageReduction", n: 1 },
          ops: [],
        },
      },
    ];
    const f = fixture([], [poum]);
    bringToMonde(f, "B", instId("B", 0));
    const hit = {
      targetId: instId("B", 0),
      amount: 3,
      element: "feu",
      combat: true,
    };
    // hors posture → pas de réduction continue
    expect(reduceDamage(ctxOf(f), hit)).toBe(3);
    // attaquant → −1
    const stance = { attackers: [instId("B", 0)], blocks: {}, targetId: null };
    expect(reduceDamage(ctxOf(f), hit, [], stance)).toBe(2);
  });

  it("la Trêve (mod global) absorbe tous les Dommages", () => {
    const f = fixture([], [makeAlly("x", { force: 3 })]);
    bringToMonde(f, "B", instId("B", 0));
    const hit = {
      targetId: instId("B", 0),
      amount: 7,
      element: "feu",
      combat: true,
    };
    expect(reduceDamage(ctxOf(f), hit, [{ kind: "treve" }])).toBe(0);
  });

  it("activeGlobalMods : Trêve active tant que le tour courant n'atteint pas la borne", () => {
    const f = fixture([]);
    dispatch(f, setCounter("A", HERO_A, "treveUntilTurn", 3, true));
    setTurn(f, "B", 2); // tour adverse → 3 > 2 → actif
    expect(activeGlobalMods(ctxOf(f))).toEqual([{ kind: "treve" }]);
    setTurn(f, "A", 3); // votre tour → 3 > 3 faux → expiré
    expect(activeGlobalMods(ctxOf(f))).toEqual([]);
  });
});
