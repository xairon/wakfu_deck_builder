import { describe, it, expect } from "vitest";
import {
  createMockDeck,
  createMockHeroCard,
  createMockHavreSacCard,
  createMockAllyCard,
} from "tests/factories/card";
import type { Deck } from "@/types/cards";
import type { Seat, DraftEvent, GameState, PersistedEvent } from "@/game";
import {
  createGame,
  deriveState,
  redactStateFor,
  drawTop,
  revealHand,
  sequence,
} from "@/game";

function deckFor(seat: Seat): Deck {
  return createMockDeck({
    hero: createMockHeroCard({ id: `${seat}-hero`, name: `Héros ${seat}` }),
    havreSac: createMockHavreSacCard({ id: `${seat}-havre` }),
    cards: Array.from({ length: 16 }, (_, i) => ({
      card: createMockAllyCard({
        id: `${seat}-ally-${i}`,
        name: `${seat} ${i}`,
      }),
      quantity: 3,
    })),
  });
}
const DECKS = { A: deckFor("A"), B: deckFor("B") } as Record<Seat, Deck>;
const GID = "reveal-test";

function play(...steps: Array<(s: GameState) => DraftEvent[]>): {
  state: GameState;
  events: PersistedEvent[];
} {
  let all = createGame(GID, DECKS, { seedA: "sa", seedB: "sb" }).events;
  for (const step of steps) {
    const s = deriveState(all);
    all = [...all, ...sequence(step(s), GID, s.seq + 1)];
  }
  return { state: deriveState(all), events: all };
}

describe("TL5 — révéler sa main à l'adversaire (Filouterie)", () => {
  it("verbe revealHand : émet un REVEAL des instanceIds vers `to`", () => {
    const ev = revealHand("A", ["ci_A_001", "ci_A_002"], ["B"]);
    expect(ev.type).toBe("REVEAL");
    expect(ev.actor).toBe("A");
    expect(ev.payload).toEqual({
      instanceIds: ["ci_A_001", "ci_A_002"],
      to: ["B"],
    });
  });

  it("avant révélation : B voit la main de A comme un simple compteur", () => {
    const { state } = play((s) => [drawTop(s, "A"), drawTop(s, "A")]);
    const viewB = redactStateFor(state, "B");
    expect(viewB.seats.A.main.kind).toBe("count");
  });

  it("après revealHand vers B : B voit les cartes de la main de A (cardId dévoilé)", () => {
    const { state } = play(
      (s) => [drawTop(s, "A"), drawTop(s, "A")],
      (s) => [revealHand("A", s.seats.A.main, ["B"])],
    );
    const viewB = redactStateFor(state, "B");
    expect(viewB.seats.A.main.kind).toBe("full");
    if (viewB.seats.A.main.kind !== "full") throw new Error("attendu full");
    const cardIds = viewB.seats.A.main.instances.map((i) => i.cardId);
    expect(cardIds.length).toBeGreaterThan(0);
    expect(cardIds.every((id) => id !== null)).toBe(true);
  });

  it("la révélation de A à B ne dévoile PAS la main de A à un spectateur", () => {
    const { state } = play(
      (s) => [drawTop(s, "A"), drawTop(s, "A")],
      (s) => [revealHand("A", s.seats.A.main, ["B"])],
    );
    const viewSpec = redactStateFor(state, "spectator");
    expect(viewSpec.seats.A.main.kind).toBe("count");
  });

  it("main de B non révélée : reste cachée pour A même après que A révèle la sienne", () => {
    const { state } = play(
      (s) => [drawTop(s, "A"), drawTop(s, "B")],
      (s) => [revealHand("A", s.seats.A.main, ["B"])],
    );
    const viewA = redactStateFor(state, "A");
    expect(viewA.seats.B.main.kind).toBe("count"); // B n'a rien révélé
  });
});
