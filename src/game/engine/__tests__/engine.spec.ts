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
  resetDeriveMemo,
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

  it("SHUFFLE REDACTÉ (permutation vide) ⇒ no-op d'ordre, pas de BAD_PERMUTATION", () => {
    // Un client en ligne reçoit le mélange SANS son ordre (secret). deriveState
    // doit l'appliquer comme un no-op d'ordre — pas planter sur BAD_PERMUTATION.
    const { events } = createGame(GID, DECKS, { seedA: "sa", seedB: "sb" });
    const full = deriveState(events);
    const redacted = events.map((e) =>
      e.type === "SHUFFLE"
        ? ({
            ...e,
            payload: {
              ...(e.payload as Record<string, unknown>),
              permutation: [],
            },
          } as PersistedEvent)
        : e,
    );
    resetDeriveMemo();
    let derived: GameState | undefined;
    expect(() => {
      derived = deriveState(redacted);
    }).not.toThrow();
    // La Pioche garde les mêmes cartes (l'ordre est opaque au client).
    expect(derived!.seats.A.pioche.length).toBe(full.seats.A.pioche.length);
    expect(derived!.seats.B.pioche.length).toBe(full.seats.B.pioche.length);
  });

  it("MULLIGAN_DONE est un no-op d'état (fold sans throw)", () => {
    const { events } = createGame(GID, DECKS, { seedA: "sa", seedB: "sb" });
    const before = deriveState(events);
    const withDone = [
      ...events,
      {
        gameId: GID,
        seq: before.seq + 1,
        parentSeq: before.seq,
        actor: "A",
        type: "MULLIGAN_DONE",
        payload: { seat: "A" },
        ts: 0,
      } as PersistedEvent,
    ];
    resetDeriveMemo();
    const after = deriveState(withDone);
    expect(after.instances).toEqual(before.instances);
    expect(after.seq).toBe(before.seq + 1);
  });
});

describe("reducer — mémoïsation incrémentale du fold", () => {
  it("le repli incrémental (append) est identique au repli complet", () => {
    // play() appende par spread (refs d'events préservées) → chemin incrémental.
    const { events } = play(
      (s) => [drawTop(s, "A")],
      (s) => [drawTop(s, "B")],
      (s) => [drawTop(s, "A")],
    );
    const incremental = deriveState(events); // sert depuis le cache mémoïsé
    resetDeriveMemo();
    const full = deriveState(events); // repli complet, cache vide
    expect(incremental).toEqual(full);
  });

  it("ne fuite pas d'un journal à l'autre", () => {
    const a = createGame("game-a", DECKS, { seedA: "a1", seedB: "a2" }).events;
    const b = createGame("game-b", DECKS, { seedA: "b1", seedB: "b2" }).events;
    deriveState(a); // amorce le cache avec A
    const stateB = deriveState(b); // journal différent (borne ≠) → recalcul
    resetDeriveMemo();
    expect(stateB).toEqual(deriveState(b));
  });

  it("un UNDONE dans la queue est géré (recalcul complet)", () => {
    const heroA = buildInitialLayout(GID, DECKS).seats.A.heroInstanceId!;
    const base = createGame(GID, DECKS, { seedA: "sa", seedB: "sb" }).events;
    const s1 = deriveState(base);
    const withCounter = [
      ...base,
      ...sequence([setCounter("A", heroA, "damage", 5)], GID, s1.seq + 1),
    ];
    const targetSeq = withCounter[withCounter.length - 1].seq;
    const s2 = deriveState(withCounter); // amorce le cache (préfixe = withCounter)
    const withUndo = [
      ...withCounter,
      ...sequence([undo("A", targetSeq)], GID, s2.seq + 1),
    ];
    const memoized = deriveState(withUndo); // queue avec UNDONE → recalcul complet
    resetDeriveMemo();
    expect(memoized).toEqual(deriveState(withUndo));
    expect(memoized.instances[heroA].counters.damage).toBeUndefined();
  });
});

describe("reducer — frontière de zone (501.5)", () => {
  it("Monde↔Havre-Sac conserve les compteurs ; tout autre move les purge", () => {
    const heroA = buildInitialLayout(GID, DECKS).seats.A.heroInstanceId!;
    const swap = play(
      (_s) => [setCounter("A", heroA, "damage", 2)],
      () => [worldHavenSwap("A", heroA, "havreSac")], // Havre-Sac → Monde
    );
    expect(swap.state.instances[heroA].counters.damage).toBe(2);

    const purge = play(
      (_s) => [setCounter("A", heroA, "damage", 2)],
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
