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
import { combatKeywords, effectiveKeywords } from "../effects/keywords";
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
  it("attaquant libre → dommages au Héros cible (707) ; A6 : la résolution pure n'incline plus", () => {
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
    // A6 : l'inclinaison part de la DÉCLARATION (combatConfirmAttackers du
    // store, 703) ; la résolution pure ne touche plus l'orientation.
    expect(state.instances[instId("A", 0)].orientation).toBe("upright");
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

describe("rules/combat — pouvoirs continus en combat (805.1)", () => {
  it("le Maître Bolet bloque à +2 : il tue l'attaquant et survit au duel (204.4)", () => {
    const bolet = makeAlly("bolet", { force: 3, xp: 2 });
    bolet.effects = [
      {
        description: "Tant qu'il bloque, le Maître Bolet gagne +2 en Force.",
        compiled: {
          trigger: "static",
          static: { kind: "forceWhileBlocking", n: 2 },
          ops: [],
        },
      },
    ];
    const f = fixture([makeAlly("atk", { force: 4, xp: 1 })], [bolet]);
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    bringToMonde(f, "B", instId("B", 0));
    const { result, state } = applyCombat(f, {
      attackerSeat: "A",
      target: { kind: "hero", instanceId: HERO_B },
      attackers: [instId("A", 0)],
      blocks: { [instId("B", 0)]: instId("A", 0) },
    });
    // bloqueur à 5 (3 + 2) : il frappe 5 ≥ 4 → attaquant détruit ; il encaisse
    // 4 < 5 → il survit AU DUEL (sans le bonus, 3 contre 4 le tuerait).
    // À la Fin de Combat le bonus cesse (708.1) : la létalité différée des
    // 4 Dommages relève alors des destructions d'état du store (3019).
    expect(result.destroyed).toEqual([instId("A", 0)]);
    expect(state.seats.A.defausse).toContain(instId("A", 0));
    expect(state.instances[instId("B", 0)].counters.damage).toBe(4);
    expect(state.seats.B.defausse).not.toContain(instId("B", 0));
    // 415.1 : seul B gagne l'XP de l'attaquant détruit
    expect(state.instances[HERO_B].counters.xp).toBe(1);
  });
});

describe("rules/combat — riposte de la Cible (707.1)", () => {
  it("Cible Allié non bloquée riposte sa Force et tue l'attaquant plus faible", () => {
    const f = fixture(
      [makeAlly("atk", { force: 1 })],
      [makeAlly("cible", { force: 3 })],
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
    // l'attaquant (F1) prend la riposte 3 ≥ 1 → détruit ; la cible prend 1 < 3 → survit
    expect(result.destroyed).toContain(instId("A", 0));
    expect(state.seats.B.defausse).not.toContain(instId("B", 0));
    expect(state.instances[instId("B", 0)].counters.damage).toBe(1);
  });

  it("riposte mortelle réciproque : Cible et attaquant meurent ensemble (simultané)", () => {
    const f = fixture(
      [makeAlly("atk", { force: 3, xp: 1 })],
      [makeAlly("cible", { force: 3, xp: 2 })],
    );
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    bringToMonde(f, "B", instId("B", 0));
    const { result } = applyCombat(f, {
      attackerSeat: "A",
      target: { kind: "ally", instanceId: instId("B", 0) },
      attackers: [instId("A", 0)],
      blocks: {},
    });
    expect(result.destroyed.sort()).toEqual(
      [instId("A", 0), instId("B", 0)].sort(),
    );
  });

  it("riposte multi-attaquants : plan.ripostes désigne l'attaquant frappé", () => {
    const f = fixture(
      [makeAlly("atk1", { force: 1 }), makeAlly("atk2", { force: 1 })],
      [makeAlly("cible", { force: 3 })],
    );
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    bringToMonde(f, "A", instId("A", 1), { arrivedTurn: 1 });
    bringToMonde(f, "B", instId("B", 0));
    const { result } = applyCombat(f, {
      attackerSeat: "A",
      target: { kind: "ally", instanceId: instId("B", 0) },
      attackers: [instId("A", 0), instId("A", 1)],
      blocks: {},
      ripostes: { [instId("B", 0)]: instId("A", 1) },
    });
    // la cible (F3) frappe atk2 (F1) → atk2 détruit, atk1 intact, cible survit (2 < 3)
    expect(result.destroyed).toEqual([instId("A", 1)]);
  });
});

describe("rules/combat — Géant (6135)", () => {
  it("Géant à 1 bloqueur : déborde le reliquat sur la Cible Héros", () => {
    const f = fixture(
      [makeAlly("colosse", { force: 4, geant: true })],
      [makeAlly("b1", { force: 1 })],
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
    // bloqueur (F1) tué par 1, reliquat 3 déborde sur le Héros : 16 − 3 = 13
    expect(result.destroyed).toContain(instId("B", 0));
    expect(state.instances[HERO_B].counters.hp).toBe(13);
  });
});

describe("rules/combat — inclinaison des bloqueurs (708.3)", () => {
  it("un bloqueur survivant est incliné en fin de combat", () => {
    const f = fixture(
      [makeAlly("atk", { force: 1 })],
      [makeAlly("blk", { force: 5 })],
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
    expect(state.instances[instId("B", 0)].orientation).toBe("tapped");
  });
});

describe("rules/combat — Tacle (verrou d'inclinaison, glossaire)", () => {
  // combatKeywords lit le mot-clé structuré Tacle (comme Agilité/Agressivité).
  it("combatKeywords.tacle = true pour un Allié possédant le mot-clé Tacle", () => {
    const tacleur = makeAlly("t", { tacle: true });
    expect(combatKeywords(tacleur).tacle).toBe(true);
    expect(combatKeywords(makeAlly("x")).tacle).toBe(false);
  });

  // effectiveKeywords lit aussi le jeton conféré tacleTurnMod (grantKeyword).
  it("effectiveKeywords.tacle = true via le jeton conféré tacleTurnMod", () => {
    const f = fixture([makeAlly("c", { force: 2 })]);
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    const id = instId("A", 0);
    expect(effectiveKeywords(ctxOf(f), id).tacle).toBe(false);
    dispatch(f, {
      actor: "A",
      type: "SET_COUNTER",
      payload: {
        instanceId: id,
        counter: "tacleTurnMod",
        value: 1,
        token: true,
      },
    } as never);
    expect(effectiveKeywords(ctxOf(f), id).tacle).toBe(true);
  });

  // LE VERROU : un bloqueur qui bloque un ATTAQUANT possédant Tacle « ne peut
  // pas s'incliner » → il n'est PAS incliné en fin de combat (reste redressé).
  it("un bloqueur SURVIVANT qui bloque un attaquant Tacle n'est PAS incliné", () => {
    const f = fixture(
      [makeAlly("atkTacle", { force: 1, tacle: true })],
      [makeAlly("blk", { force: 5 })],
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
    // force 1 vs 5 : le bloqueur survit ; sans Tacle il serait tapped (708.3),
    // mais l'attaquant a Tacle → le bloqueur reste redressé.
    expect(state.instances[instId("B", 0)].orientation).toBe("upright");
  });

  // Le verrou est RELATIONNEL : un bloqueur en relation avec un attaquant SANS
  // Tacle s'incline normalement, même si un autre attaquant Tacle existe ailleurs.
  it("un bloqueur NON-relié à un possesseur de Tacle s'incline normalement", () => {
    const f = fixture(
      [
        makeAlly("atkTacle", { force: 1, tacle: true }),
        makeAlly("atkPlain", { force: 1 }),
      ],
      [makeAlly("b0", { force: 5 }), makeAlly("b1", { force: 5 })],
    );
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    bringToMonde(f, "A", instId("A", 1), { arrivedTurn: 1 });
    bringToMonde(f, "B", instId("B", 0));
    bringToMonde(f, "B", instId("B", 1));
    const { state } = applyCombat(f, {
      attackerSeat: "A",
      target: { kind: "hero", instanceId: HERO_B },
      attackers: [instId("A", 0), instId("A", 1)],
      blocks: {
        [instId("B", 0)]: instId("A", 0), // bloque l'attaquant Tacle → verrouillé
        [instId("B", 1)]: instId("A", 1), // bloque l'attaquant normal → incliné
      },
    });
    expect(state.instances[instId("B", 0)].orientation).toBe("upright");
    expect(state.instances[instId("B", 1)].orientation).toBe("tapped");
  });

  // Tacle CONFÉRÉ (jeton tacleTurnMod) verrouille comme le mot-clé imprimé.
  it("Tacle conféré (jeton) à l'attaquant verrouille aussi son bloqueur", () => {
    const f = fixture(
      [makeAlly("atk", { force: 1 })],
      [makeAlly("blk", { force: 5 })],
    );
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    bringToMonde(f, "B", instId("B", 0));
    dispatch(f, {
      actor: "A",
      type: "SET_COUNTER",
      payload: {
        instanceId: instId("A", 0),
        counter: "tacleTurnMod",
        value: 1,
        token: true,
      },
    } as never);
    const { state } = applyCombat(f, {
      attackerSeat: "A",
      target: { kind: "hero", instanceId: HERO_B },
      attackers: [instId("A", 0)],
      blocks: { [instId("B", 0)]: instId("A", 0) },
    });
    expect(state.instances[instId("B", 0)].orientation).toBe("upright");
  });
});
