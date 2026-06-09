import { setActivePinia, createPinia } from "pinia";
import { beforeEach, describe, it, expect } from "vitest";
import { useGameStore } from "../gameStore";
import { createMockDeck } from "tests/factories/card";

describe("gameStore — table locale (bac à sable)", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("démarre une partie : 2 Havre-Sac au Monde, Pioches à 48", () => {
    const store = useGameStore();
    const deck = createMockDeck();
    store.startSandbox(deck, deck);
    expect(store.started).toBe(true);
    expect(store.state.monde.length).toBe(2);
    expect(store.state.seats.A.pioche.length).toBe(48);
    expect(store.state.seats.B.pioche.length).toBe(48);
  });

  it("piocher déplace une carte Pioche → Main", () => {
    const store = useGameStore();
    const deck = createMockDeck();
    store.startSandbox(deck, deck);
    store.draw("A");
    expect(store.state.seats.A.main.length).toBe(1);
    expect(store.state.seats.A.pioche.length).toBe(47);
  });

  it("passer le tour change le joueur actif et incrémente le numéro", () => {
    const store = useGameStore();
    const deck = createMockDeck();
    store.startSandbox(deck, deck, "A");
    expect(store.turn.active).toBe("A");
    store.nextTurn();
    expect(store.turn.active).toBe("B");
    expect(store.turn.number).toBe(2);
  });

  it("annuler revient sur le dernier coup du joueur", () => {
    const store = useGameStore();
    const deck = createMockDeck();
    store.startSandbox(deck, deck);
    store.draw("A");
    expect(store.state.seats.A.main.length).toBe(1);
    store.undoLast();
    expect(store.state.seats.A.main.length).toBe(0);
  });

  it("incliner puis redresser une carte", () => {
    const store = useGameStore();
    const deck = createMockDeck();
    store.startSandbox(deck, deck);
    const havre = store.state.seats.A.havreSacInstanceId!;
    store.toggleTap(havre);
    expect(store.state.instances[havre].orientation).toBe("tapped");
    store.toggleTap(havre);
    expect(store.state.instances[havre].orientation).toBe("upright");
  });
});
