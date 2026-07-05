import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useTutorialStore } from "../tutorialStore";
import { useGameStore } from "../gameStore";
import { useCardStore } from "../cardStore";
import type { Card, Deck } from "@/types/cards";
import {
  createMockHeroCard,
  createMockHavreSacCard,
  createMockAllyCard,
} from "tests/factories/card";

/** Deck minimal jouable (Héros + Havre-Sac + 48 Alliés Niveau 1). */
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
    createdAt: "2026-07-04T00:00:00.000Z",
    updatedAt: "2026-07-04T00:00:00.000Z",
  };
  return { deck, cards: [hero, sac, ally] };
}

describe("tutorialStore — « Apprendre en jouant »", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("démarre une vraie partie guidée vs l'IA (mulligan, botSeat, assist forcé)", () => {
    const a = makeDeck("A");
    const b = makeDeck("B");
    useCardStore().cards = [...a.cards, ...b.cards];
    const game = useGameStore();
    const t = useTutorialStore();

    expect(t.active).toBe(false);
    t.startGuidedGame(a.deck, b.deck);

    expect(t.active).toBe(true);
    expect(t.stepIndex).toBe(0);
    expect(t.total).toBeGreaterThan(5); // séquence guidée non vide
    // partie lancée avec mulligan + IA au siège B + règles assistées forcées.
    expect(game.matchPhase).toBe("mulligan");
    expect(game.botSeat).toBe("B");
    expect(game.assist).toBe(true);
    expect(game.assistEffects).toBe(true);
    // bot « doux » pendant la phase guidée.
    expect(game.botAggressive).toBe(false);
  });

  it("next() avance les étapes ; skip() clôt + marque terminé + rend l'IA agressive", () => {
    const a = makeDeck("A");
    const b = makeDeck("B");
    useCardStore().cards = [...a.cards, ...b.cards];
    const game = useGameStore();
    const t = useTutorialStore();
    t.startGuidedGame(a.deck, b.deck);

    t.next();
    expect(t.stepIndex).toBe(1);

    expect(t.isDone()).toBe(false);
    t.skip();
    expect(t.active).toBe(false);
    expect(game.botAggressive).toBe(true); // phase libre : vrai adversaire
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "wakfu-tutorial-done",
      "1",
    );
  });
});
