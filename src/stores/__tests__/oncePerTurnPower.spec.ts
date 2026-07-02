/**
 * Activation store (W40) — verrou once-per-turn (`powerUses0`) et coût composé
 * inclinaison+défausse (`tapsSource`) sur les pouvoirs à coût de défausse.
 * Par l'API publique du store (pattern createToken.spec : extraCards +
 * réassignation du cardId de l'instance placée).
 */
import { describe, it, expect } from "vitest";
import {
  makeEffectSandbox,
  placeInZone,
  counters,
  createMockAllyCard,
} from "./effectPipeline.harness";
import { createMockEquipmentCard } from "tests/factories/card";

const BWORK = createMockAllyCard({
  id: "bwork-test",
  name: "Bwork Mage",
  effects: [
    {
      description:
        "Défaussez une carte : Le Bwork Mage inflige 1 Dommage à l'Allié ou Héros de votre choix. N'utilisez ce pouvoir qu'une seule fois par tour.",
      requiresIncline: false,
    },
  ],
});

describe("activateTapPower — verrou once-per-turn (Bwork Mage)", () => {
  it("1re activation OK (jeton powerUses0 posé, source NON inclinée) ; 2e refusée", () => {
    const { store } = makeEffectSandbox({
      extraCards: [BWORK],
      allAllies: true,
    });
    const src = placeInZone(store, "A", { zone: "monde" });
    store.state.instances[src].cardId = "bwork-test";
    store.draw("A", 2); // de quoi payer la défausse
    expect(store.hasTapPower(src)).toBe(true);

    expect(store.activateTapPower(src)).toBe(true);
    expect(counters(store, src).tokens.powerUses0).toBe(1);
    // Pouvoir non-tap : la source reste dressée (le verrou est le jeton).
    expect(store.state.instances[src].orientation).toBe("upright");

    // Réactivation le même tour → refusée par le verrou.
    expect(store.activateTapPower(src)).toBe(false);
  });

  it("coût de défausse IMPOSÉ impayable (main vide) : refus SANS poser le jeton", () => {
    const { store } = makeEffectSandbox({
      extraCards: [BWORK],
      allAllies: true,
    });
    const src = placeInZone(store, "A", { zone: "monde" });
    store.state.instances[src].cardId = "bwork-test";
    // main vide (placeInZone a déplacé la seule carte piochée hors main)
    expect(store.state.seats.A.main.length).toBe(0);
    expect(store.activateTapPower(src)).toBe(false);
    expect(counters(store, src).tokens.powerUses0 ?? 0).toBe(0);
  });
});

const AMULETTE = createMockEquipmentCard({
  id: "amulette-test",
  name: "Amulette Akwadala",
  effects: [
    {
      description: "Défaussez une carte : Piochez une carte.",
      requiresIncline: true,
    },
  ],
});

describe("activateTapPower — coût composé inclinaison+défausse (Amulette)", () => {
  it("l'activation INCLINE la source (tapsSource) puis ouvre le pick de défausse ; réactivation refusée (inclinée)", () => {
    const { store } = makeEffectSandbox({
      extraCards: [AMULETTE],
      allAllies: true,
    });
    const src = placeInZone(store, "A", { zone: "monde" });
    store.state.instances[src].cardId = "amulette-test";
    store.draw("A", 2);

    expect(store.activateTapPower(src)).toBe(true);
    // Inclinaison composée (requiresIncline + paidOps).
    expect(store.state.instances[src].orientation).toBe("tapped");
    // Coût interactif : le pick de défausse est ouvert.
    expect(store.effectPicking?.zone).toBe("main");

    // Déjà inclinée → refus.
    expect(store.activateTapPower(src)).toBe(false);
  });
});
