/**
 * Vague W63 (deck-driven, starter Incarnam Colère de Iop) — RÉPARTITION LIBRE
 * DE DÉGÂTS.
 *
 * Colère de Iop : « inflige X Dommages répartis librement entre les Alliés ou
 * Héros attaquants ou bloqueurs de votre choix. » (Action à coût variable X ;
 * scriptée CARD_SCRIPTS : costPayX + distributeDamage{element:Terre}).
 *
 * Op `distributeDamage` : X points assignés un par un aux cibles de combat
 * (répétables), ACCUMULÉS puis appliqués EN BLOC (fidèle au ruling « répartition
 * au moment où le joueur joue le Sort »). Élément = imprimé (Terre). X=0 = no-op.
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
  setCombatState,
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
  op: "distributeDamage" as const,
  element: "Terre",
  heroes: true,
  combatRole: "inCombat" as const,
  zones: ["monde", "havreSac"] as ("monde" | "havreSac")[],
  fromCount: true,
};

/** Combat déclaré : A attaque avec deux Alliés (tous deux cibles éligibles). */
function combatFixture(force = 5) {
  const f = fixture([makeAlly("atk0", { force }), makeAlly("atk1", { force })]);
  setTurn(f, "A", 3);
  // amène les deux Alliés dans le Monde puis déclare le combat
  bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
  bringToMonde(f, "A", instId("A", 1), { arrivedTurn: 1 });
  setCombatState(f, "A", { attackers: [instId("A", 0), instId("A", 1)] });
  return f;
}

const dmg = (f: ReturnType<typeof fixture>, id: string) =>
  ctxOf(f).state.instances[id]?.counters.damage ?? 0;

describe("distributeDamage — Colère de Iop", () => {
  it("répartit X=3 (2 sur atk0, 1 sur atk1) et applique EN BLOC", () => {
    const f = combatFixture(5);
    const engine = createEffectEngine(
      mockDeps(f, (drafts) => dispatch(f, ...(drafts as never[]))),
    );
    engine.enqueueEffect({
      seat: "A",
      cardName: "Colère de Iop",
      ops: [OP],
      boundCount: 3,
    } as never);
    expect(engine.effectTargeting.value?.op.op).toBe("distributeDamage");
    engine.effectTargetChoose(instId("A", 0)); // +1 atk0
    engine.effectTargetChoose(instId("A", 0)); // +1 atk0 (répétable)
    engine.effectTargetChoose(instId("A", 1)); // +1 atk1 → 3e point → application
    expect(engine.effectTargeting.value).toBeNull();
    expect(dmg(f, instId("A", 0))).toBe(2);
    expect(dmg(f, instId("A", 1))).toBe(1);
  });

  it("X=0 → aucun ciblage n'ouvre (no-op fidèle, jouable hors combat)", () => {
    const f = combatFixture(5);
    const engine = createEffectEngine(
      mockDeps(f, (drafts) => dispatch(f, ...(drafts as never[]))),
    );
    engine.enqueueEffect({
      seat: "A",
      cardName: "Colère de Iop",
      ops: [OP],
      boundCount: 0,
    } as never);
    expect(engine.effectTargeting.value).toBeNull();
    expect(dmg(f, instId("A", 0))).toBe(0);
  });

  it("« Passer » est ILLÉGAL tant qu'il reste des points et des cibles (répartition obligatoire)", () => {
    const f = combatFixture(5);
    const engine = createEffectEngine(
      mockDeps(f, (drafts) => dispatch(f, ...(drafts as never[]))),
    );
    engine.enqueueEffect({
      seat: "A",
      cardName: "Colère de Iop",
      ops: [OP],
      boundCount: 3,
    } as never);
    engine.effectTargetChoose(instId("A", 0)); // 1 point assigné, reste 2
    engine.effectTargetSkip(); // IGNORÉ (des points + cibles restent)
    expect(engine.effectTargeting.value?.op.op).toBe("distributeDamage");
    expect(engine.effectTargeting.value?.multi?.remaining).toBe(2);
    // aucun Dommage appliqué tant que la répartition n'est pas complète
    expect(dmg(f, instId("A", 0))).toBe(0);
    // on complète : les 3 points partent en bloc (3 sur atk0)
    engine.effectTargetChoose(instId("A", 0));
    engine.effectTargetChoose(instId("A", 0));
    expect(engine.effectTargeting.value).toBeNull();
    expect(dmg(f, instId("A", 0))).toBe(3);
  });

  it("concentration létale : 2 points sur un Allié de Force 2 → détruit", () => {
    const f = combatFixture(2);
    const engine = createEffectEngine(
      mockDeps(f, (drafts) => dispatch(f, ...(drafts as never[]))),
    );
    engine.enqueueEffect({
      seat: "A",
      cardName: "Colère de Iop",
      ops: [OP],
      boundCount: 2,
    } as never);
    engine.effectTargetChoose(instId("A", 0));
    engine.effectTargetChoose(instId("A", 0)); // 2 Dommages sur Force 2 → létal
    // détruit → quitte le Monde (Défausse)
    expect(ctxOf(f).state.instances[instId("A", 0)]?.location.zone).toBe(
      "defausse",
    );
  });
});
