/**
 * Tests d'ISOLATION du moteur d'effets : `createEffectEngine` tourne SANS
 * Pinia ni store — uniquement des dépendances mockées (vi.fn). Prouve que
 * l'inversion de dépendances est réelle : chaque op route vers la bonne
 * dépendance injectée, sans accès au store.
 */
import { describe, it, expect, vi } from "vitest";
import type { GameState } from "@/game";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";

/** État minimal suffisant pour le routage des ops testées (cast volontaire). */
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
    // "lobby" : neutralise enforceHandLimit (pas de besoin d'état profond)
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

describe("createEffectEngine — isolation (deps injectées, sans store)", () => {
  it("op draw : route vers deps.draw avec (seat, n)", () => {
    const draw = vi.fn();
    const engine = createEffectEngine(mockDeps({ draw }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "draw", n: 2 }],
    });
    expect(draw).toHaveBeenCalledWith("A", 2);
  });

  it("op shuffleDeck : route vers deps.shufflePioche(seat)", () => {
    const shufflePioche = vi.fn();
    const engine = createEffectEngine(mockDeps({ shufflePioche }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "shuffleDeck" }],
    });
    expect(shufflePioche).toHaveBeenCalledWith("A");
  });

  it("op heroGainPv : route vers deps.adjustCounter(heroId, 'hp', n)", () => {
    const adjustCounter = vi.fn();
    const engine = createEffectEngine(mockDeps({ adjustCounter }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "heroGainPv", n: 3 }],
    });
    expect(adjustCounter).toHaveBeenCalledWith("hero-A", "hp", 3);
  });

  it("op damageOppHero : cible le Héros adverse via deps.adjustCounter", () => {
    const adjustCounter = vi.fn();
    const engine = createEffectEngine(mockDeps({ adjustCounter }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "damageOppHero", n: 2 }],
    });
    expect(adjustCounter).toHaveBeenCalledWith("hero-B", "hp", -2);
  });

  it("FIFO : deux effets enfilés routent deux draws dans l'ordre", () => {
    const draw = vi.fn();
    const engine = createEffectEngine(mockDeps({ draw }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "E1",
      ops: [{ op: "draw", n: 1 }],
    });
    engine.enqueueEffect({
      seat: "B",
      cardName: "E2",
      ops: [{ op: "draw", n: 1 }],
    });
    expect(draw.mock.calls).toEqual([
      ["A", 1],
      ["B", 1],
    ]);
  });

  it("ciblage sans cible légale (instances vides) : auto-passé, pas de ciblage", () => {
    const engine = createEffectEngine(mockDeps());
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "destroyTarget", what: "Allié", zones: ["monde"] }],
    });
    expect(engine.effectTargeting.value).toBeNull();
    expect(engine.effectQueue.value.length).toBe(0);
  });

  it("file vidée : pumpEffects appelle deps.checkVictory", () => {
    const checkVictory = vi.fn();
    const engine = createEffectEngine(mockDeps({ checkVictory }));
    engine.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "draw", n: 1 }],
    });
    expect(checkVictory).toHaveBeenCalled();
  });

  it("reset : vide la file et les interactions", () => {
    const engine = createEffectEngine(mockDeps());
    engine.effectQueue.value = [{ seat: "A", cardName: "X", ops: [] }];
    engine.reset();
    expect(engine.effectQueue.value).toEqual([]);
    expect(engine.effectTargeting.value).toBeNull();
    expect(engine.effectPicking.value).toBeNull();
  });
});
