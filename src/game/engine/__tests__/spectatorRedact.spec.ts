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
const GID = "spectator-redact-test";

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

describe("Mode Spectateur — Redaction et Visibilité (§5.2)", () => {
  it("un spectateur ne voit ni la pioche ni les mains des joueurs (compteurs opaques)", () => {
    const { state } = play(
      (s) => [drawTop(s, "A")],
      (s) => [drawTop(s, "A")],
      (s) => [drawTop(s, "B")],
      (s) => [drawTop(s, "B")],
      (s) => [drawTop(s, "B")],
    );

    const viewSpec = redactStateFor(state, "spectator");

    // Spectateur
    expect(viewSpec.viewer).toBe("spectator");

    // Les mains des joueurs A et B sont réduites à de simples compteurs opaques
    expect(viewSpec.seats.A?.main.kind).toBe("count");
    if (viewSpec.seats.A?.main.kind === "count") {
      expect(viewSpec.seats.A.main.count).toBe(2);
      expect(viewSpec.seats.A.main.faceDown).toBe(true);
    }

    expect(viewSpec.seats.B?.main.kind).toBe("count");
    if (viewSpec.seats.B?.main.kind === "count") {
      expect(viewSpec.seats.B.main.count).toBe(3);
      expect(viewSpec.seats.B.main.faceDown).toBe(true);
    }

    // Les pioches sont opaques
    expect(viewSpec.seats.A?.pioche.kind).toBe("count");
    expect(viewSpec.seats.B?.pioche.kind).toBe("count");

    // La réserve n'est pas accessible aux spectateurs
    expect(viewSpec.seats.A?.reserve).toBeNull();
    expect(viewSpec.seats.B?.reserve).toBeNull();
  });

  it("un spectateur voit les zones publiques (Monde, Défausse, Havre-Sac)", () => {
    const { state } = play();
    const viewSpec = redactStateFor(state, "spectator");

    expect(viewSpec.monde.kind).toBe("full");
    expect(viewSpec.seats.A?.defausse.kind).toBe("full");
    expect(viewSpec.seats.B?.defausse.kind).toBe("full");
    expect(viewSpec.seats.A?.havreSac.kind).toBe("full");
    expect(viewSpec.seats.B?.havreSac.kind).toBe("full");
  });
});
