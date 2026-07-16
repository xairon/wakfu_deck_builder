/**
 * CIBLAGE OBLIGATOIRE (P2-10). Un op à cible UNIQUE (« Infligez N Dommages à
 * l'Allié de votre choix ») n'ouvre son picker que si une cible légale existe
 * (sinon fizzle) et l'optionalité « vous pouvez » est déjà tranchée en amont
 * (effectChoices) → l'effet est OBLIGATOIRE : « Passer » ne doit PAS l'esquiver
 * tant qu'une cible demeure. Régression : la frame était librement passable.
 */
import { describe, it, expect, vi } from "vitest";
import { createEffectEngine } from "../engine";
import type { EffectEngineDeps } from "../engine";
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

const DAMAGE_OP = {
  op: "damageTarget" as const,
  n: 2,
  element: "Feu",
  heroes: true,
  zones: ["monde", "havreSac"] as ("monde" | "havreSac")[],
};

const dmg = (f: ReturnType<typeof fixture>, id: string) =>
  ctxOf(f).state.instances[id]?.counters.damage ?? 0;

describe("ciblage obligatoire — « Passer » refusé (P2-10)", () => {
  it("un damageTarget avec une cible légale ne peut pas être passé (picker rouvert)", () => {
    const f = fixture(
      [makeAlly("a0", { force: 5 })],
      [makeAlly("b0", { force: 5 })],
    );
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    bringToMonde(f, "B", instId("B", 0)); // cible adverse légale au Monde
    const engine = createEffectEngine(
      mockDeps(f, (drafts) => dispatch(f, ...(drafts as never[]))),
    );
    engine.enqueueEffect({
      seat: "A",
      cardName: "Boule de Feu",
      ops: [DAMAGE_OP],
    });
    expect(engine.effectTargeting.value?.op.op).toBe("damageTarget");
    // « Passer » avec une cible légale disponible : refusé → le picker reste ouvert.
    engine.effectTargetSkip();
    expect(engine.effectTargeting.value).not.toBeNull();
    expect(dmg(f, instId("B", 0))).toBe(0);
    // Choisir la cible résout normalement.
    engine.effectTargetChoose(instId("B", 0));
    expect(engine.effectTargeting.value).toBeNull();
    expect(dmg(f, instId("B", 0))).toBe(2);
  });

  it("un damageTarget de magnitude 0 fizzle (pas de pick forcé pour 0 dégât) — E3", () => {
    const f = fixture(
      [makeAlly("a0", { force: 5 })],
      [makeAlly("b0", { force: 5 })],
    );
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    bringToMonde(f, "B", instId("B", 0)); // cible légale existe
    const engine = createEffectEngine(
      mockDeps(f, (drafts) => dispatch(f, ...(drafts as never[]))),
    );
    engine.enqueueEffect({
      seat: "A",
      cardName: "Parchemin (X=0)",
      ops: [{ ...DAMAGE_OP, n: 0 }],
    });
    // Magnitude 0 → no-op fidèle : aucun picker n'est ouvert (P2-10 ne force donc
    // pas un clic pour infliger 0), aucun dégât.
    expect(engine.effectTargeting.value).toBeNull();
    expect(dmg(f, instId("B", 0))).toBe(0);
  });
});
