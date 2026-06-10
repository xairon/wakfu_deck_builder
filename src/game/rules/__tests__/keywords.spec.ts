import { describe, expect, it } from "vitest";
import { combatKeywords, preventDamage, resolveCombat } from "@/game/rules";
import {
  HERO_B,
  bringToMonde,
  ctxOf,
  dispatch,
  fixture,
  instId,
  makeAlly,
  setTurn,
} from "./harness";
import type { Fixture } from "./harness";

function applyCombat(f: Fixture, plan: Parameters<typeof resolveCombat>[1]) {
  const result = resolveCombat(ctxOf(f), plan);
  dispatch(f, ...result.events);
  return { result, state: ctxOf(f).state };
}

describe("rules/effects — extraction des mots-clés", () => {
  it("lit Résistance structurée (éléments normalisés, cumulables)", () => {
    const kw = combatKeywords(makeAlly("r", { resist: ["Terre", 2] }));
    expect(kw.resistances.terre).toBe(2);
    expect(kw.resistances.feu).toBeUndefined();
    expect(kw.geant).toBe(false);
  });

  it("détecte Géant via le texte d'effet strict", () => {
    expect(combatKeywords(makeAlly("g", { geant: true })).geant).toBe(true);
    const decoy = makeAlly("d");
    decoy.effects = [{ description: "Détruisez le Dofus Géant adverse." }];
    expect(combatKeywords(decoy).geant).toBe(false);
  });

  it("preventDamage réduit par élément, plancher à 0", () => {
    const kw = combatKeywords(makeAlly("r", { resist: ["Feu", 2] }));
    expect(preventDamage(kw, 3, "feu")).toBe(1);
    expect(preventDamage(kw, 1, "feu")).toBe(0);
    expect(preventDamage(kw, 3, "eau")).toBe(3);
  });
});

describe("rules/effects — mots-clés en combat", () => {
  it("Résistance du bloqueur réduit les Dommages du duel (7469)", () => {
    const f = fixture(
      [makeAlly("atk", { force: 2, element: "Feu" })],
      [makeAlly("blk", { force: 2, resist: ["Feu", 1] })],
    );
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    bringToMonde(f, "B", instId("B", 0));
    const { result, state } = applyCombat(f, {
      attackerSeat: "A",
      target: { kind: "hero", instanceId: HERO_B },
      attackers: [instId("A", 0)],
      blocks: { [instId("B", 0)]: instId("A", 0) },
    });
    // bloqueur : 2 − 1 (Résistance Feu) = 1 < Force 2 → survit
    expect(result.destroyed).toEqual([instId("A", 0)]);
    expect(state.instances[instId("B", 0)].counters.damage).toBe(1);
    expect(result.log.join(" ")).toContain("prévenu");
  });

  it("Résistance protège aussi la cible Allié des attaquants libres", () => {
    const f = fixture(
      [makeAlly("atk", { force: 3, element: "Feu" })],
      [makeAlly("cible", { force: 3, resist: ["Feu", 2] })],
    );
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    bringToMonde(f, "B", instId("B", 0));
    const { result, state } = applyCombat(f, {
      attackerSeat: "A",
      target: { kind: "ally", instanceId: instId("B", 0) },
      attackers: [instId("A", 0)],
      blocks: {},
    });
    expect(result.destroyed).toEqual([]);
    expect(state.instances[instId("B", 0)].counters.damage).toBe(1); // 3 − 2
  });

  it("Géant répartit sa Force et détruit plusieurs bloqueurs (6135)", () => {
    const f = fixture(
      [makeAlly("geant", { force: 4, geant: true })],
      [makeAlly("b1", { force: 2 }), makeAlly("b2", { force: 2 })],
    );
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    bringToMonde(f, "B", instId("B", 0));
    bringToMonde(f, "B", instId("B", 1));
    const { result } = applyCombat(f, {
      attackerSeat: "A",
      target: { kind: "hero", instanceId: HERO_B },
      attackers: [instId("A", 0)],
      blocks: {
        [instId("B", 0)]: instId("A", 0),
        [instId("B", 1)]: instId("A", 0),
      },
    });
    // sans Géant, seul le premier bloqueur serait frappé ; ici les deux
    // meurent (2+2 = Force 4) et l'attaquant (Force 4) survit aux 2+2 reçus
    expect(result.destroyed.sort()).toEqual(
      [instId("A", 0), instId("B", 0), instId("B", 1)].sort(),
    );
  });

  it("sans Géant, un seul bloqueur est frappé (référence)", () => {
    const f = fixture(
      [makeAlly("atk", { force: 4 })],
      [makeAlly("b1", { force: 2 }), makeAlly("b2", { force: 2 })],
    );
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    bringToMonde(f, "B", instId("B", 0));
    bringToMonde(f, "B", instId("B", 1));
    const { result, state } = applyCombat(f, {
      attackerSeat: "A",
      target: { kind: "hero", instanceId: HERO_B },
      attackers: [instId("A", 0)],
      blocks: {
        [instId("B", 0)]: instId("A", 0),
        [instId("B", 1)]: instId("A", 0),
      },
    });
    expect(result.destroyed).toContain(instId("B", 0));
    expect(result.destroyed).not.toContain(instId("B", 1));
    expect(state.instances[instId("B", 1)].counters.damage ?? 0).toBe(0);
  });
});
