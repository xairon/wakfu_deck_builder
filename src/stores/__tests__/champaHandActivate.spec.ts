/**
 * Intégration store — Champas (pouvoir-main à auto-défausse) : « [Eau],
 * Défaussez le Champa Bleu de votre main : l'Allié ou Héros de votre choix
 * gagne +1 en Force et Tacle jusqu'à la fin du tour. » Activation depuis la
 * MAIN (onHandActivate, W66) : payer la Ressource (incliner un producteur
 * Eau), la carte SE DÉFAUSSE (costDiscardSelf), puis buff ciblé. Coût
 * impayable → rien n'est consommé, le Champa reste en main.
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import { createMockAllyCard } from "tests/factories/card";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

const CHAMPA: Card = createMockAllyCard({
  id: "champa-bleu-test",
  name: "Champa Bleu",
  subTypes: ["Monstre", "Champa"],
  effects: [
    {
      description:
        "[Eau], Défaussez le Champa Bleu de votre main : l'Allié ou Héros de votre choix gagne +1 en Force et Tacle jusqu'à la fin du tour.",
      compiled: {
        trigger: "onHandActivate",
        cost: "paidOps",
        ops: [
          { op: "costTapResource", element: "Eau" },
          { op: "costDiscardSelf" },
          {
            op: "buffForceTarget",
            n: 1,
            heroes: true,
            alsoKeyword: "Tacle",
            zones: ["monde", "havreSac"],
          },
        ],
      },
    },
  ],
});

const PRODUCER: Card = {
  ...createMockAllyCard({
    id: "producer-eau-test",
    name: "Producteur Eau",
    subTypes: ["Monstre"],
  }),
  producesElement: "Eau",
};

function setup(withProducer: boolean) {
  const { store } = makeEffectSandbox({
    first: "A",
    allAllies: true,
    extraCards: [CHAMPA, PRODUCER],
  });
  const champaId = placeInZone(store, "A", { zone: "main", owner: "A" });
  store.state.instances[champaId].cardId = "champa-bleu-test";
  let producerId: string | null = null;
  if (withProducer) {
    producerId = placeInZone(store, "A", { zone: "monde" });
    store.state.instances[producerId].cardId = "producer-eau-test";
  }
  // Une cible de buff (Allié de A dans le Monde).
  const targetId = placeInZone(store, "A", { zone: "monde" });
  return { store, champaId, producerId, targetId };
}

describe("Champa Bleu — activation depuis la main (auto-défausse)", () => {
  it("paie [Eau], se défausse, puis buffe la cible (+1 Force et Tacle)", () => {
    const { store, champaId, producerId, targetId } = setup(true);
    expect(store.hasHandPower(champaId)).toBe(true);
    expect(store.activateTapPower(champaId)).toBe(true);

    // Coût 1 : incliner un producteur Eau.
    expect(store.effectTargeting?.op.op).toBe("costTapResource");
    store.effectTargetChoose(producerId!);
    expect(store.state.instances[producerId!].orientation).toBe("tapped");

    // Coût 2 (auto) : le Champa s'est défaussé lui-même.
    expect(store.state.instances[champaId].location.zone).toBe("defausse");

    // Corps : buff ciblé.
    expect(store.effectTargeting?.op.op).toBe("buffForceTarget");
    store.effectTargetChoose(targetId);
    expect(store.state.instances[targetId].counters.tokens?.forceMod).toBe(1);
    expect(store.state.instances[targetId].counters.tokens?.tacleTurnMod).toBe(
      1,
    );
    expect(store.effectTargeting).toBeNull();
  });

  it("aucun producteur Eau : coût impayable → rien consommé, Champa en main", () => {
    const { store, champaId, targetId } = setup(false);
    expect(store.activateTapPower(champaId)).toBe(true); // enfilé, mais…
    // …le coût-Ressource s'abandonne (aucun producteur Eau) → le Champa
    // n'est PAS défaussé, aucune cible buffée.
    if (store.effectTargeting) store.effectTargetSkip();
    expect(store.state.instances[champaId].location.zone).toBe("main");
    expect(store.state.instances[targetId].counters.tokens?.forceMod ?? 0).toBe(
      0,
    );
  });
});
