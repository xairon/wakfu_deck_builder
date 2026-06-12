import { describe, expect, it } from "vitest";
import { resolveCombat } from "../combat";
import {
  HERO_A,
  HERO_B,
  SAC_B,
  bringToMonde,
  ctxOf,
  dispatch,
  fixture,
  instId,
  makeAlly,
  setTurn,
} from "./harness";
import { setCounter } from "@/game";
import type { Fixture } from "./harness";

/** Applique le résultat du combat à la fixture et retourne le nouvel état. */
function applyCombat(f: Fixture, plan: Parameters<typeof resolveCombat>[1]) {
  const result = resolveCombat(ctxOf(f), plan);
  dispatch(f, ...result.events);
  return { result, state: ctxOf(f).state };
}

describe("rules/combat — choix du bloqueur frappé (6105)", () => {
  it("l'attaquant frappe le bloqueur désigné par strikes, pas le premier", () => {
    const f = fixture(
      [makeAlly("atk", { force: 2 })],
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
      strikes: { [instId("A", 0)]: instId("B", 1) },
    });
    expect(result.destroyed).toContain(instId("B", 1)); // le désigné
    expect(result.destroyed).not.toContain(instId("B", 0));
    expect(state.instances[instId("B", 0)].counters.damage ?? 0).toBe(0);
  });
});

describe("rules/combat — résolution", () => {
  it("attaquant libre → dommages au Héros cible, attaquant incliné (707/708)", () => {
    const f = fixture([makeAlly("atk", { force: 3 })]);
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    const { result, state } = applyCombat(f, {
      attackerSeat: "A",
      target: { kind: "hero", instanceId: HERO_B },
      attackers: [instId("A", 0)],
      blocks: {},
    });
    expect(state.instances[HERO_B].counters.hp).toBe(13); // 16 − 3
    expect(state.instances[instId("A", 0)].orientation).toBe("tapped");
    expect(result.winner).toBeNull();
  });

  it("duel létal mutuel : les deux Alliés sont détruits, XP croisés (706/204.6/415.1)", () => {
    const f = fixture(
      [makeAlly("atk", { force: 2, xp: 1 })],
      [makeAlly("blk", { force: 2, xp: 2 })],
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
    expect(result.destroyed.sort()).toEqual(
      [instId("A", 0), instId("B", 0)].sort(),
    );
    // chacun va dans la défausse de son propriétaire
    expect(state.seats.A.defausse).toContain(instId("A", 0));
    expect(state.seats.B.defausse).toContain(instId("B", 0));
    // XP croisés : A gagne l'XP du bloqueur (2), B celui de l'attaquant (1)
    expect(state.instances[HERO_A].counters.xp).toBe(2);
    expect(state.instances[HERO_B].counters.xp).toBe(1);
    // le Héros cible n'a pas pris de dégâts (attaquant bloqué)
    expect(state.instances[HERO_B].counters.hp).toBe(16);
  });

  it("duel non létal : les dommages restent posés sur les survivants (410.8)", () => {
    const f = fixture(
      [makeAlly("atk", { force: 2 })],
      [makeAlly("gros", { force: 5 })],
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
    // l'attaquant (force 2) prend 5 → détruit ; le gros prend 2 < 5 → survit
    expect(result.destroyed).toEqual([instId("A", 0)]);
    expect(state.instances[instId("B", 0)].counters.damage).toBe(2);
  });

  it("cible Havre-Sac : la Résistance encaisse les dommages", () => {
    const f = fixture([makeAlly("atk", { force: 3 })]);
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    dispatch(f, setCounter("B", SAC_B, "resistance", 8));
    const { state } = applyCombat(f, {
      attackerSeat: "A",
      target: { kind: "havreSac", instanceId: SAC_B },
      attackers: [instId("A", 0)],
      blocks: {},
    });
    expect(state.instances[SAC_B].counters.resistance).toBe(5);
  });

  it("6ᵉ XP : le Héros passe verso Niveau 2 avec stats ajustées (307.4)", () => {
    const f = fixture(
      [makeAlly("atk", { force: 9 })],
      [makeAlly("blk", { force: 1, xp: 6 })],
    );
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    bringToMonde(f, "B", instId("B", 0));
    const { state } = applyCombat(f, {
      attackerSeat: "A",
      target: { kind: "hero", instanceId: HERO_B },
      attackers: [instId("A", 0)],
      blocks: { [instId("B", 0)]: instId("A", 0) },
    });
    const hero = state.instances[HERO_A];
    expect(hero.counters.xp).toBe(6);
    expect(hero.face).toBe("verso");
    expect(hero.counters.level).toBe(2);
    expect(hero.counters.pa).toBe(7); // verso
    expect(hero.counters.hp).toBe(20); // 16 + (20 − 16)
  });

  it("victoire à 0 PV du Héros cible (103.2a)", () => {
    const f = fixture([makeAlly("atk", { force: 3 })]);
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    dispatch(f, setCounter("B", HERO_B, "hp", 2));
    const { result } = applyCombat(f, {
      attackerSeat: "A",
      target: { kind: "hero", instanceId: HERO_B },
      attackers: [instId("A", 0)],
      blocks: {},
    });
    expect(result.winner).toBe("A");
  });

  it("victoire à 18 XP (103.2b)", () => {
    const f = fixture(
      [makeAlly("atk", { force: 9 })],
      [makeAlly("blk", { force: 1, xp: 1 })],
    );
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    bringToMonde(f, "B", instId("B", 0));
    dispatch(f, setCounter("A", HERO_A, "xp", 17));
    const { result, state } = applyCombat(f, {
      attackerSeat: "A",
      target: { kind: "hero", instanceId: HERO_B },
      attackers: [instId("A", 0)],
      blocks: { [instId("B", 0)]: instId("A", 0) },
    });
    expect(state.instances[HERO_A].counters.xp).toBe(18);
    expect(result.winner).toBe("A");
  });
});
