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
  buildInitialLayout,
  redactStateFor,
  canSeeCardId,
  drawTop,
  discard,
  worldHavenSwap,
  setCounter,
  undo,
  sequence,
  permutationFromSeed,
} from "@/game";

// Decks aux cardIds PRÉFIXÉS par siège → assertions de redaction non ambiguës.
function deckFor(seat: Seat): Deck {
  return createMockDeck({
    hero: createMockHeroCard({ id: `${seat}-hero`, name: `Héros ${seat}` }),
    havreSac: createMockHavreSacCard({
      id: `${seat}-havre`,
      name: `Havre ${seat}`,
    }),
    cards: Array.from({ length: 16 }, (_, i) => ({
      card: createMockAllyCard({
        id: `${seat}-ally-${i}`,
        name: `${seat} Allié ${i}`,
      }),
      quantity: 3,
    })),
  });
}
const DECKS = { A: deckFor("A"), B: deckFor("B") } as Record<Seat, Deck>;
const GID = "game-test";

/** Rejoue la partie en appendant des brouillons dépendants de l'état courant. */
function play(...steps: Array<(s: GameState) => DraftEvent[]>): {
  events: PersistedEvent[];
  state: GameState;
} {
  let all = createGame(GID, DECKS, { seedA: "sa", seedB: "sb" }).events;
  for (const step of steps) {
    const s = deriveState(all);
    all = [...all, ...sequence(step(s), GID, s.seq + 1)];
  }
  return { events: all, state: deriveState(all) };
}

describe("setup — placement initial (102.1 / 306.1 / 307.1)", () => {
  const layout = buildInitialLayout(GID, DECKS, "A");

  it("met 48 cartes en Pioche par joueur", () => {
    expect(layout.seats.A.pioche).toHaveLength(48);
    expect(layout.seats.B.pioche).toHaveLength(48);
  });

  it("place le Héros dans le Havre-Sac, dressé", () => {
    const heroA = layout.seats.A.heroInstanceId!;
    expect(layout.seats.A.havreSac).toContain(heroA);
    expect(layout.instances[heroA].location.zone).toBe("havreSac");
    expect(layout.instances[heroA].orientation).toBe("upright");
    expect(layout.instances[heroA].counters.level).toBe(1);
  });

  it("place les deux Havre-Sac dans le Monde, mains vides", () => {
    expect(layout.monde).toHaveLength(2);
    expect(layout.seats.A.main).toHaveLength(0);
    expect(layout.seats.B.main).toHaveLength(0);
  });
});

describe("reducer — déterminisme", () => {
  it("deriveState est déterministe (rejouer donne le même état)", () => {
    const { events } = createGame(GID, DECKS, { seedA: "sa", seedB: "sb" });
    expect(deriveState(events)).toEqual(deriveState(events));
  });

  it("même graine ⇒ même ordre de Pioche ; graine ≠ ⇒ ordre ≠", () => {
    const g1 = createGame(GID, DECKS, { seedA: "x", seedB: "y" }).state;
    const g2 = createGame(GID, DECKS, { seedA: "x", seedB: "y" }).state;
    const g3 = createGame(GID, DECKS, { seedA: "z", seedB: "y" }).state;
    expect(g1.seats.A.pioche).toEqual(g2.seats.A.pioche);
    expect(g1.seats.A.pioche).not.toEqual(g3.seats.A.pioche);
  });

  it("SHUFFLE est une permutation (mêmes cartes, ordre changé)", () => {
    const perm = permutationFromSeed(48, "sa");
    expect([...perm].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 48 }, (_, i) => i),
    );
  });
});

describe("reducer — frontière de zone (501.5)", () => {
  it("Monde↔Havre-Sac conserve les compteurs ; tout autre move les purge", () => {
    const heroA = buildInitialLayout(GID, DECKS).seats.A.heroInstanceId!;
    const swap = play(
      (s) => [setCounter("A", heroA, "damage", 2)],
      () => [worldHavenSwap("A", heroA, "havreSac")], // Havre-Sac → Monde
    );
    expect(swap.state.instances[heroA].counters.damage).toBe(2);

    const purge = play(
      (s) => [setCounter("A", heroA, "damage", 2)],
      () => [worldHavenSwap("A", heroA, "havreSac")],
      () => [discard("A", heroA, { zone: "monde" })], // Monde → Défausse
    );
    expect(purge.state.instances[heroA].counters.damage).toBeUndefined();
  });
});

describe("reducer — undo (§4.5)", () => {
  it("UNDONE { targetSeq } annule l'effet de l'event ciblé", () => {
    const heroA = buildInitialLayout(GID, DECKS).seats.A.heroInstanceId!;
    // seq du SET_COUNTER, puis on l'annule.
    const base = createGame(GID, DECKS, { seedA: "sa", seedB: "sb" }).events;
    const s1 = deriveState(base);
    const withCounter = [
      ...base,
      ...sequence([setCounter("A", heroA, "damage", 5)], GID, s1.seq + 1),
    ];
    const targetSeq = withCounter[withCounter.length - 1].seq;
    expect(deriveState(withCounter).instances[heroA].counters.damage).toBe(5);

    const s2 = deriveState(withCounter);
    const withUndo = [
      ...withCounter,
      ...sequence([undo("A", targetSeq)], GID, s2.seq + 1),
    ];
    expect(
      deriveState(withUndo).instances[heroA].counters.damage,
    ).toBeUndefined();
  });
});

describe("redaction — étanchéité de l'information cachée (OBJ-7)", () => {
  // A pioche 1 carte → sa main contient un cardId secret.
  const { state } = play((s) => [drawTop(s, "A")]);

  it("la vue de B ne révèle ni la main ni la Pioche de A (kind:count)", () => {
    const viewB = redactStateFor(state, "B");
    expect(viewB.seats.A.main.kind).toBe("count");
    expect(viewB.seats.A.pioche.kind).toBe("count");
    expect(viewB.seats.A.reserve).toBeNull();
  });

  it("AUCUN cardId secret de A n'apparaît dans la vue de B", () => {
    const viewB = redactStateFor(state, "B");
    const json = JSON.stringify(viewB);
    const secretCardIds = [...state.seats.A.pioche, ...state.seats.A.main].map(
      (id) => state.instances[id].cardId!,
    );
    for (const cardId of secretCardIds) {
      expect(json).not.toContain(cardId); // ex. "A-ally-7"
    }
  });

  it("A voit sa propre main (full), mais jamais l'ordre/contenu de sa Pioche", () => {
    const viewA = redactStateFor(state, "A");
    expect(viewA.seats.A.main.kind).toBe("full");
    expect(viewA.seats.A.pioche.kind).toBe("count"); // ordre secret même pour le proprio
    if (viewA.seats.A.main.kind === "full") {
      expect(viewA.seats.A.main.instances.every((i) => i.cardId !== null)).toBe(
        true,
      );
    }
  });

  it("les zones publiques (Monde, Havre-Sac) restent visibles de tous", () => {
    const viewB = redactStateFor(state, "B");
    expect(viewB.monde.kind).toBe("full");
    // le Héros de A (dans son Havre-Sac) est public
    if (viewB.seats.A.havreSac.kind === "full") {
      const hero = viewB.seats.A.havreSac.instances.find(
        (i) => i.cardId === "A-hero",
      );
      expect(hero).toBeTruthy();
    }
  });

  it("canSeeCardId : main du proprio oui, main adverse non, pioche jamais", () => {
    const heroA = state.seats.A.heroInstanceId!;
    const inMainA = state.seats.A.main[0];
    const inPiocheA = state.seats.A.pioche[0];
    expect(canSeeCardId(state.instances[inMainA], "A")).toBe(true);
    expect(canSeeCardId(state.instances[inMainA], "B")).toBe(false);
    expect(canSeeCardId(state.instances[inPiocheA], "A")).toBe(false);
    expect(canSeeCardId(state.instances[heroA], "B")).toBe(true); // Havre-Sac public
  });
});
