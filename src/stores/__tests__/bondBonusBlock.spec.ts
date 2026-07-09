/**
 * Vague W65 (deck-driven, starter Incarnam Bond) — BLOQUEUR BONUS.
 *
 * Bond : « Placez l'un de vos Alliés ou Héros en bloqueur devant l'Allié ou Héros
 * attaquant de votre choix. » (Action jouée par le défenseur en fenêtre de
 * réaction). Op `grantBonusBlock{n}` : relève de N la limite de bloqueurs du
 * combat (ruling : Bond peut dépasser les PM). Le joueur déclare ensuite le
 * bloqueur via l'UI de blocage habituelle (légalité Agilité conservée).
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
    geantAssign: {},
    geantFor: null,
    geantConfirmed: [] as string[],
    ripostes: {},
    riposteFrom: null,
    riposteCandidates: [],
    pendingBlocker: null,
    reactingSeat: null,
  };
}

describe("Bond — bloqueur bonus au-delà des PM", () => {
  it("PM=1 : 2e bloqueur refusé, puis grantBonusBlock l'autorise", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    const atk = placeInZone(store, "A", { zone: "monde" });
    const blk1 = placeInZone(store, "B", { zone: "monde" });
    const blk2 = placeInZone(store, "B", { zone: "monde" });
    const heroB = store.state.seats.B.heroInstanceId!;
    // limite le défenseur B à 1 PM (1 bloqueur).
    store.state.instances[heroB].counters.pm = 1;
    store.combat = declaredCombat([atk], heroB);

    // 1er bloqueur : 1 attaquant → assigné d'office.
    store.combatToggleBlock(blk1);
    expect(store.combat?.blocks).toEqual({ [blk1]: atk });
    // 2e bloqueur : refusé (limite de PM atteinte).
    store.combatToggleBlock(blk2);
    expect(store.combat?.blocks).toEqual({ [blk1]: atk });
    expect(store.ruleError).toContain("Maximum 1");

    // Bond : accorde 1 bloqueur bonus.
    store.enqueueEffect({
      seat: "B",
      cardName: "Bond",
      ops: [{ op: "grantBonusBlock", n: 1 }],
    });
    expect(store.combat?.bonusBlocks).toBe(1);

    // 2e bloqueur désormais autorisé (limite = PM 1 + bonus 1 = 2).
    store.combatToggleBlock(blk2);
    expect(store.combat?.blocks).toEqual({ [blk1]: atk, [blk2]: atk });
  });

  it("hors combat : grantBonusBlock est un no-op fidèle (aucun crash)", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    store.enqueueEffect({
      seat: "A",
      cardName: "Bond",
      ops: [{ op: "grantBonusBlock", n: 1 }],
    });
    expect(store.combat).toBeNull();
  });
});
