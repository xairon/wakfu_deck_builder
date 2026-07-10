/**
 * Driver bot — garde « pause cinématique » (bug rapporté 2026-07-10) : pendant
 * le jet de dé d'entame (overlay cosmétique par-dessus un état déjà
 * « playing »), un bot PREMIER JOUEUR jouait son tour EN FOND avant que le
 * joueur désigné soit révélé. `opts.hold` gèle le driver tant que l'overlay
 * est à l'écran ; à la levée, le bot reprend normalement.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useGameStore } from "@/stores/gameStore";
import { useCardStore } from "@/stores/cardStore";
import { useBotOpponent } from "@/composables/useBotOpponent";
import { createMockDeck } from "tests/factories/card";
import type { Card } from "@/types/cards";

function setup() {
  setActivePinia(createPinia());
  const deck = createMockDeck();
  for (const dc of deck.cards) dc.card.mainType = "Allié";
  const cardStore = useCardStore();
  cardStore.cards = [
    deck.hero,
    deck.havreSac,
    ...deck.cards.map((dc) => dc.card),
  ].filter((c): c is Card => !!c);
  const store = useGameStore();
  // Le BOT commence (siège A actif au premier tour).
  store.startSandbox(deck, deck, "A");
  store.botSeat = "A";
  store.perspective = "B"; // vue humaine
  return store;
}

describe("useBotOpponent — pause cinématique (hold)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("hold vrai → le bot premier joueur NE JOUE PAS ; à la levée, il joue", () => {
    const store = setup();
    let held = true;
    const driver = useBotOpponent(store, 50, { hold: () => held });

    const turnBefore = store.state.turn.number;
    const logBefore = store.log.length;
    // Plusieurs battements sous pause : AUCUNE action du bot.
    vi.advanceTimersByTime(500);
    expect(store.state.turn.number).toBe(turnBefore);
    expect(store.log.length).toBe(logBefore);

    // Levée de la pause : le bot joue (des événements arrivent — coup joué,
    // ou fin de tour qui rend la main).
    held = false;
    vi.advanceTimersByTime(2000);
    expect(
      store.log.length > logBefore || store.state.turn.number > turnBefore,
    ).toBe(true);

    driver.stop();
  });
});
