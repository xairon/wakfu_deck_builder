/**
 * Store — 303.1 : aux tours ≥ 2, un Allié joué peut arriver dans le Monde
 * (défaut) OU dans le Havre-Sac de son propriétaire, au choix du contrôleur.
 * Le choix est porté par le 3e argument de `playFromHand` (destination),
 * alimenté par l'UI (zone de drop / bouton « → Socle »).
 */
import { describe, expect, it } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import type { Card, Deck } from "@/types/cards";
import { useGameStore } from "../gameStore";
import { useCardStore } from "../cardStore";
import { createMockAllyCard, createMockDeck } from "tests/factories/card";

/** Allié Neutre de Niveau 0 (jouable sans Ressource). */
function freeAlly(id: string): Card {
  return createMockAllyCard({
    id,
    name: `Allié ${id}`,
    subTypes: ["Bouftou"],
    stats: { niveau: { value: 0, element: "Neutre" } },
  });
}

let store: ReturnType<typeof useGameStore>;

/** Sandbox au tour de A ≥ 2 (rien n'entre dans le Monde au tour 1, 506.3). */
function setup(): { ally: Card } {
  setActivePinia(createPinia());
  const ally = freeAlly("zonechoice");
  const deck: Deck = createMockDeck();
  deck.cards[0] = { card: ally, quantity: 1 };
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
  return { ally };
}

/** Amène l'Allié (par id de carte) en main de A, retourne son instanceId. */
function toHand(cardId: string): string {
  for (const inst of Object.values(store.state.instances)) {
    if (inst.owner === "A" && inst.cardId === cardId) {
      store.moveTo(inst.instanceId, { zone: "main", owner: "A" });
      return inst.instanceId;
    }
  }
  throw new Error(`carte ${cardId} absente`);
}

describe("store — choix de zone d'un Allié joué (303.1)", () => {
  it("destination 'havreSac' → l'Allié arrive dans le Havre-Sac (jeton d'arrivée posé)", () => {
    const { ally } = setup();
    const id = toHand(ally.id);
    const ok = store.playFromHand(id, undefined, "havreSac");
    expect(store.ruleError).toBeNull();
    expect(ok).toBe(true);
    const inst = store.state.instances[id];
    expect(inst.location.zone).toBe("havreSac");
    expect(inst.location).toMatchObject({ owner: "A" });
    // Mal d'invocation (1821) : le jeton d'arrivée est posé aussi au Havre-Sac.
    expect(inst.counters.tokens?.arrivedTurn).toBe(store.state.turn.number);
  });

  it("sans destination (défaut) → l'Allié arrive dans le Monde", () => {
    const { ally } = setup();
    const id = toHand(ally.id);
    const ok = store.playFromHand(id);
    expect(store.ruleError).toBeNull();
    expect(ok).toBe(true);
    expect(store.state.instances[id].location.zone).toBe("monde");
  });

  it("destination 'monde' explicite → Monde (équivalent au défaut)", () => {
    const { ally } = setup();
    const id = toHand(ally.id);
    expect(store.playFromHand(id, undefined, "monde")).toBe(true);
    expect(store.state.instances[id].location.zone).toBe("monde");
  });
});
