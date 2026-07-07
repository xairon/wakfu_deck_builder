import { describe, it, expect, beforeEach } from "vitest";
import { nextTick } from "vue";
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
    createdAt: "2026-07-07T00:00:00.000Z",
    updatedAt: "2026-07-07T00:00:00.000Z",
  };
  return { deck, cards: [hero, sac, ally] };
}

describe("tutorialStore — « Apprendre en jouant » (guide passif)", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("démarre une vraie partie vs IA (mulligan, botSeat, assist+effets forcés, bot doux) + accueil", () => {
    const a = makeDeck("A");
    const b = makeDeck("B");
    useCardStore().cards = [...a.cards, ...b.cards];
    const game = useGameStore();
    const t = useTutorialStore();

    expect(t.active).toBe(false);
    expect(t.welcomeVisible).toBe(false);
    t.startGuidedGame(a.deck, b.deck);

    expect(t.active).toBe(true);
    // Écran d'accueil affiché au démarrage (remplace le coach à étapes forcées).
    expect(t.welcomeVisible).toBe(true);
    expect(game.matchPhase).toBe("mulligan");
    expect(game.botSeat).toBe("B");
    expect(game.assist).toBe(true);
    expect(game.assistEffects).toBe(true);
    // bot « doux » au démarrage (ne déclare pas d'attaque le temps de développer).
    expect(game.botAggressive).toBe(false);
    // la vue reste côté humain (siège A), sans rideau de passation.
    expect(game.perspective).toBe("A");
    expect(game.passPending).toBe(false);
  });

  it("dismissWelcome() ferme l'écran d'accueil sans toucher à la partie", () => {
    const a = makeDeck("A");
    const b = makeDeck("B");
    useCardStore().cards = [...a.cards, ...b.cards];
    const t = useTutorialStore();
    t.startGuidedGame(a.deck, b.deck);

    expect(t.welcomeVisible).toBe(true);
    t.dismissWelcome();
    expect(t.welcomeVisible).toBe(false);
    expect(t.active).toBe(true); // la partie guidée continue
  });

  it("fin de partie → clôt le mode guidé, marque « appris » et rend l'IA agressive", async () => {
    const a = makeDeck("A");
    const b = makeDeck("B");
    useCardStore().cards = [...a.cards, ...b.cards];
    const game = useGameStore();
    const t = useTutorialStore();
    t.startGuidedGame(a.deck, b.deck);
    await nextTick(); // laisse le watcher enregistrer la transition → mulligan

    expect(t.isDone()).toBe(false);
    // Le watcher matchPhase clôt le mode guidé quand la partie se termine.
    game.matchPhase = "finished";
    await nextTick();

    expect(t.active).toBe(false);
    expect(t.welcomeVisible).toBe(false);
    expect(game.botAggressive).toBe(true); // vrai adversaire
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "wakfu-tutorial-done",
      "1",
    );
  });

  it("retour au lobby → clôt le mode guidé SANS marquer « appris »", async () => {
    const a = makeDeck("A");
    const b = makeDeck("B");
    useCardStore().cards = [...a.cards, ...b.cards];
    const game = useGameStore();
    const t = useTutorialStore();
    t.startGuidedGame(a.deck, b.deck);
    await nextTick(); // laisse le watcher enregistrer la transition → mulligan

    game.matchPhase = "lobby";
    await nextTick();

    expect(t.active).toBe(false);
    expect(t.isDone()).toBe(false);
  });
});
