/**
 * Vague W39 (deck-driven, starter Incarnam Flétrissement) — COÛT DE DÉFAUSSE
 * « Défaussez [jusqu'à] N carte(s) : CORPS » (op costDiscard). Miroir de
 * costRecycle mais pile = MAIN, action = discard (→ Défausse). « jusqu'à N » →
 * max (0..N, boundCount = compte réel, lu par les ops fromCount du corps).
 */
import { describe, it, expect, vi } from "vitest";
import type { GameState } from "@/game";
import { compileTapEffectText } from "../dsl";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";

describe("DSL — coût de défausse « Défaussez jusqu'à N : le même nombre »", () => {
  it("Flétrissement → costDiscard{max} + damageTarget{fromCount}", () => {
    const c = compileTapEffectText(
      "Défaussez jusqu'à 3 cartes : Infligez le même nombre de Dommages à l'Allié ou Héros de votre choix.",
      "Flétrissement",
      "Feu",
      true, // Action → onPlay
    );
    expect(c?.cost).toBe("paidOps");
    expect(c?.trigger).toBe("onPlay");
    expect(c?.ops[0]).toEqual({ op: "costDiscard", n: 3, max: true });
    expect(c?.ops[1]).toMatchObject({
      op: "damageTarget",
      n: 0,
      fromCount: true,
      element: "Feu",
      heroes: true,
    });
  });

  it("forme imposée « Défaussez 2 cartes : … » (sans « jusqu'à ») → costDiscard sans max", () => {
    const c = compileTapEffectText(
      "Défaussez 2 cartes : Votre Héros regagne X PV.",
      "Test",
      "Neutre",
      true,
    );
    expect(c?.ops[0]).toEqual({ op: "costDiscard", n: 2 });
  });
});

// ── Moteur : chemin « main vide » du coût max (boundCount 0, corps no-op) ──
function makeState(handLen: number): GameState {
  return {
    turn: { active: "A", number: 1 },
    instances: { "hero-A": { instanceId: "hero-A", orientation: "upright" } },
    seats: {
      A: {
        main: Array.from({ length: handLen }, (_, i) => `c${i}`),
        pioche: [],
        defausse: [],
        heroInstanceId: "hero-A",
      },
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

describe("createEffectEngine — costDiscard{max} main vide", () => {
  it("main vide : boundCount 0, le corps (heroGainPv fromCount) applique 0 (no-op fidèle)", () => {
    const adjustCounter = vi.fn();
    const engine = createEffectEngine(
      mockDeps(makeState(0), { adjustCounter }),
    );
    engine.enqueueEffect({
      seat: "A",
      cardName: "Flétrissement",
      ops: [
        { op: "costDiscard", n: 3, max: true },
        { op: "heroGainPv", n: 0, fromCount: true },
      ],
    });
    // 0 défaussée → heroGainPv 0 → adjustCounter jamais appelé avec un montant.
    expect(adjustCounter).not.toHaveBeenCalled();
  });
});
