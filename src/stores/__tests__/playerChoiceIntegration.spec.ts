/**
 * Verrou A4 (CDC) — le CIBLAGE-JOUEUR générique est câblé de bout en bout
 * (W26) : une Action imprimée « Le joueur de votre choix perd 1 PA jusqu'à la
 * fin du tour. » compile, ouvre un ciblage de Héros (les DEUX contrôleurs,
 * Héros EMBAGUÉ compris — choisir un joueur n'est pas cibler sa carte, 508.x
 * ne s'applique pas), et pose le jeton paMod −1 sur le Héros choisi.
 */
import { describe, expect, it } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import type { Card, Deck } from "@/types/cards";
import { useGameStore } from "../gameStore";
import { useCardStore } from "../cardStore";
import { createMockActionCard, createMockDeck } from "tests/factories/card";
import { compileActionEffectText } from "@/game/rules/effects/dsl";

const TEXT = "Le joueur de votre choix perd 1 PA jusqu'à la fin du tour.";

function drainAction(): Card {
  const compiled = compileActionEffectText(TEXT, "Ponction");
  if (!compiled) throw new Error("le DSL ne compile plus la phrase A4");
  return createMockActionCard({
    id: "ponction-a4",
    name: "Ponction",
    stats: { niveau: { value: 0, element: "Neutre" } },
    effects: [{ description: TEXT, compiled }],
  });
}

let store: ReturnType<typeof useGameStore>;

function setup(): string {
  setActivePinia(createPinia());
  const action = drainAction();
  const deck: Deck = createMockDeck();
  deck.cards[0] = { card: action, quantity: 1 };
  const cardStore = useCardStore();
  cardStore.cards = [
    deck.hero!,
    deck.havreSac!,
    ...deck.cards.map((dc) => dc.card),
  ].filter((c): c is Card => !!c);
  store = useGameStore();
  store.startSandbox(deck, deck, "A");
  while (store.state.turn.number < 2 || store.state.turn.active !== "A") {
    store.nextTurn();
  }
  for (const inst of Object.values(store.state.instances)) {
    if (inst.owner === "A" && inst.cardId === action.id) {
      store.moveTo(inst.instanceId, { zone: "main", owner: "A" });
      return inst.instanceId;
    }
  }
  throw new Error("action absente");
}

describe("A4 — « Le joueur de votre choix perd 1 PA » (intégration store)", () => {
  it("compile, ouvre le ciblage (les 2 Héros, embagués compris) et pose paMod −1", () => {
    const id = setup();
    const heroA = store.state.seats.A.heroInstanceId!;
    const heroB = store.state.seats.B.heroInstanceId!;
    // Les deux Héros sont dans leur Havre-Sac (mise en place) → choisissables
    // quand même : on choisit un JOUEUR, pas une carte protégée (508.x).
    expect(store.state.instances[heroB].location.zone).toBe("havreSac");

    expect(store.playFromHand(id)).toBe(true);
    expect(store.ruleError).toBeNull();
    // Ciblage ouvert, éligibilité = les DEUX Héros.
    expect(store.effectTargeting).not.toBeNull();
    expect(new Set(store.effectTargetIdsList)).toEqual(new Set([heroA, heroB]));
    // Choisir le joueur ADVERSE → jeton paMod −1 sur SON Héros (purgé fin de tour).
    store.effectTargetChoose(heroB);
    expect(store.state.instances[heroB].counters.tokens?.paMod).toBe(-1);
    expect(store.state.instances[heroA].counters.tokens?.paMod ?? 0).toBe(0);
    // L'Action résolue est partie en Défausse (302.1).
    expect(store.state.instances[id].location.zone).toBe("defausse");
  });
});
