import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useGameStore } from "@/stores/gameStore";
import { useCardStore } from "@/stores/cardStore";
import { botStep } from "@/game/ai/botPolicy";
import type { Card, Deck } from "@/types/cards";
import {
  createMockHeroCard,
  createMockHavreSacCard,
  createMockAllyCard,
} from "tests/factories/card";

/** Deck minimal (Héros + Havre-Sac + 48 Alliés vanille SANS pouvoir). */
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

describe("botPolicy — le bot ne pollue pas le joueur avec ses sondages", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("ne pose PAS de ruleError en sondant une carte SANS pouvoir (« Pas de pouvoir à inclinaison automatisé »)", () => {
    // Régression : mainPhase sondait activateTapPower sur TOUTES ses cartes ; sur
    // une carte sans pouvoir compilé, le rejet posait un ruleError VISIBLE par
    // l'humain (assistant de règles). Le bot doit d'abord filtrer via hasTapPower.
    const a = makeDeck("A");
    const b = makeDeck("B");
    useCardStore().cards = [...a.cards, ...b.cards];
    const store = useGameStore();
    store.startSandbox(a.deck, b.deck, "B"); // tour du bot (B), mains vides
    store.assistEffects = true; // requis pour qu'activateTapPower s'exécute
    store.botAggressive = false; // pas d'attaque → on atteint l'étape des pouvoirs

    // Un Allié (sans pouvoir) dans le Monde du bot.
    const bAllyId = store.state.seats.B.pioche.find(
      (id) => store.state.instances[id]?.cardId === "B-ally",
    )!;
    store.moveTo(bAllyId, { zone: "monde" });
    store.perspective = "B";
    store.ruleError = null;

    botStep(store, new Set());

    expect(store.ruleError).not.toBe(
      "Pas de pouvoir à inclinaison automatisé.",
    );
  });
});
