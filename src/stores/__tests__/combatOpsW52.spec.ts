/**
 * Intégration store (W52) — ops liés au combat local :
 *  - PROJECTION rulesCtx : le combat LOCAL (ref combat.value, jamais journalisé)
 *    est projeté dans ctx.state.combat → les filtres combatRole prennent vie en
 *    partie locale (bug préexistant corrigé).
 *  - Exclusion (removeFromCombatTarget) : cibler un attaquant le retire du
 *    combat (ref muté) et l'incline.
 *  - Dora (requiresBearerInCombat) : gate d'activation — refusé sans Porteur,
 *    refusé hors combat, accepté quand le Porteur est attaquant du combat
 *    déclaré (et l'inclinaison + la pioche s'exécutent).
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import { createMockEquipmentCard } from "tests/factories/card";
import {
  logText,
  makeEffectSandbox,
  placeInZone,
} from "./effectPipeline.harness";

/** Combat local DÉCLARÉ (step blockers) avec `attackers`, prêt à projeter. */
function declaredCombat(attackers: string[], targetId: string) {
  return {
    step: "blockers" as const,
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

describe("Exclusion — retrait du combat (projection + mutation du ref)", () => {
  it("cible l'attaquant : il quitte combat.attackers et revient incliné", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    const atk = placeInZone(store, "A", { zone: "monde" });
    const heroB = store.state.seats.B.heroInstanceId!;
    store.combat = declaredCombat([atk], heroB);

    store.enqueueEffect({
      seat: "B",
      cardName: "Exclusion",
      ops: [
        {
          op: "removeFromCombatTarget",
          heroes: true,
          combatRole: "inCombat",
          zones: ["monde", "havreSac"],
        },
      ],
    });
    // PROJECTION : l'attaquant du combat local est bien éligible
    expect([...store.effectTargetIdsList]).toEqual([atk]);
    store.effectTargetChoose(atk);
    // retiré du combat + incliné
    expect(store.combat?.attackers).toEqual([]);
    expect(store.state.instances[atk].orientation).toBe("tapped");
  });

  it("ATTAQUANT BLOQUÉ retiré : le bloqueur ORPHELIN n'échange aucun coup mais s'incline au 708.3", () => {
    // Intention tranchée (revue W52) : le bloqueur s'est ENGAGÉ (blocage
    // déclaré) — comme face à un attaquant mort en combat, il ne frappe/subit
    // rien (le duel ignore les blocks orphelins) mais s'incline en fin de
    // combat (708.3). Le retrait ne « dé-déclare » pas le blocage.
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    const atk = placeInZone(store, "A", { zone: "monde" });
    const blk = placeInZone(store, "B", { zone: "monde" });
    const heroB = store.state.seats.B.heroInstanceId!;
    store.combat = {
      ...declaredCombat([atk], heroB),
      blocks: { [blk]: atk },
    };

    store.enqueueEffect({
      seat: "B",
      cardName: "Exclusion",
      ops: [
        {
          op: "removeFromCombatTarget",
          heroes: true,
          combatRole: "inCombat",
          zones: ["monde", "havreSac"],
        },
      ],
    });
    store.effectTargetChoose(atk);
    expect(store.combat?.attackers).toEqual([]);
    // le blocage déclaré reste (orphelin)
    expect(store.combat?.blocks).toEqual({ [blk]: atk });

    store.combatResolve();
    // aucun échange de coups : le bloqueur n'a ni Dommages ni infligé
    expect(store.state.instances[blk].counters.damage ?? 0).toBe(0);
    expect(store.state.instances[atk].counters.damage ?? 0).toBe(0);
    // … mais il s'est engagé → incliné en fin de combat (708.3)
    expect(store.state.instances[blk].orientation).toBe("tapped");
    expect(store.combat).toBeNull();
  });

  it("HORS combat : aucune cible, l'effet passe (pas de pause)", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    placeInZone(store, "A", { zone: "monde" });
    store.enqueueEffect({
      seat: "A",
      cardName: "Exclusion",
      ops: [
        {
          op: "removeFromCombatTarget",
          heroes: true,
          combatRole: "inCombat",
          zones: ["monde", "havreSac"],
        },
      ],
    });
    expect(store.effectTargeting).toBeNull();
    expect(logText(store)).toContain("aucune cible légale");
  });
});

const DORA: Card = createMockEquipmentCard({
  id: "dora-test",
  name: "Dora",
  effects: [
    {
      description:
        "Piochez une carte. N'utilisez ce pouvoir que si le Porteur de la Dora est attaquant ou bloqueur.",
      requiresIncline: true,
    },
  ],
});

describe("Dora — gate d'activation Porteur-en-combat", () => {
  function setup() {
    const { store } = makeEffectSandbox({
      first: "A",
      allAllies: true,
      extraCards: [DORA],
    });
    const bearer = placeInZone(store, "A", { zone: "monde" });
    // matérialise la Dora en jeu : on détourne une instance piochée vers la
    // carte Dora (cardId), attachée au Porteur.
    const doraId = placeInZone(store, "A", { zone: "monde" });
    store.state.instances[doraId].cardId = "dora-test";
    return { store, bearer, doraId };
  }

  it("SANS Porteur : activation refusée, la Dora reste dressée", () => {
    const { store, doraId } = setup();
    expect(store.activateTapPower(doraId)).toBe(false);
    expect(store.ruleError).toContain("Porteur");
    expect(store.state.instances[doraId].orientation).toBe("upright");
  });

  it("Porteur attaché mais HORS combat : refusé (« attaquant ou bloqueur »)", () => {
    const { store, bearer, doraId } = setup();
    store.state.instances[bearer].attachments = [doraId];
    expect(store.activateTapPower(doraId)).toBe(false);
    expect(store.ruleError).toContain("attaquant ou bloqueur");
    expect(store.state.instances[doraId].orientation).toBe("upright");
  });

  it("Porteur ATTAQUANT du combat déclaré : activation OK → inclinaison + pioche", () => {
    const { store, bearer, doraId } = setup();
    store.state.instances[bearer].attachments = [doraId];
    const heroB = store.state.seats.B.heroInstanceId!;
    store.combat = declaredCombat([bearer], heroB);
    const handBefore = store.state.seats.A.main.length;
    expect(store.activateTapPower(doraId)).toBe(true);
    expect(store.state.instances[doraId].orientation).toBe("tapped");
    expect(store.state.seats.A.main.length).toBe(handBefore + 1);
  });
});
