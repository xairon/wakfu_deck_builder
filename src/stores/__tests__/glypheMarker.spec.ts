/**
 * Vague W70 (store) — jouer Glyphe Incandescent pose le marqueur flottant
 * `glypheDamage` sur le Héros (onPlay → incHeroTurnToken).
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import { createMockActionCard } from "tests/factories/card";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

const GLYPHE: Card = createMockActionCard({
  id: "glyphe-test",
  name: "Glyphe Incandescent",
  effects: [
    {
      description: "Jusqu'à la fin de la phase d'action, …",
      compiled: {
        trigger: "onPlay",
        ops: [{ op: "incHeroTurnToken", token: "glypheDamage", n: 1 }],
      },
    },
  ],
});

/** Combat local déclaré : `atk` (A) attaque le Héros B, bloqué par `blk` (B). */
function declaredCombat(atk: string, blk: string, heroB: string) {
  return {
    step: "blockers" as const,
    target: { kind: "hero" as const, instanceId: heroB },
    attackers: [atk],
    blocks: { [blk]: atk },
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

describe("Glyphe Incandescent — inclinaison MID-COMBAT (A7, bus « tapped »)", () => {
  it("un BLOQUEUR incliné par un effet pendant le combat subit 2 Dommages", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    store.state.turn.number = 3;
    const heroA = store.state.seats.A.heroInstanceId!;
    store.state.instances[heroA].counters.tokens = { glypheDamage: 1 };
    const atk = placeInZone(store, "A", { zone: "monde" });
    const blk = placeInZone(store, "B", { zone: "monde" });
    const heroB = store.state.seats.B.heroInstanceId!;
    store.combat = declaredCombat(atk, blk, heroB);
    // « Inclinez l'Allié de votre choix » résolu pendant la fenêtre du combat.
    store.enqueueEffect({
      seat: "A",
      cardName: "Piège",
      ops: [{ op: "tapTarget", zones: ["monde"] }],
    });
    store.effectTargetChoose(blk);
    expect(store.state.instances[blk].orientation).toBe("tapped");
    // Le bloqueur « s'incline dans ce combat » → Glyphe lui inflige 2 Dommages.
    expect(store.state.instances[blk].counters.damage).toBe(2);
  });

  it("la même inclinaison HORS combat ne déclenche rien", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    store.state.turn.number = 3;
    const heroA = store.state.seats.A.heroInstanceId!;
    store.state.instances[heroA].counters.tokens = { glypheDamage: 1 };
    const cible = placeInZone(store, "B", { zone: "monde" });
    store.enqueueEffect({
      seat: "A",
      cardName: "Piège",
      ops: [{ op: "tapTarget", zones: ["monde"] }],
    });
    store.effectTargetChoose(cible);
    expect(store.state.instances[cible].orientation).toBe("tapped");
    expect(store.state.instances[cible].counters.damage ?? 0).toBe(0);
  });

  it("une créature HORS du combat inclinée pendant un combat n'est pas touchée", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    store.state.turn.number = 3;
    const heroA = store.state.seats.A.heroInstanceId!;
    store.state.instances[heroA].counters.tokens = { glypheDamage: 1 };
    const atk = placeInZone(store, "A", { zone: "monde" });
    const blk = placeInZone(store, "B", { zone: "monde" });
    const spectateur = placeInZone(store, "B", { zone: "monde" });
    const heroB = store.state.seats.B.heroInstanceId!;
    store.combat = declaredCombat(atk, blk, heroB);
    store.enqueueEffect({
      seat: "A",
      cardName: "Piège",
      ops: [{ op: "tapTarget", zones: ["monde"] }],
    });
    // On incline un Allié NI attaquant NI bloqueur : pas « dans ce combat ».
    store.effectTargetChoose(spectateur);
    expect(store.state.instances[spectateur].orientation).toBe("tapped");
    expect(store.state.instances[spectateur].counters.damage ?? 0).toBe(0);
  });
});

describe("Glyphe Incandescent — marqueur flottant à la mise en jeu", () => {
  it("jouer Glyphe pose glypheDamage=1 sur le Héros ; le rejouer cumule à 2", () => {
    const { store } = makeEffectSandbox({
      first: "A",
      allAllies: true,
      extraCards: [GLYPHE],
    });
    store.state.turn.number = 3;
    const heroA = store.state.seats.A.heroInstanceId!;
    const g1 = placeInZone(store, "A", { zone: "main", owner: "A" });
    store.state.instances[g1].cardId = "glyphe-test";
    store.playFromHand(g1);
    expect(store.state.instances[heroA].counters.tokens?.glypheDamage).toBe(1);
    const g2 = placeInZone(store, "A", { zone: "main", owner: "A" });
    store.state.instances[g2].cardId = "glyphe-test";
    store.playFromHand(g2);
    expect(store.state.instances[heroA].counters.tokens?.glypheDamage).toBe(2);
  });
});
