/**
 * Vague W62 (deck-driven, starter Incarnam Coup Critique) — FORCE DOUBLÉE
 * (magnitude à la résolution) + limite par-cible-par-tour.
 *
 * Coup Critique : « La Force de l'Allié ou Héros de votre choix est doublée
 * jusqu'à la fin du tour. Vous ne pouvez jouer qu'un seul Coup critique sur le
 * même Allié ou Héros par tour. » (scriptée CARD_SCRIPTS, 2 éditions).
 *
 * Deux briques :
 *  1) buffForceTarget{doubleForce} — magnitude = Force EFFECTIVE de la cible AU
 *     MOMENT de la résolution (+Force → total ×2, même en présence d'autres buffs).
 *  2) buffForceTarget{markTurnToken:"coupCritique"} — pose un jeton turn-scoped ;
 *     l'éligibilité exclut la cible déjà marquée ce tour (une seule fois/cible).
 */
import { describe, it, expect, vi } from "vitest";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";
import { effectiveForce } from "../../stats";
import { effectTargetIds } from "../targeting";
import {
  bringToMonde,
  ctxOf,
  dispatch,
  fixture,
  instId,
  makeAlly,
  setTurn,
} from "../../__tests__/harness";

function mockDeps(
  f: ReturnType<typeof fixture>,
  onDispatch: (drafts: unknown[]) => void,
): EffectEngineDeps {
  return {
    getState: () => ctxOf(f).state,
    rulesCtx: () => ctxOf(f) as never,
    getCard: (id: string | null) => ctxOf(f).getCard(id),
    isAssist: () => true,
    isAssistEffects: () => true,
    getMatchPhase: () => "lobby",
    playerName: () => "Joueur",
    paOf: () => 6,
    dispatch: vi.fn((...drafts: unknown[]) => onDispatch(drafts)),
    moveTo: vi.fn(),
    shufflePioche: vi.fn(),
    checkVictory: vi.fn(),
    draw: vi.fn(),
    adjustCounter: vi.fn(),
    onMatchWon: vi.fn(),
  } as unknown as EffectEngineDeps;
}

const OP = {
  op: "buffForceTarget" as const,
  n: 0,
  doubleForce: true,
  markTurnToken: "coupCritique",
  heroes: true,
  zones: ["monde", "havreSac"] as ("monde" | "havreSac")[],
};

describe("Coup Critique — Force doublée + marquage par-cible-par-tour", () => {
  it("double la Force de la cible (3 → 6) et pose le jeton coupCritique", () => {
    const f = fixture([makeAlly("cible", { force: 3 })]);
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    const engine = createEffectEngine(
      mockDeps(f, (drafts) => dispatch(f, ...(drafts as never[]))),
    );
    engine.enqueueEffect({
      seat: "A",
      cardName: "Coup Critique",
      sourceId: instId("A", 0),
      ops: [OP],
    });
    engine.effectTargetChoose(instId("A", 0));
    expect(effectiveForce(ctxOf(f), instId("A", 0))).toBe(6); // 3 + 3 = ×2
    expect(
      ctxOf(f).state.instances[instId("A", 0)].counters.tokens?.coupCritique ??
        0,
    ).toBe(1);
  });

  it("double la Force EFFECTIVE courante (base 3 + buff 2 = 5 → 10)", () => {
    const f = fixture([makeAlly("cible", { force: 3 })]);
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    // buff de tour préexistant : +2 Force (effective 5)
    dispatch(f, {
      actor: "A",
      type: "SET_COUNTER",
      payload: {
        instanceId: instId("A", 0),
        counter: "forceMod",
        value: 2,
        token: true,
      },
    } as never);
    expect(effectiveForce(ctxOf(f), instId("A", 0))).toBe(5);
    const engine = createEffectEngine(
      mockDeps(f, (drafts) => dispatch(f, ...(drafts as never[]))),
    );
    engine.enqueueEffect({
      seat: "A",
      cardName: "Coup Critique",
      sourceId: instId("A", 0),
      ops: [OP],
    });
    engine.effectTargetChoose(instId("A", 0));
    expect(effectiveForce(ctxOf(f), instId("A", 0))).toBe(10); // 5 → ×2
  });

  it("éligibilité : une cible déjà marquée coupCritique ce tour est EXCLUE", () => {
    const f = fixture([
      makeAlly("marquee", { force: 2 }),
      makeAlly("libre", { force: 2 }),
    ]);
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    bringToMonde(f, "A", instId("A", 1), { arrivedTurn: 1 });
    // marque la 1re cible (comme après un 1er Coup Critique)
    dispatch(f, {
      actor: "A",
      type: "SET_COUNTER",
      payload: {
        instanceId: instId("A", 0),
        counter: "coupCritique",
        value: 1,
        token: true,
      },
    } as never);
    const ids = effectTargetIds(ctxOf(f), OP, "A");
    expect(ids).not.toContain(instId("A", 0)); // déjà doublée ce tour
    expect(ids).toContain(instId("A", 1)); // encore éligible
  });
});
