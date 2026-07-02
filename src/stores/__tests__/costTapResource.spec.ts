/**
 * Intégration store (W45) — coût « payer une Ressource » (costTapResource) :
 * le pouvoir met en pause sur le ciblage d'un PRODUCTEUR (carte contrôlée
 * dressée), l'incline au paiement (SET_ORIENTATION), puis exécute le corps
 * (pioche). Cas vedette : le SELF-PAY du Smare — le Smare, déjà en jeu et dressé
 * à son apparition, figure parmi ses propres producteurs et peut donc s'incliner
 * pour payer son propre pouvoir (ruling in-data). Décliner (skip) = pas de pioche.
 */
import { describe, it, expect } from "vitest";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

const SMARE_OPS = [
  { op: "costTapResource" as const },
  { op: "draw" as const, n: 1 },
];

describe("costTapResource — payer une Ressource en inclinant un producteur", () => {
  it("SELF-PAY : le Smare peut s'incliner pour payer, puis pioche", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    // Le Smare est en jeu, dressé → il est l'un de ses propres producteurs.
    const smareId = placeInZone(store, "A", { zone: "monde" });

    store.enqueueEffect({
      seat: "A",
      cardName: "Smare",
      sourceId: smareId,
      ops: SMARE_OPS,
    });

    // pause sur le ciblage du coût ; le Smare figure parmi les cibles éligibles
    expect(store.effectTargeting?.op.op).toBe("costTapResource");
    expect([...store.effectTargetIdsList]).toContain(smareId);

    const handBefore = store.state.seats.A.main.length;
    store.effectTargetChoose(smareId);

    // le Smare s'est incliné (production) …
    expect(store.state.instances[smareId].orientation).toBe("tapped");
    // … puis le corps a pioché 1 carte.
    expect(store.state.seats.A.main.length).toBe(handBefore + 1);
    expect(store.effectTargeting).toBeNull();
  });

  it("peut payer avec un AUTRE producteur (le Héros), pas seulement soi-même", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    const smareId = placeInZone(store, "A", { zone: "monde" });
    const heroId = store.state.seats.A.heroInstanceId!;

    store.enqueueEffect({
      seat: "A",
      cardName: "Smare",
      sourceId: smareId,
      ops: SMARE_OPS,
    });
    // le Héros (producteur) est une cible valide du coût
    expect([...store.effectTargetIdsList]).toContain(heroId);

    const handBefore = store.state.seats.A.main.length;
    store.effectTargetChoose(heroId);

    expect(store.state.instances[heroId].orientation).toBe("tapped");
    // le Smare, lui, reste dressé (ce n'est pas lui qu'on a incliné)
    expect(store.state.instances[smareId].orientation).toBe("upright");
    expect(store.state.seats.A.main.length).toBe(handBefore + 1);
  });

  it("DÉCLINER (skip) : « vous pouvez payer » → si on ne paie pas, pas de pioche", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    const smareId = placeInZone(store, "A", { zone: "monde" });

    store.enqueueEffect({
      seat: "A",
      cardName: "Smare",
      sourceId: smareId,
      ops: SMARE_OPS,
    });
    expect(store.effectTargeting).not.toBeNull();

    const handBefore = store.state.seats.A.main.length;
    store.effectTargetSkip();

    // aucun producteur incliné, aucune carte piochée
    expect(store.state.instances[smareId].orientation).toBe("upright");
    expect(store.state.seats.A.main.length).toBe(handBefore);
    expect(store.effectTargeting).toBeNull();
  });
});
