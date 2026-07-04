/**
 * Intégration store (W74) — ÉCHEC CRITIQUE : fenêtre d'annulation (pile de
 * résolution profondeur 1). Quand un joueur joue une Action/pouvoir à effets et
 * que l'adversaire tient Échec Critique (local), les effets sont mis EN ATTENTE ;
 * l'adversaire peut jouer Échec Critique (annule) ou passer (les effets se
 * résolvent). Borné : la fenêtre ne s'ouvre QUE si l'adversaire tient Échec
 * Critique → pas de régression sur les parties sans contre-sort.
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import { createMockActionCard, createMockAllyCard } from "tests/factories/card";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

/** Action à effet observable : le Héros du lanceur gagne 1 XP. */
const BOLT: Card = createMockActionCard({
  id: "bolt-test",
  name: "Éclair",
  effects: [
    {
      description: "Gagnez 1 XP.",
      compiled: { trigger: "onPlay", ops: [{ op: "gainXp", n: 1 }] },
    },
  ],
});

/** Allié avec un pouvoir à inclinaison à effet observable (Héros gagne 1 XP). */
const TAPPER: Card = createMockAllyCard({
  id: "tapper-test",
  name: "Tapoteur",
  effects: [
    {
      description: "Inclinez : Gagnez 1 XP.",
      compiled: { trigger: "onTap", ops: [{ op: "gainXp", n: 1 }] },
    },
  ],
});

/** Échec Critique factice : réaction d'annulation (op cancelLastPlayed). */
const ECHEC: Card = createMockActionCard({
  id: "echec-test",
  name: "Échec Critique",
  effects: [
    {
      description: "Annulez les effets de la carte qui vient d'être jouée.",
      compiled: {
        trigger: "onPlay",
        reactionOnly: true,
        ops: [{ op: "cancelLastPlayed" }],
      },
    },
  ],
});

function setup(opponentHasEchec = true) {
  const { store } = makeEffectSandbox({
    first: "A",
    allAllies: true,
    extraCards: [BOLT, ECHEC, TAPPER],
  });
  store.state.turn.number = 3;
  const heroA = store.state.seats.A.heroInstanceId!;
  const xp = () => store.state.instances[heroA].counters.xp ?? 0;
  const boltId = placeInZone(store, "A", { zone: "main", owner: "A" });
  store.state.instances[boltId].cardId = "bolt-test";
  let echecId = "";
  if (opponentHasEchec) {
    echecId = placeInZone(store, "B", { zone: "main", owner: "B" });
    store.state.instances[echecId].cardId = "echec-test";
  }
  return { store, boltId, echecId, xp };
}

describe("Échec Critique — fenêtre d'annulation", () => {
  it("jouer une Action quand l'adversaire tient Échec ⇒ effets EN ATTENTE (perspective à l'adversaire)", () => {
    const { store, boltId, xp } = setup();
    expect(store.playFromHand(boltId)).toBe(true);
    // effets non résolus (en attente) ; l'adversaire reçoit la main.
    expect(xp()).toBe(0);
    expect(store.pendingResolution?.reactor).toBe("B");
    expect(store.perspective).toBe("B");
  });

  it("l'adversaire joue Échec Critique ⇒ effets ANNULÉS (jamais résolus)", () => {
    const { store, boltId, echecId, xp } = setup();
    store.playFromHand(boltId);
    expect(store.playFromHand(echecId)).toBe(true);
    expect(xp()).toBe(0); // annulé
    expect(store.pendingResolution).toBeNull();
    expect(store.perspective).toBe("A");
    expect(store.state.instances[echecId].location.zone).toBe("defausse");
  });

  it("l'adversaire PASSE ⇒ les effets en attente se résolvent", () => {
    const { store, boltId, xp } = setup();
    store.playFromHand(boltId);
    expect(store.passPendingResolution()).toBe(true);
    expect(xp()).toBe(1); // résolu
    expect(store.pendingResolution).toBeNull();
    expect(store.perspective).toBe("A");
  });

  it("sans Échec dans la main adverse ⇒ résolution IMMÉDIATE (aucune fenêtre)", () => {
    const { store, boltId, xp } = setup(false);
    expect(store.playFromHand(boltId)).toBe(true);
    expect(xp()).toBe(1);
    expect(store.pendingResolution).toBeNull();
  });

  it("annule aussi un POUVOIR (« Action, Sort ou pouvoir ») : tap-power mis en attente puis annulé", () => {
    const { store, echecId, xp } = setup();
    // un Allié avec pouvoir à inclinaison, en jeu et dressé, contrôlé par A.
    const tapperId = placeInZone(store, "A", { zone: "monde" });
    store.state.instances[tapperId].cardId = "tapper-test";
    store.state.instances[tapperId].orientation = "upright";
    expect(store.activateTapPower(tapperId)).toBe(true);
    // effet du pouvoir en attente (l'adversaire tient Échec).
    expect(xp()).toBe(0);
    expect(store.pendingResolution?.reactor).toBe("B");
    store.playFromHand(echecId); // annule le pouvoir
    expect(xp()).toBe(0);
    expect(store.pendingResolution).toBeNull();
  });

  it("Échec Critique est INJOUABLE hors fenêtre (reactionOnly)", () => {
    const { store, echecId } = setup();
    // aucune fenêtre ouverte : jouer Échec directement est refusé.
    expect(store.playFromHand(echecId)).toBe(false);
    expect(store.ruleError).toContain("réaction");
    expect(store.state.instances[echecId].location.zone).toBe("main");
  });
});
