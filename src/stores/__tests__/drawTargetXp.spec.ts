/**
 * Intégration store (W42) — drawTargetXp : choisir un Allié en jeu, piocher sa
 * valeur d'XP (card.experience). API publique du store.
 */
import { describe, it, expect } from "vitest";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";
import { createMockAllyCard } from "tests/factories/card";

describe("drawTargetXp — pioche = valeur d'XP de la cible choisie", () => {
  it("cible d'XP 3 → l'acteur pioche 3 cartes", () => {
    const target = createMockAllyCard({
      id: "cible-xp3",
      name: "Grosse Cible",
      experience: 3,
    });
    const { store } = makeEffectSandbox({
      extraCards: [target],
      allAllies: true,
      first: "A",
    });
    const tid = placeInZone(store, "B", { zone: "monde" });
    store.state.instances[tid].cardId = "cible-xp3";
    const handBefore = store.state.seats.A.main.length;

    store.enqueueEffect({
      seat: "A",
      cardName: "Prospection",
      ops: [{ op: "drawTargetXp", zones: ["monde"] }],
    });
    expect(store.effectTargeting).not.toBeNull();
    store.effectTargetChoose(tid);

    expect(store.state.seats.A.main.length).toBe(handBefore + 3);
    expect(store.effectTargeting).toBeNull();
  });
});
