/**
 * Régressions issues de l'audit règles/combos (2026-07-06) :
 *  1. `endTurn` refuse de finir le tour tant qu'un EFFET est en cours de
 *     résolution (ciblage/pioche-choix/choix/Porteur) — sinon l'état du moteur
 *     fuit dans le tour suivant (buff appliqué après la purge des jetons de tour).
 *  2. Agilité (704) : à l'assignation multi-attaquants (`combatChooseBlockTarget`),
 *     un attaquant possédant Agilité ne peut être bloqué que par un bloqueur
 *     possédant Agilité — la validation à la mise en attente ne testait que la cible.
 */
import { describe, it, expect } from "vitest";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

function declaredCombat(attackers: string[], targetId: string) {
  return {
    step: "blockers" as const,
    target: { kind: "hero" as const, instanceId: targetId },
    attackers,
    blocks: {} as Record<string, string>,
    strikes: {},
    strikeFor: null,
    ripostes: {},
    riposteFrom: null,
    riposteCandidates: [],
    pendingBlocker: null,
    reactingSeat: null,
  };
}

describe("audit — endTurn bloque tant qu'un effet est en cours", () => {
  it("refuse « Fin du tour » pendant un ciblage d'effet (pas de fuite inter-tour)", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    // Une cible en jeu pour que buffForceTarget ouvre bien le ciblage.
    placeInZone(store, "A", { zone: "monde" });
    const turnBefore = store.state.turn.number;
    store.enqueueEffect({
      seat: "A",
      cardName: "Buff",
      ops: [{ op: "buffForceTarget", n: 2, heroes: true, zones: ["monde"] }],
    });
    // Le ciblage est ouvert (effet en attente d'une cible).
    expect(store.effectTargeting).not.toBeNull();

    store.endTurn();
    // Tour NON avancé + ciblage toujours ouvert + message d'erreur.
    expect(store.state.turn.number).toBe(turnBefore);
    expect(store.effectTargeting).not.toBeNull();
    expect(store.ruleError).toContain("effet en cours");
  });
});

describe("audit — damageOppHero{isDamage} passe par la prévention (Trêve)", () => {
  it("de vrais Dommages au Héros adverse sont absorbés par une Trêve active ; une perte de PV directe non", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    const heroB = store.state.seats.B.heroInstanceId!;
    const hp0 = store.state.instances[heroB].counters.hp ?? 0;
    // Trêve active (jeton treveUntilTurn > tour courant) → activeGlobalMods renvoie treve.
    store.state.instances[heroB].counters.tokens = {
      ...(store.state.instances[heroB].counters.tokens ?? {}),
      treveUntilTurn: store.state.turn.number + 1,
    };

    // VRAIS Dommages : absorbés par la Trêve (PV inchangés).
    store.enqueueEffect({
      seat: "A",
      cardName: "Sort",
      ops: [{ op: "damageOppHero", n: 3, isDamage: true }],
    });
    expect(store.state.instances[heroB].counters.hp).toBe(hp0);

    // Perte de PV DIRECTE (410.3) : ne passe pas par la prévention → −3.
    store.enqueueEffect({
      seat: "A",
      cardName: "Sort",
      ops: [{ op: "damageOppHero", n: 3 }],
    });
    expect(store.state.instances[heroB].counters.hp).toBe(hp0 - 3);
  });
});

describe("audit — Agilité (704) à l'assignation du bloqueur", () => {
  it("un bloqueur sans Agilité ne peut pas être assigné à un attaquant Agilité", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    const atkAgi = placeInZone(store, "A", { zone: "monde" });
    const atkPlain = placeInZone(store, "A", { zone: "monde" });
    const blk = placeInZone(store, "B", { zone: "monde" });
    const heroB = store.state.seats.B.heroInstanceId!;

    // Donne Agilité à l'attaquant atkAgi (jeton de tour agiliteTurnMod via l'op).
    store.enqueueEffect({
      seat: "A",
      cardName: "Agilité",
      sourceId: atkAgi,
      ops: [{ op: "grantKeywordSelf", keyword: "Agilité" }],
    });

    store.combat = declaredCombat([atkAgi, atkPlain], heroB);

    // Multi-attaquants → le bloqueur est mis en attente (pas d'auto-assign).
    store.combatToggleBlock(blk);
    expect(store.combat?.pendingBlocker).toBe(blk);

    // Tentative d'assigner le bloqueur (sans Agilité) à l'attaquant Agilité → REFUS.
    store.combatChooseBlockTarget(atkAgi);
    expect(store.combat?.blocks).toEqual({});
    expect(store.combat?.pendingBlocker).toBe(blk);
    expect(store.ruleError).toContain("Agilité");

    // Assigner au SECOND attaquant (sans Agilité) → autorisé.
    store.combatChooseBlockTarget(atkPlain);
    expect(store.combat?.blocks).toEqual({ [blk]: atkPlain });
  });
});
