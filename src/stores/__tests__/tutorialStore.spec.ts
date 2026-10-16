import { describe, it, expect, beforeEach, vi } from "vitest";
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

describe("tutorialStore — « Apprendre en jouant » (guide et étapes didactiques)", () => {
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
    expect(t.welcomeVisible).toBe(true);
    expect(game.matchPhase).toBe("mulligan");
    expect(game.botSeat).toBe("B");
    expect(game.assist).toBe(true);
    expect(game.assistEffects).toBe(true);
    expect(game.botAggressive).toBe(false);
    expect(game.perspective).toBe("A");
    expect(game.passPending).toBe(false);

    // Initialisation des étapes d'actions du tutoriel
    expect(t.currentStepIndex).toBe(0);
    expect(t.currentStep?.id).toBe("mulligan");
    expect(t.steps.length).toBeGreaterThan(5);
  });

  it("progresse à travers les étapes lors des actions du joueur", async () => {
    const a = makeDeck("A");
    const b = makeDeck("B");
    useCardStore().cards = [...a.cards, ...b.cards];
    const game = useGameStore();
    const t = useTutorialStore();
    t.startGuidedGame(a.deck, b.deck);

    // Étape 1 : Mulligan
    expect(t.currentStep?.id).toBe("mulligan");
    game.keepHand(); // A garde
    game.keepHand(); // B garde → matchPhase = 'playing'
    await nextTick();
    t.checkProgress();

    // Doit passer à l'étape suivante (démonstration automatisée des 1ers tours)
    expect(t.currentStepIndex).toBe(1);
    expect(t.currentStep?.id).toBe("auto_demo");

    // Possibilité de sauter une étape manuellement
    t.skipCurrentStep();
    expect(t.currentStepIndex).toBe(2);
    expect(t.currentStep?.id).toBe("resources");
  });

  it("tire le premier joueur au SORT (n'impose plus l'ordinateur)", () => {
    const a = makeDeck("A");
    const b = makeDeck("B");
    useCardStore().cards = [...a.cards, ...b.cards];
    const game = useGameStore();
    const t = useTutorialStore();

    const rnd = vi.spyOn(Math, "random").mockReturnValue(0.1);
    t.startGuidedGame(a.deck, b.deck);
    expect(game.firstPlayer).toBe("A");
    expect(game.perspective).toBe("A");
    expect(game.botSeat).toBe("B");
    rnd.mockRestore();
  });

  it("le tirage peut aussi désigner l'ordinateur (siège B)", () => {
    const a = makeDeck("A");
    const b = makeDeck("B");
    useCardStore().cards = [...a.cards, ...b.cards];
    const game = useGameStore();
    const t = useTutorialStore();
    const rnd = vi.spyOn(Math, "random").mockReturnValue(0.9);
    t.startGuidedGame(a.deck, b.deck);
    expect(game.firstPlayer).toBe("B");
    rnd.mockRestore();
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
    expect(t.active).toBe(true);
  });

  it("fin de partie → affiche la modal de fin didactique, clôt le mode guidé et marque « appris »", async () => {
    const a = makeDeck("A");
    const b = makeDeck("B");
    useCardStore().cards = [...a.cards, ...b.cards];
    const game = useGameStore();
    const t = useTutorialStore();
    t.startGuidedGame(a.deck, b.deck);
    await nextTick();

    expect(t.isDone()).toBe(false);
    expect(t.completionModalVisible).toBe(false);

    // Fin de partie
    game.matchPhase = "finished";
    await nextTick();

    expect(t.active).toBe(false);
    expect(t.completionModalVisible).toBe(true);
    expect(game.botAggressive).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "wakfu-tutorial-done",
      "1",
    );

    // Fermeture de la modal de fin
    t.closeCompletionModal();
    expect(t.completionModalVisible).toBe(false);
  });

  it("retour au lobby → clôt le mode guidé SANS marquer « appris »", async () => {
    const a = makeDeck("A");
    const b = makeDeck("B");
    useCardStore().cards = [...a.cards, ...b.cards];
    const game = useGameStore();
    const t = useTutorialStore();
    t.startGuidedGame(a.deck, b.deck);
    await nextTick();

    game.matchPhase = "lobby";
    await nextTick();

    expect(t.active).toBe(false);
    expect(t.isDone()).toBe(false);
  });
});
