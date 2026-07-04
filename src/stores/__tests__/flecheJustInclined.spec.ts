/**
 * Vague W71 (store) — la confirmation d'attaque pose `justInclined` sur les
 * attaquants qui s'inclinent, ET réinitialise les marques précédentes (Flèche
 * d'Immolation « qui vient de s'incliner »).
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import { createMockActionCard } from "tests/factories/card";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

const FLECHE: Card = createMockActionCard({
  id: "fleche-test",
  name: "Flèche d'Immolation",
  effects: [
    {
      description: "Réaction. …",
      compiled: {
        trigger: "onPlay",
        reactionOnly: true,
        ops: [
          {
            op: "damageTarget",
            n: 2,
            element: "Feu",
            explicitElement: true,
            recentlyInclined: true,
            heroes: true,
            zones: ["monde", "havreSac"],
          },
        ],
      },
    },
  ],
});

function inProgressCombat(attackers: string[], targetId: string) {
  return {
    step: "attackers" as const,
    target: { kind: "hero" as const, instanceId: targetId },
    attackers,
    blocks: {},
    strikes: {},
    strikeFor: null,
    ripostes: {},
    riposteFrom: null,
    riposteCandidates: [],
    pendingBlocker: null,
    reactingSeat: null,
  };
}

describe("Flèche — justInclined posé à la déclaration + réinitialisé", () => {
  it("confirmer l'attaque pose justInclined sur l'attaquant et efface les marques anciennes", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    store.state.turn.number = 3;
    const atk = placeInZone(store, "A", { zone: "monde" });
    const stale = placeInZone(store, "A", { zone: "monde" });
    // marque périmée (d'une déclaration antérieure) à effacer.
    store.state.instances[stale].counters.tokens = { justInclined: 1 };
    const heroB = store.state.seats.B.heroInstanceId!;
    store.combat = inProgressCombat([atk], heroB);

    expect(store.combatConfirmAttackers()).toBe(true);
    // l'attaquant s'incline et est marqué ; la marque périmée est effacée.
    expect(store.state.instances[atk].orientation).toBe("tapped");
    expect(store.state.instances[atk].counters.tokens?.justInclined).toBe(1);
    expect(store.state.instances[stale].counters.tokens?.justInclined).toBe(0);
  });

  it("reactionOnly : Flèche est refusée hors fenêtre de réaction (à son propre tour)", () => {
    const { store } = makeEffectSandbox({
      first: "A",
      allAllies: true,
      extraCards: [FLECHE],
    });
    store.state.turn.number = 3;
    const fId = placeInZone(store, "A", { zone: "main", owner: "A" });
    store.state.instances[fId].cardId = "fleche-test";
    // aucun combat / fenêtre de réaction → refus.
    expect(store.playFromHand(fId)).toBe(false);
    expect(store.ruleError).toContain("réaction");
    expect(store.state.instances[fId].location.zone).toBe("main");
  });
});
