import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useGameStore } from "../gameStore";
import { useCardStore } from "../cardStore";
import { createMockDeck } from "tests/factories/card";
import { createGame, type GameIntent, type PersistedEvent, type RedactedEvent, type Seat } from "@/game";

describe("Optimistic UI en ligne", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("ajuste les compteurs de manière optimiste immédiatement et réconcilie avec le serveur", async () => {
    let emit: ((e: PersistedEvent) => void) | null = null;
    const intents: GameIntent[] = [];
    const transport = {
      submit: async () => ({ seq: 0 }),
      submitIntent: async (_id: string, i: GameIntent) => {
        intents.push(i);
      },
      subscribe: (
        _id: string,
        _seat: Seat,
        cb: (e: PersistedEvent) => void,
      ) => {
        emit = cb;
        return () => {};
      },
      pull: async () => [] as RedactedEvent[],
      concede: async () => {},
    };

    const deck = createMockDeck();
    useCardStore().cards = deck.cards.map((dc) => dc.card);
    const { events } = createGame(
      "g-opt",
      { A: deck, B: deck },
      { firstPlayer: "A", seedA: "a", seedB: "b" },
    );
    const store = useGameStore();
    store.connectOnline("g-opt", "A", transport);
    for (const ev of events) emit!(ev);

    const heroId = store.state.seats.A.heroInstanceId!;
    const initialDamage = store.state.instances[heroId].counters.damage ?? 0;
    expect(initialDamage).toBe(0);

    // 1. Clic sur +3 dégâts
    store.adjustCounter(heroId, "damage", 3);

    // Immédiatement visible dans l'état réactif (0 ms)
    expect(store.state.instances[heroId].counters.damage).toBe(3);
    expect(store.optimisticActions.length).toBe(1);

    // 2. Le serveur répond et diffuse l'événement réel
    const lastSeq = store.events[store.events.length - 1].seq;
    emit!({
      gameId: "g-opt",
      seq: lastSeq + 1,
      actor: "A",
      type: "INC_COUNTER",
      payload: { instanceId: heroId, counter: "damage", delta: 3 },
      timestamp: new Date().toISOString(),
    });

    // Réconciliation : l'action optimiste est consommée et la valeur reste à 3 (aucun doublon à 6)
    expect(store.state.instances[heroId].counters.damage).toBe(3);
    expect(store.optimisticActions.length).toBe(0);
  });

  it("effectue un rollback propre de l'état optimiste si le serveur rejette l'action", async () => {
    let emit: ((e: PersistedEvent) => void) | null = null;

    const transport = {
      submit: async () => ({ seq: 0 }),
      submitIntent: async () => {
        throw new Error("Refus serveur : action interdite");
      },
      subscribe: (
        _id: string,
        _seat: Seat,
        cb: (e: PersistedEvent) => void,
      ) => {
        emit = cb;
        return () => {};
      },
      pull: async () => [] as RedactedEvent[],
      concede: async () => {},
    };

    const deck = createMockDeck();
    useCardStore().cards = deck.cards.map((dc) => dc.card);
    const { events } = createGame(
      "g-opt-err",
      { A: deck, B: deck },
      { firstPlayer: "A", seedA: "a", seedB: "b" },
    );
    const store = useGameStore();
    store.connectOnline("g-opt-err", "A", transport);
    for (const ev of events) emit!(ev);

    const heroId = store.state.seats.A.heroInstanceId!;
    expect(store.state.instances[heroId].counters.damage ?? 0).toBe(0);

    // Ajustement de compteur
    store.adjustCounter(heroId, "damage", 5);

    // Optimiste : +5 affiché instantanément
    expect(store.state.instances[heroId].counters.damage).toBe(5);

    // Le serveur renvoie un refus
    await new Promise((r) => setTimeout(r, 10));

    // Rollback automatique vers la valeur d'origine (0) et erreur levée
    expect(store.state.instances[heroId].counters.damage ?? 0).toBe(0);
    expect(store.ruleError).toContain("Refus serveur");
    expect(store.optimisticActions.length).toBe(0);
  });

  it("déplace une carte optimiquement sur le plateau en mode en ligne", async () => {
    let emit: ((e: PersistedEvent) => void) | null = null;
    const transport = {
      submit: async () => ({ seq: 0 }),
      submitIntent: async () => {},
      subscribe: (
        _id: string,
        _seat: Seat,
        cb: (e: PersistedEvent) => void,
      ) => {
        emit = cb;
        return () => {};
      },
      pull: async () => [] as RedactedEvent[],
      concede: async () => {},
    };

    const deck = createMockDeck();
    useCardStore().cards = deck.cards.map((dc) => dc.card);
    const { events } = createGame(
      "g-opt-move",
      { A: deck, B: deck },
      { firstPlayer: "A", seedA: "a", seedB: "b" },
    );
    const store = useGameStore();
    store.connectOnline("g-opt-move", "A", transport);
    for (const ev of events) emit!(ev);

    const cardInDeck = store.state.seats.A.pioche[0];
    expect(store.state.instances[cardInDeck].location.zone).toBe("pioche");

    // Déplacement vers la Défausse
    store.moveTo(cardInDeck, { zone: "defausse", owner: "A" });

    // Immédiatement dans la défausse de façon optimiste (0 ms)
    expect(store.state.instances[cardInDeck].location.zone).toBe("defausse");
  });

  it("calcule correctement mulliganCount en ligne lors des mulligans successifs", () => {
    let emit: ((e: PersistedEvent) => void) | null = null;
    const transport = {
      submit: async () => ({ seq: 0 }),
      submitIntent: async () => {},
      subscribe: (
        _id: string,
        _seat: Seat,
        cb: (e: PersistedEvent) => void,
      ) => {
        emit = cb;
        return () => {};
      },
      pull: async () => [] as RedactedEvent[],
      concede: async () => {},
    };

    const deck = createMockDeck();
    useCardStore().cards = deck.cards.map((dc) => dc.card);
    const { events } = createGame(
      "g-opt-mull",
      { A: deck, B: deck },
      { firstPlayer: "A", seedA: "a", seedB: "b" },
    );
    const store = useGameStore();
    store.connectOnline("g-opt-mull", "A", transport);
    for (const ev of events) emit!(ev);

    // Initialement : 0 mulligans
    expect(store.mulliganCount("A")).toBe(0);

    // 1er mulligan serveur arrive (SHUFFLE de A sur pioche)
    const seq1 = store.events[store.events.length - 1].seq + 1;
    emit!({
      gameId: "g-opt-mull",
      seq: seq1,
      actor: "A",
      type: "SHUFFLE",
      payload: { zone: { zone: "pioche", owner: "A" }, permutation: [] },
      timestamp: new Date().toISOString(),
    });
    expect(store.mulliganCount("A")).toBe(1);

    // 2e mulligan serveur arrive
    const seq2 = seq1 + 1;
    emit!({
      gameId: "g-opt-mull",
      seq: seq2,
      actor: "A",
      type: "SHUFFLE",
      payload: { zone: { zone: "pioche", owner: "A" }, permutation: [] },
      timestamp: new Date().toISOString(),
    });
    expect(store.mulliganCount("A")).toBe(2);
  });

  it("soumet l'intention SET_CONTROLLER lors d'un transfert de contrôle en ligne", async () => {
    let emit: ((e: PersistedEvent) => void) | null = null;
    const intents: GameIntent[] = [];
    const transport = {
      submit: async () => ({ seq: 0 }),
      submitIntent: async (_id: string, i: GameIntent) => {
        intents.push(i);
      },
      subscribe: (
        _id: string,
        _seat: Seat,
        cb: (e: PersistedEvent) => void,
      ) => {
        emit = cb;
        return () => {};
      },
      pull: async () => [] as RedactedEvent[],
      concede: async () => {},
    };

    const deck = createMockDeck();
    useCardStore().cards = deck.cards.map((dc) => dc.card);
    const { events } = createGame(
      "g-opt-ctrl",
      { A: deck, B: deck },
      { firstPlayer: "A", seedA: "a", seedB: "b" },
    );
    const store = useGameStore();
    store.connectOnline("g-opt-ctrl", "A", transport);
    for (const ev of events) emit!(ev);

    const heroA = store.state.seats.A.heroInstanceId!;
    store.transferControl(heroA, "B");
    await new Promise((r) => setTimeout(r, 0));

    expect(intents).toHaveLength(1);
    expect(intents[0]).toEqual({
      kind: "SET_CONTROLLER",
      instanceId: heroA,
      controller: "B",
    });
  });

  it("réinitialise le statut mulliganDone lors d'un abandon/quitter puis nouvelle partie en ligne", () => {
    let emit: ((e: PersistedEvent) => void) | null = null;
    const transport = {
      submit: async () => ({ seq: 0 }),
      submitIntent: async () => {},
      subscribe: (
        _id: string,
        _seat: Seat,
        cb: (e: PersistedEvent) => void,
      ) => {
        emit = cb;
        return () => {};
      },
      pull: async () => [] as RedactedEvent[],
      concede: async () => {},
    };

    const deck = createMockDeck();
    useCardStore().cards = deck.cards.map((dc) => dc.card);

    // 1. Partie 1 : démarre et valide le mulligan
    const { events: events1 } = createGame(
      "g-partie-1",
      { A: deck, B: deck },
      { firstPlayer: "A", seedA: "a1", seedB: "b1" },
    );
    const store = useGameStore();
    store.connectOnline("g-partie-1", "A", transport);
    for (const ev of events1) emit!(ev);

    // Envoi de MULLIGAN_DONE pour A
    const seq1 = store.events[store.events.length - 1].seq + 1;
    emit!({
      gameId: "g-partie-1",
      seq: seq1,
      actor: "A",
      type: "MULLIGAN_DONE",
      payload: { seat: "A" },
      timestamp: new Date().toISOString(),
    });
    expect(store.mulliganDone.A).toBe(true);

    // 2. Abandonner / Quitter la partie
    store.quitMatch();
    expect(store.mulliganDone.A).toBe(false);
    expect(store.matchPhase).toBe("lobby");

    // 3. Création et lancement d'une nouvelle partie 2
    const { events: events2 } = createGame(
      "g-partie-2",
      { A: deck, B: deck },
      { firstPlayer: "A", seedA: "a2", seedB: "b2" },
    );
    store.connectOnline("g-partie-2", "A", transport);
    expect(store.mulliganDone.A).toBe(false);

    for (const ev of events2) emit!(ev);

    // Phase mulligan bien active et joueur A NON marqué comme ayant fini son mulligan
    expect(store.matchPhase).toBe("mulligan");
    expect(store.mulliganDone.A).toBe(false);
  });
});
