import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useGameStore } from "@/stores/gameStore";
import { useCardStore } from "@/stores/cardStore";
import type { Card, Deck } from "@/types/cards";
import {
  createMockHeroCard,
  createMockHavreSacCard,
  createMockAllyCard,
} from "tests/factories/card";

/** Deck minimal (Héros + Havre-Sac + 48 Alliés Niveau 1). */
function makeDeck(tag: string): { deck: Deck; cards: Card[] } {
  const hero = createMockHeroCard({ id: tag + "-hero", name: tag + " Héros" });
  const sac = createMockHavreSacCard({ id: tag + "-sac", name: tag + " Sac" });
  const ally = createMockAllyCard({
    id: tag + "-ally",
    name: tag + " Allié",
    stats: {
      niveau: { value: 1, element: "Feu" },
      force: { value: 1, element: "Feu" },
    },
  });
  const deck: Deck = {
    id: tag,
    name: tag,
    hero,
    havreSac: sac,
    cards: [{ card: ally, quantity: 48 }],
    createdAt: "2026-07-08T00:00:00.000Z",
    updatedAt: "2026-07-08T00:00:00.000Z",
  };
  return { deck, cards: [hero, sac, ally] };
}

describe("gameStore — moveHero (mouvement du Héros, 414.1)", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("déplace le Héros havreSac↔monde (à son tour 2+, phase principale)", () => {
    const a = makeDeck("A");
    const b = makeDeck("B");
    useCardStore().cards = [...a.cards, ...b.cards];
    const store = useGameStore();
    store.startSandbox(a.deck, b.deck, "B"); // B commence → tour 1 = B
    store.endTurn(); // → tour 2, actif A
    const heroId = store.state.seats.A.heroInstanceId!;
    expect(store.state.instances[heroId].location.zone).toBe("havreSac");

    store.moveHero("A", "monde");
    expect(store.state.instances[heroId].location.zone).toBe("monde");
    expect(store.state.monde).toContain(heroId);

    store.moveHero("A", "havreSac");
    expect(store.state.instances[heroId].location.zone).toBe("havreSac");
    expect(store.state.monde).not.toContain(heroId);
  });

  it("refuse la sortie au tour 1 (ruleError posé, aucun déplacement)", () => {
    const a = makeDeck("A");
    const b = makeDeck("B");
    useCardStore().cards = [...a.cards, ...b.cards];
    const store = useGameStore();
    store.startSandbox(a.deck, b.deck, "A"); // A commence → tour 1 = A
    const heroId = store.state.seats.A.heroInstanceId!;
    store.ruleError = null;
    store.moveHero("A", "monde");
    expect(store.state.instances[heroId].location.zone).toBe("havreSac");
    expect(store.ruleError).toContain("premier tour");
  });
});
