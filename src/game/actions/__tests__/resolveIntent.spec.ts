import { describe, it, expect } from "vitest";
import {
  createMockDeck,
  createMockHeroCard,
  createMockHavreSacCard,
  createMockAllyCard,
} from "tests/factories/card";
import type { Card, Deck } from "@/types/cards";
import type { Seat } from "@/game";
import { createGame } from "@/game";
import { drawTop, sequence } from "@/game/engine/verbs";
import { deriveState } from "@/game/engine/reducer";
import { resolveIntent } from "@/game/actions/resolveIntent";

/** Decks de test : 16 Alliés Neutre ×3 (48 cartes), Héros + Havre-Sac par siège. */
function deckFor(seat: Seat): Deck {
  return createMockDeck({
    hero: createMockHeroCard({ id: `${seat}-hero` }),
    havreSac: createMockHavreSacCard({ id: `${seat}-havre` }),
    cards: Array.from({ length: 16 }, (_, i) => ({
      card: createMockAllyCard({ id: `${seat}-ally-${i}`, name: `Allié ${i}` }),
      quantity: 3,
    })),
  });
}
const DECKS = { A: deckFor("A"), B: deckFor("B") } as Record<Seat, Deck>;

/** Index cardId → Card pour `getCard` (toutes les cartes des deux decks). */
function buildCardIndex(): Map<string, Card> {
  const map = new Map<string, Card>();
  for (const deck of Object.values(DECKS)) {
    if (deck.hero) map.set(deck.hero.id, deck.hero);
    if (deck.havreSac) map.set(deck.havreSac.id, deck.havreSac);
    for (const dc of deck.cards ?? []) map.set(dc.card.id, dc.card);
  }
  return map;
}

/**
 * État « en cours de partie » : `createGame` puis chaque siège pioche 3 cartes
 * (les deux mains sont peuplées). `turn.active = "A"` (firstPlayer par défaut).
 */
function playingState() {
  const { events } = createGame("g", DECKS, { seedA: "sa", seedB: "sb" });
  const cardIndex = buildCardIndex();
  const getCard = (id: string | null) =>
    id ? (cardIndex.get(id) ?? null) : null;

  // Pioche 3 cartes par siège en re-dérivant entre chaque (drawTop lit le sommet).
  let working = events.slice();
  for (const seat of ["A", "B"] as Seat[]) {
    for (let i = 0; i < 3; i++) {
      const draft = drawTop(deriveState(working), seat);
      const [persisted] = sequence([draft], "g", working.length + 1);
      working = [...working, persisted];
    }
  }
  const state = deriveState(working);
  return { state, getCard };
}

describe("resolveIntent — non-combat (autorité partagée)", () => {
  it("PLAY_CARD hors tour → erreur, aucun event", () => {
    const { state, getCard } = playingState(); // active A
    const bHandCard = state.seats.B.main[0];
    expect(bHandCard).toBeDefined();
    const r = resolveIntent(
      state,
      getCard,
      { kind: "PLAY_CARD", instanceId: bHandCard },
      "B",
    );
    expect("error" in r).toBe(true);
    expect("error" in r && r.error).toContain("tour");
    expect("events" in r).toBe(false);
  });

  it("MOVE_CARD hors tour → erreur", () => {
    const { state, getCard } = playingState();
    const bCard = state.seats.B.havreSac[0]; // Héros de B, dans le Havre-Sac
    expect(bCard).toBeDefined();
    const r = resolveIntent(
      state,
      getCard,
      { kind: "MOVE_CARD", instanceId: bCard, to: { zone: "monde" } },
      "B",
    );
    expect("error" in r).toBe(true);
    expect("error" in r && r.error).toContain("tour");
  });

  it("END_TURN par le joueur actif → SET_PHASE (siège suivant) + draws = PA - main", () => {
    const { state, getCard } = playingState(); // active A, A a 3 cartes en main
    const r = resolveIntent(state, getCard, { kind: "END_TURN" }, "A");
    expect("events" in r).toBe(true);
    if (!("events" in r)) throw new Error("attendu events");

    const setPhase = r.events.find((e) => e.type === "SET_PHASE");
    expect(setPhase).toBeDefined();
    expect((setPhase!.payload as { active: Seat }).active).toBe("B");
    expect((setPhase!.payload as { number: number }).number).toBe(
      state.turn.number + 1,
    );

    // draws = PA du Héros (6) - cartes en main (3) = 3 ; re-dérivé par submit_event.
    expect("draws" in r).toBe(true);
    expect("draws" in r && r.draws).toBe(6 - state.seats.A.main.length);
    // END_TURN n'émet AUCUN drawTop lui-même (laissé à la re-dérivation serveur).
    expect(r.events.some((e) => e.type === "MOVE")).toBe(false);
  });

  it("END_TURN par le joueur INACTIF → erreur (garde de tour)", () => {
    const { state, getCard } = playingState(); // active A
    const r = resolveIntent(state, getCard, { kind: "END_TURN" }, "B");
    expect("error" in r).toBe(true);
    expect("error" in r && r.error).toContain("tour");
  });

  it("TAP hors tour → erreur ; TAP par le joueur actif → SET_ORIENTATION", () => {
    const { state, getCard } = playingState(); // active A
    const aHavre = state.seats.A.havreSac[0];

    const rejected = resolveIntent(
      state,
      getCard,
      { kind: "TAP", instanceId: aHavre },
      "B",
    );
    expect("error" in rejected).toBe(true);

    const ok = resolveIntent(
      state,
      getCard,
      { kind: "TAP", instanceId: aHavre },
      "A",
    );
    expect("events" in ok).toBe(true);
    if (!("events" in ok)) throw new Error("attendu events");
    expect(ok.events).toHaveLength(1);
    expect(ok.events[0].type).toBe("SET_ORIENTATION");
    expect((ok.events[0].payload as { orientation: string }).orientation).toBe(
      "tapped",
    );
  });
});
