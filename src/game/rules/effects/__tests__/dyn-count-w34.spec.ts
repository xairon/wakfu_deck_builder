/**
 * Vague W34 — VALEUR DYNAMIQUE canonique (ValueExpr, modèle Forge « Count$ »),
 * 1re source `count`. Une op scalaire porte `value` (ValueExpr) ; pour
 * `{kind:"count"}` la magnitude = nombre d'instances EN JEU contrôlées par
 * l'acteur du type visé (« … égal au nombre de <X> que vous contrôlez »). Couvre
 * le DSL (phrasing → op + négatifs stricts) et la résolution moteur (evalValue,
 * deps mockées, on assert le draw exact). Effet cible réel :
 * l'Action Enutrof « Piochez un nombre de cartes égal au nombre d'Équipements que
 * vous contrôlez ». « an approximation of gameplay is worse than a manual effect ».
 */
import { describe, it, expect, vi } from "vitest";
import type { GameState } from "@/game";
import { compileActionEffectText } from "@/game/rules";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";

function ops(text: string) {
  return compileActionEffectText(text, "Test")?.ops ?? null;
}

// ════════════════════════════ DSL : draw + count ════════════════════════════
describe("DSL — draw à magnitude dynamique (countOf « que vous contrôlez »)", () => {
  it("« … égal au nombre d'Équipements que vous contrôlez » → draw count Équipement", () => {
    expect(
      ops(
        "Piochez un nombre de cartes égal au nombre d'Équipements que vous contrôlez.",
      ),
    ).toEqual([
      {
        op: "draw",
        n: 0,
        value: {
          kind: "count",
          of: { source: "controlled", what: "Équipement" },
        },
      },
    ]);
  });

  it("article « de » (consonne) : « … nombre de Zones que vous contrôlez » → count Zone", () => {
    expect(
      ops(
        "Piochez un nombre de cartes égal au nombre de Zones que vous contrôlez.",
      ),
    ).toEqual([
      {
        op: "draw",
        n: 0,
        value: { kind: "count", of: { source: "controlled", what: "Zone" } },
      },
    ]);
  });

  it("Famille non ambiguë : « … nombre de Bouftous que vous contrôlez » → Allié + sub", () => {
    expect(
      ops(
        "Piochez un nombre de cartes égal au nombre de Bouftous que vous contrôlez.",
      ),
    ).toEqual([
      {
        op: "draw",
        n: 0,
        value: {
          kind: "count",
          of: { source: "controlled", what: "Allié", sub: "Bouftou" },
        },
      },
    ]);
  });

  it("STRICT : clause résiduelle (« … Si vous contrôlez … à la place ») → non compilé", () => {
    expect(
      ops(
        "Piochez un nombre de cartes égal au nombre de Bouftous que vous contrôlez. Si vous contrôlez au moins trois Bouftous, piochez une carte de plus.",
      ),
    ).toBeNull();
  });

  it("STRICT : type inconnu/ambigu (« … nombre de Boissons … ») → non compilé", () => {
    expect(
      ops(
        "Piochez un nombre de cartes égal au nombre de Boissons que vous contrôlez.",
      ),
    ).toBeNull();
  });

  it("la forme fixe « Piochez deux cartes » reste inchangée (n, sans count)", () => {
    expect(ops("Piochez deux cartes.")).toEqual([{ op: "draw", n: 2 }]);
  });
});

// ══════════════════════════ Moteur : résolution du count ═════════════════════
type Inst = {
  instanceId: string;
  controller?: "A" | "B";
  location?: { zone: string };
  cardId?: string;
  orientation?: string;
};

function makeState(insts: Inst[]): GameState {
  const instances: Record<string, Inst> = {
    "hero-A": { instanceId: "hero-A", orientation: "upright" },
    "hero-B": { instanceId: "hero-B", orientation: "upright" },
  };
  for (const i of insts) instances[i.instanceId] = i;
  return {
    turn: { active: "A", number: 1 },
    instances,
    seats: {
      A: { main: [], pioche: [], defausse: [], heroInstanceId: "hero-A" },
      B: { main: [], pioche: [], defausse: [], heroInstanceId: "hero-B" },
    },
  } as unknown as GameState;
}

const CARDS: Record<string, { mainType: string; subTypes?: string[] }> = {
  equip: { mainType: "Équipement" },
  ally: { mainType: "Allié", subTypes: ["Kitsou"] },
  zone: { mainType: "Zone" },
};

function mockDeps(
  state: GameState,
  over: Partial<EffectEngineDeps> = {},
): EffectEngineDeps {
  return {
    getState: () => state,
    rulesCtx: () => ({ state, getCard: () => null }),
    getCard: (cardId: string | null) =>
      cardId ? (CARDS[cardId] as never) : null,
    isAssist: () => true,
    isAssistEffects: () => true,
    getMatchPhase: () => "lobby",
    playerName: (s: string) => `Joueur ${s}`,
    paOf: () => 6,
    dispatch: vi.fn(),
    moveTo: vi.fn(),
    shufflePioche: vi.fn(),
    checkVictory: vi.fn(),
    draw: vi.fn(),
    adjustCounter: vi.fn(),
    onMatchWon: vi.fn(),
    ...over,
  } as unknown as EffectEngineDeps;
}

describe("createEffectEngine — draw count « Équipements que vous contrôlez »", () => {
  const eq = (id: string, controller: "A" | "B", zone = "monde") => ({
    instanceId: id,
    controller,
    location: { zone },
    cardId: "equip",
  });

  it("compte les Équipements en jeu de l'acteur (Monde + Havre-Sac), pas ceux de l'adversaire", () => {
    const draw = vi.fn();
    const state = makeState([
      eq("e1", "A", "monde"),
      eq("e2", "A", "havreSac"),
      eq("e3", "B", "monde"), // adversaire → exclu
      {
        instanceId: "a1",
        controller: "A",
        location: { zone: "monde" },
        cardId: "ally",
      }, // pas Équipement → exclu
    ]);
    const engine = createEffectEngine(mockDeps(state, { draw }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Enutrof",
      ops: [
        {
          op: "draw",
          n: 0,
          value: {
            kind: "count",
            of: { source: "controlled", what: "Équipement" },
          },
        },
      ],
    });
    expect(draw.mock.calls).toEqual([["A", 2]]);
  });

  it("hors jeu (main/défausse) non compté ; 0 Équipement → draw 0 (no-op fidèle)", () => {
    const draw = vi.fn();
    const state = makeState([
      {
        instanceId: "e1",
        controller: "A",
        location: { zone: "defausse" },
        cardId: "equip",
      },
    ]);
    const engine = createEffectEngine(mockDeps(state, { draw }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "Enutrof",
      ops: [
        {
          op: "draw",
          n: 0,
          value: {
            kind: "count",
            of: { source: "controlled", what: "Équipement" },
          },
        },
      ],
    });
    expect(draw.mock.calls).toEqual([["A", 0]]);
  });

  it("filtre de Famille (sub) : ne compte que les Alliés de la Famille visée", () => {
    const draw = vi.fn();
    const state = makeState([
      {
        instanceId: "a1",
        controller: "A",
        location: { zone: "monde" },
        cardId: "ally",
      },
      {
        instanceId: "z1",
        controller: "A",
        location: { zone: "monde" },
        cardId: "zone",
      },
    ]);
    const engine = createEffectEngine(mockDeps(state, { draw }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [
        {
          op: "draw",
          n: 0,
          value: {
            kind: "count",
            of: { source: "controlled", what: "Allié", sub: "Kitsou" },
          },
        },
      ],
    });
    expect(draw.mock.calls).toEqual([["A", 1]]);
  });
});
