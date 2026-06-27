/**
 * Tests d'ISOLATION du moteur d'effets pour la tranche W7 (ops Héros/adversaire
 * déterministes). Mêmes principes que engine.spec.ts : deps mockées, on assert
 * les events/draws exacts émis.
 */
import { describe, it, expect, vi } from "vitest";
import type { GameState } from "@/game";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";

function makeState(
  heroOrientation: "upright" | "tapped" = "tapped",
): GameState {
  return {
    turn: { active: "A", number: 1 },
    instances: {
      "hero-A": { instanceId: "hero-A", orientation: heroOrientation },
      "hero-B": { instanceId: "hero-B", orientation: "upright" },
    },
    seats: {
      A: { main: [], pioche: [], defausse: [], heroInstanceId: "hero-A" },
      B: { main: [], pioche: [], defausse: [], heroInstanceId: "hero-B" },
    },
  } as unknown as GameState;
}

function mockDeps(
  state: GameState,
  over: Partial<EffectEngineDeps> = {},
): EffectEngineDeps {
  return {
    getState: () => state,
    rulesCtx: () => ({ state, getCard: () => null }),
    getCard: () => null,
    isAssist: () => true,
    isAssistEffects: () => true,
    getMatchPhase: () => "lobby",
    playerName: (s) => `Joueur ${s}`,
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

describe("createEffectEngine — ops Héros/adversaire (W7)", () => {
  it("eachPlayerDraws : draw joueur actif PUIS adversaire", () => {
    const draw = vi.fn();
    const engine = createEffectEngine(mockDeps(makeState(), { draw }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "eachPlayerDraws", n: 1 }],
    });
    expect(draw.mock.calls).toEqual([
      ["A", 1],
      ["B", 1],
    ]);
  });

  it("oppLoseStatTurn (pa) : INC_COUNTER paMod -n sur le Héros adverse (token)", () => {
    const dispatch = vi.fn();
    const engine = createEffectEngine(mockDeps(makeState(), { dispatch }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "oppLoseStatTurn", stat: "pa", n: 1 }],
    });
    expect(dispatch).toHaveBeenCalled();
    const incEvent = dispatch.mock.calls
      .flat()
      .find((e) => e?.type === "INC_COUNTER");
    expect(incEvent).toMatchObject({
      actor: "B",
      type: "INC_COUNTER",
      payload: {
        instanceId: "hero-B",
        counter: "paMod",
        delta: -1,
        token: true,
      },
    });
  });

  it("oppLoseStatTurn (pm) : counter pmMod", () => {
    const dispatch = vi.fn();
    const engine = createEffectEngine(mockDeps(makeState(), { dispatch }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "oppLoseStatTurn", stat: "pm", n: 2 }],
    });
    const incEvent = dispatch.mock.calls
      .flat()
      .find((e) => e?.type === "INC_COUNTER");
    expect(incEvent.payload).toMatchObject({
      instanceId: "hero-B",
      counter: "pmMod",
      delta: -2,
      token: true,
    });
  });

  it("buffForceHeroSelf : INC_COUNTER forceMod +n (token) sur VOTRE Héros", () => {
    const dispatch = vi.fn();
    const engine = createEffectEngine(mockDeps(makeState(), { dispatch }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "buffForceHeroSelf", n: 2 }],
    });
    const incEvent = dispatch.mock.calls
      .flat()
      .find((e) => e?.type === "INC_COUNTER");
    expect(incEvent).toMatchObject({
      actor: "A",
      payload: {
        instanceId: "hero-A",
        counter: "forceMod",
        delta: 2,
        token: true,
      },
    });
  });

  it("untapHeroSelf : SET_ORIENTATION upright quand le Héros est incliné", () => {
    const dispatch = vi.fn();
    const engine = createEffectEngine(
      mockDeps(makeState("tapped"), { dispatch }),
    );
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "untapHeroSelf" }],
    });
    const ev = dispatch.mock.calls
      .flat()
      .find((e) => e?.type === "SET_ORIENTATION");
    expect(ev).toMatchObject({
      actor: "A",
      payload: { instanceId: "hero-A", orientation: "upright" },
    });
  });

  it("untapHeroSelf : NO-OP quand le Héros est déjà dressé", () => {
    const dispatch = vi.fn();
    const engine = createEffectEngine(
      mockDeps(makeState("upright"), { dispatch }),
    );
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "untapHeroSelf" }],
    });
    const ev = dispatch.mock.calls
      .flat()
      .find((e) => e?.type === "SET_ORIENTATION");
    expect(ev).toBeUndefined();
  });
});
