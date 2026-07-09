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

  it("moveCreature : un ALLIÉ dressé sort du Havre-Sac vers le Monde et rentre (414.1)", () => {
    const a = makeDeck("A");
    const b = makeDeck("B");
    useCardStore().cards = [...a.cards, ...b.cards];
    const store = useGameStore();
    store.startSandbox(a.deck, b.deck, "B"); // B commence
    store.endTurn(); // → tour 2, actif A
    store.perspective = "A";
    // Allié de A dans son Havre-Sac (dressé).
    const allyId = store.state.seats.A.pioche.find(
      (id) => store.state.instances[id]?.cardId === "A-ally",
    )!;
    store.moveTo(allyId, { zone: "havreSac", owner: "A" });
    expect(store.state.instances[allyId].location.zone).toBe("havreSac");

    store.moveCreature(allyId, "monde"); // Sortir
    expect(store.state.instances[allyId].location.zone).toBe("monde");

    store.moveCreature(allyId, "havreSac"); // Rentrer
    expect(store.state.instances[allyId].location.zone).toBe("havreSac");
  });

  it("moveCreature : refuse de déplacer un Allié INCLINÉ (414.2)", () => {
    const a = makeDeck("A");
    const b = makeDeck("B");
    useCardStore().cards = [...a.cards, ...b.cards];
    const store = useGameStore();
    store.startSandbox(a.deck, b.deck, "B");
    store.endTurn(); // tour 2, actif A
    store.perspective = "A";
    const allyId = store.state.seats.A.pioche.find(
      (id) => store.state.instances[id]?.cardId === "A-ally",
    )!;
    store.moveTo(allyId, { zone: "monde" });
    store.toggleTap(allyId); // incliné
    store.ruleError = null;
    store.moveCreature(allyId, "havreSac");
    expect(store.state.instances[allyId].location.zone).toBe("monde"); // pas bougé
    expect(store.ruleError).toContain("inclinée");
  });

  it("heroMoveOption (source du bouton) suit la zone du Héros et sa légalité", () => {
    const a = makeDeck("A");
    const b = makeDeck("B");
    useCardStore().cards = [...a.cards, ...b.cards];
    const store = useGameStore();
    store.startSandbox(a.deck, b.deck, "B"); // B commence → tour 1 = B
    store.endTurn(); // → tour 2, actif/perspective A

    // Héros embagué → propose de SORTIR dans le Monde, autorisé (tour 2).
    expect(store.heroMoveOption?.to).toBe("monde");
    expect(store.heroMoveOption?.reason).toBeNull();

    store.moveHero("A", "monde");
    // Héros exposé → propose de RENTRER au Havre-Sac.
    expect(store.heroMoveOption?.to).toBe("havreSac");
    expect(store.heroMoveOption?.reason).toBeNull();
  });

  it("heroMoveOption : motif non nul quand le déplacement est illégal (tour 1)", () => {
    const a = makeDeck("A");
    const b = makeDeck("B");
    useCardStore().cards = [...a.cards, ...b.cards];
    const store = useGameStore();
    store.startSandbox(a.deck, b.deck, "A"); // A commence → tour 1 = A
    // Sortie interdite au 1er tour (506.3) → le bouton serait désactivé avec le motif.
    expect(store.heroMoveOption?.to).toBe("monde");
    expect(store.heroMoveOption?.reason).toContain("premier tour");
  });
});
