/**
 * Vague W6 — ops d'action fidèles : eachPlayerDraws, damageTargetByForce,
 * destroyTarget multi-type (whatAny). Couvre le DSL (chaque phrasing → la bonne
 * op + négatifs), la résolution (events EXACTS via le harnais) et le routage
 * moteur (deps injectées). « Une approximation vaut moins qu'un effet manuel » :
 * seul ce qui s'exécute fidèlement est encodé.
 */
import { describe, it, expect, vi } from "vitest";
import type { Card } from "@/types/cards";
import type { GameState } from "@/game";
import {
  compileActionEffectText,
  effectTargetIds,
  resolveDamageTargetByForce,
  resolveDestroyTarget,
} from "@/game/rules";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";
import {
  bringToMonde,
  ctxOf,
  fixture,
  instId,
  makeAlly,
} from "../../__tests__/harness";

function ops(text: string) {
  return compileActionEffectText(text, "Test")?.ops ?? null;
}

// ════════════════════════ DSL : eachPlayerDraws ════════════════════════
describe("DSL — eachPlayerDraws", () => {
  it("« Chaque joueur pioche une carte » → eachPlayerDraws n=1", () => {
    expect(ops("Chaque joueur pioche une carte.")).toEqual([
      { op: "eachPlayerDraws", n: 1 },
    ]);
  });

  it("« Chaque joueur pioche deux cartes » → eachPlayerDraws n=2", () => {
    expect(ops("Chaque joueur pioche deux cartes.")).toEqual([
      { op: "eachPlayerDraws", n: 2 },
    ]);
  });

  it("forme numérique « Chaque joueur pioche 3 cartes » → n=3", () => {
    expect(ops("Chaque joueur pioche 3 cartes.")).toEqual([
      { op: "eachPlayerDraws", n: 3 },
    ]);
  });

  it("NE compile PAS « Chaque joueur pioche autant de cartes que … » (condition)", () => {
    expect(
      ops("Chaque joueur pioche autant de cartes que de cartes en jeu."),
    ).toBeNull();
  });
});

// ════════════════════════ DSL : damageTargetByForce ════════════════════
describe("DSL — damageTargetByForce", () => {
  it("« [self] inflige sa Force en Dommages à l'Allié de votre choix » → op", () => {
    // Sans qualificatif de zone, la cible est dans tout le jeu (comme damageTarget).
    expect(
      compileActionEffectText(
        "Test inflige sa Force en Dommages à l'Allié de votre choix.",
        "Test",
        "Feu",
      )?.ops,
    ).toEqual([
      {
        op: "damageTargetByForce",
        element: "Feu",
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("« inflige sa Force … à l'Allié ou Héros de votre choix » → heroes", () => {
    expect(
      compileActionEffectText(
        "Test inflige sa Force en Dommages à l'Allié ou Héros de votre choix.",
        "Test",
        "Eau",
      )?.ops,
    ).toEqual([
      {
        op: "damageTargetByForce",
        element: "Eau",
        heroes: true,
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("forme nue « Inflige sa Force … » (corps de déclencheur) compile aussi", () => {
    expect(
      compileActionEffectText(
        "Inflige sa Force en Dommages à l'Allié de votre choix.",
        "Test",
        "Terre",
      )?.ops,
    ).toEqual([
      {
        op: "damageTargetByForce",
        element: "Terre",
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("clause « dans le Monde » seule → zones [monde]", () => {
    expect(
      compileActionEffectText(
        "Inflige sa Force en Dommages à l'Allié de votre choix dans le Monde.",
        "Test",
        "Feu",
      )?.ops,
    ).toEqual([
      { op: "damageTargetByForce", element: "Feu", zones: ["monde"] },
    ]);
  });

  it("clause Havre-Sac → zones [monde, havreSac]", () => {
    expect(
      compileActionEffectText(
        "Inflige sa Force en Dommages à l'Allié de votre choix dans le Monde ou dans un Havre-Sac.",
        "Test",
        "Air",
      )?.ops,
    ).toEqual([
      {
        op: "damageTargetByForce",
        element: "Air",
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("« inflige sa Force … à l'Allié adverse de votre choix » → controller opponent", () => {
    expect(
      compileActionEffectText(
        "Test inflige sa Force en Dommages à l'Allié adverse de votre choix.",
        "Test",
        "Feu",
      )?.ops,
    ).toEqual([
      {
        op: "damageTargetByForce",
        element: "Feu",
        controller: "opponent",
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("NE compile PAS si le sujet n'est pas la carte elle-même", () => {
    expect(
      compileActionEffectText(
        "Votre Héros inflige sa Force en Dommages à l'Allié de votre choix.",
        "Test",
        "Feu",
      ),
    ).toBeNull();
  });

  it("NE compile PAS la forme coût « Inclinez : inflige sa Force … » (deux-points)", () => {
    expect(
      ops("Inclinez : inflige sa Force en Dommages à l'Allié de votre choix."),
    ).toBeNull();
  });
});

// ════════════════════════ DSL : destroyTarget whatAny ══════════════════
describe("DSL — destroyTarget multi-type (whatAny)", () => {
  it("« Détruisez l'Équipement ou la Zone de votre choix » → whatAny", () => {
    expect(ops("Détruisez l'Équipement ou la Zone de votre choix.")).toEqual([
      {
        op: "destroyTarget",
        whatAny: ["Équipement", "Zone"],
        zones: ["monde"],
      },
    ]);
  });

  it("ordre inverse « la Zone ou l'Équipement » → whatAny", () => {
    expect(ops("Détruisez la Zone ou l'Équipement de votre choix.")).toEqual([
      {
        op: "destroyTarget",
        whatAny: ["Zone", "Équipement"],
        zones: ["monde"],
      },
    ]);
  });

  it("clause Havre-Sac → zones [monde, havreSac]", () => {
    expect(
      ops(
        "Détruisez l'Équipement ou la Zone de votre choix dans le Monde ou dans un Havre-Sac.",
      ),
    ).toEqual([
      {
        op: "destroyTarget",
        whatAny: ["Équipement", "Zone"],
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("la forme mono-type reste inchangée (rétro-compat)", () => {
    expect(ops("Détruisez l'Allié de votre choix.")).toEqual([
      { op: "destroyTarget", what: "Allié", zones: ["monde"] },
    ]);
  });

  it("NE compile PAS deux fois le même type « la Zone ou la Zone »", () => {
    expect(ops("Détruisez la Zone ou la Zone de votre choix.")).toBeNull();
  });
});

// ════════════════ Résolution : damageTargetByForce ═════════════════════
describe("targeting — resolveDamageTargetByForce", () => {
  it("inflige les Dommages égaux à la Force EFFECTIVE de la source", () => {
    // source Force 4, cible Allié Force 10 (ne meurt pas) : 4 Dommages.
    const f = fixture([
      makeAlly("src", { force: 4 }),
      makeAlly("tgt", { force: 10 }),
    ]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "A", instId("A", 1));
    const res = resolveDamageTargetByForce(
      ctxOf(f),
      "A",
      instId("A", 1),
      "Feu",
      { sourceId: instId("A", 0) },
    );
    // 1 event : +4 sur le compteur "damage" de la cible (pas de létalité)
    expect(res.events).toHaveLength(1);
    expect(res.events[0]).toMatchObject({
      actor: "A",
      type: "INC_COUNTER",
      payload: { instanceId: instId("A", 1), counter: "damage", delta: 4 },
    });
    expect(res.ruleEvents?.[0]).toMatchObject({
      kind: "damageDealt",
      amount: 4,
    });
  });

  it("0-force / source absente → aucun event (no-op fidèle)", () => {
    const f = fixture([makeAlly("tgt", { force: 5 })]);
    bringToMonde(f, "A", instId("A", 0));
    const res = resolveDamageTargetByForce(
      ctxOf(f),
      "A",
      instId("A", 0),
      "Feu",
      {}, // pas de sourceId → Force 0
    );
    expect(res.events).toEqual([]);
  });

  it("eligibilité : Alliés seuls sans heroes ; le Héros inclus avec heroes", () => {
    const f = fixture([makeAlly("a0")]);
    bringToMonde(f, "A", instId("A", 0));
    const sans = effectTargetIds(
      ctxOf(f),
      {
        op: "damageTargetByForce",
        element: "Feu",
        zones: ["monde", "havreSac"],
      },
      "A",
    );
    expect(sans).toContain(instId("A", 0));
    expect(sans).not.toContain("ci_A_001");
    const avec = effectTargetIds(
      ctxOf(f),
      {
        op: "damageTargetByForce",
        element: "Feu",
        heroes: true,
        zones: ["monde", "havreSac"],
      },
      "A",
    );
    expect(avec).toContain("ci_A_001");
  });

  it("eligibilité : controller opponent ne liste que les cibles adverses", () => {
    const f = fixture([makeAlly("a0")], [makeAlly("b0")]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "B", instId("B", 0));
    const ids = effectTargetIds(
      ctxOf(f),
      {
        op: "damageTargetByForce",
        element: "Feu",
        controller: "opponent",
        zones: ["monde"],
      },
      "A",
    );
    expect(ids).toEqual([instId("B", 0)]);
  });
});

// ════════════════ Résolution : destroyTarget whatAny ═══════════════════
describe("targeting — destroyTarget whatAny", () => {
  function typed(mainType: string): Card {
    return { ...makeAlly("x"), mainType } as unknown as Card;
  }

  it("Équipement ET Zone éligibles, Allié NON (whatAny:[Équipement,Zone])", () => {
    const equip = typed("Équipement");
    const zone = typed("Zone");
    const ally = makeAlly("a0");
    const f = fixture([equip, zone, ally]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "A", instId("A", 1));
    bringToMonde(f, "A", instId("A", 2));
    const ids = effectTargetIds(
      ctxOf(f),
      {
        op: "destroyTarget",
        whatAny: ["Équipement", "Zone"],
        zones: ["monde"],
      },
      "A",
    );
    expect(ids.sort()).toEqual([instId("A", 0), instId("A", 1)].sort());
    expect(ids).not.toContain(instId("A", 2));
  });

  it("résolution d'un Équipement : détruit, sans XP (non-Allié)", () => {
    const equip = typed("Équipement");
    const f = fixture([equip]);
    bringToMonde(f, "A", instId("A", 0));
    const res = resolveDestroyTarget(ctxOf(f), "A", instId("A", 0));
    // un seul event de défausse, aucun grant d'XP
    expect(res.events).toHaveLength(1);
    expect(res.events[0].type).toBe("MOVE");
    expect(res.events.some((e) => e.type === "INC_COUNTER")).toBe(false);
  });
});

// ════════════════ Moteur : eachPlayerDraws (deps injectées) ════════════
function makeState(): GameState {
  return {
    turn: { active: "A", number: 1 },
    instances: {},
    seats: {
      A: { main: [], pioche: [], defausse: [], heroInstanceId: "hero-A" },
      B: { main: [], pioche: [], defausse: [], heroInstanceId: "hero-B" },
    },
  } as unknown as GameState;
}

function mockDeps(over: Partial<EffectEngineDeps> = {}): EffectEngineDeps {
  const state = makeState();
  return {
    getState: () => state,
    rulesCtx: () => ({ state, getCard: () => null }),
    getCard: () => null,
    isAssist: () => true,
    isAssistEffects: () => true,
    getMatchPhase: () => "lobby",
    playerName: () => "Joueur",
    paOf: () => 6,
    dispatch: vi.fn(),
    moveTo: vi.fn(),
    shufflePioche: vi.fn(),
    checkVictory: vi.fn(),
    draw: vi.fn(),
    adjustCounter: vi.fn(),
    onMatchWon: vi.fn(),
    ...over,
  };
}

describe("engine — eachPlayerDraws", () => {
  it("pioche pour les DEUX sièges, joueur actif d'abord", () => {
    const draw = vi.fn();
    const engine = createEffectEngine(mockDeps({ draw }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "eachPlayerDraws", n: 2 }],
    });
    expect(draw.mock.calls).toEqual([
      ["A", 2],
      ["B", 2],
    ]);
  });

  it("siège B actif → B pioche d'abord, puis A", () => {
    const draw = vi.fn();
    const engine = createEffectEngine(mockDeps({ draw }));
    engine.enqueueEffect({
      seat: "B",
      cardName: "T",
      ops: [{ op: "eachPlayerDraws", n: 1 }],
    });
    expect(draw.mock.calls).toEqual([
      ["B", 1],
      ["A", 1],
    ]);
  });
});
