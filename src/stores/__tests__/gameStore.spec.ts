import { setActivePinia, createPinia } from "pinia";
import { beforeEach, describe, it, expect } from "vitest";
import { useGameStore } from "../gameStore";
import { useCardStore } from "../cardStore";
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

  it("recycleFromDiscard filtré par élément : rien d'éligible → effet passé, sinon picker filtré", () => {
    const store = useGameStore();
    const deck = createMockDeck();
    // toutes les cartes du deck produisent du Feu
    for (const dc of deck.cards)
      dc.card.stats = { niveau: { value: 1, element: "Feu" } };
    // getCard résout via le cardStore : on y référence les cartes du deck
    useCardStore().cards = deck.cards.map((dc) => dc.card);
    store.startSandbox(deck, deck, "A");
    store.draw("A", 2);
    for (const id of [...store.state.seats.A.main])
      store.moveTo(id, { zone: "defausse", owner: "A" });
    expect(store.state.seats.A.defausse.length).toBe(2);
    // aucune carte Terre dans la défausse → l'effet est passé sans picker
    store.enqueueEffect({
      seat: "A",
      cardName: "Test Terre",
      ops: [{ op: "recycleFromDiscard", n: 1, element: "Terre" }],
    });
    expect(store.effectPicking).toBeNull();
    expect(store.state.seats.A.defausse.length).toBe(2);
    // l'élément correspond → picker ouvert, filtré sur les 2 cartes Feu
    store.enqueueEffect({
      seat: "A",
      cardName: "Test Feu",
      ops: [{ op: "recycleFromDiscard", n: 1, element: "Feu" }],
    });
    expect(store.effectPicking).not.toBeNull();
    expect(store.effectPickIds.length).toBe(2);
    store.effectPick(store.effectPickIds[0]);
    expect(store.state.seats.A.defausse.length).toBe(1);
    expect(store.effectPicking).toBeNull();
  });

  it("limite de main = PA (4873) : défausse obligatoire de l'excédent", () => {
    const store = useGameStore();
    const deck = createMockDeck();
    store.startSandbox(deck, deck, "A");
    // PA = 6 ; piocher 8 → excédent de 2 → choix OBLIGATOIRE ouvert
    store.draw("A", 8);
    expect(store.state.seats.A.main.length).toBe(8);
    expect(store.effectPicking?.mandatory).toBe(true);
    expect(store.effectPicking?.remaining).toBe(2);
    // impossible de passer le choix ni de finir le tour
    store.effectPickSkip();
    expect(store.effectPicking).not.toBeNull();
    store.endTurn();
    expect(store.turn.number).toBe(1);
    // défausser 2 cartes → main à 6, choix fermé, le tour peut finir
    store.effectPick(store.effectPickIds[0]);
    store.effectPick(store.effectPickIds[0]);
    expect(store.state.seats.A.main.length).toBe(6);
    expect(store.effectPicking).toBeNull();
    expect(store.state.seats.A.defausse.length).toBe(2);
    store.endTurn();
    expect(store.turn.number).toBe(2);
  });
});

describe("gameStore — flux de match (lobby/mulligan/tour)", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("startMatch distribue une main de départ de 6 (= PA) et passe en mulligan", () => {
    const store = useGameStore();
    const deck = createMockDeck();
    store.startMatch(deck, deck, { first: "A" });
    expect(store.matchPhase).toBe("mulligan");
    expect(store.passPending).toBe(true);
    expect(store.perspective).toBe("A");
    expect(store.state.seats.A.main.length).toBe(6);
    expect(store.state.seats.B.main.length).toBe(6);
    expect(store.state.seats.A.pioche.length).toBe(42);
  });

  it("reveal lève l'écran de passation", () => {
    const store = useGameStore();
    const deck = createMockDeck();
    store.startMatch(deck, deck, { first: "A" });
    store.reveal();
    expect(store.passPending).toBe(false);
  });

  it("mulligan re-pioche une carte de moins", () => {
    const store = useGameStore();
    const deck = createMockDeck();
    store.startMatch(deck, deck, { first: "A" });
    store.mulligan("A");
    expect(store.state.seats.A.main.length).toBe(5);
  });

  it("keepHand enchaîne joueur 2 puis lance la partie", () => {
    const store = useGameStore();
    const deck = createMockDeck();
    store.startMatch(deck, deck, { first: "A" });
    store.keepHand(); // A garde → au tour de B (mulligan)
    expect(store.matchPhase).toBe("mulligan");
    expect(store.perspective).toBe("B");
    store.keepHand(); // B garde → partie
    expect(store.matchPhase).toBe("playing");
    expect(store.perspective).toBe("A");
  });

  it("endTurn pioche jusqu'aux PA puis bascule la perspective", () => {
    const store = useGameStore();
    const deck = createMockDeck();
    store.startSandbox(deck, deck, "A"); // partie directe, main vide
    expect(store.turn.active).toBe("A");
    store.endTurn();
    expect(store.state.seats.A.main.length).toBe(6); // pioche fin de tour = PA
    expect(store.turn.active).toBe("B");
    expect(store.perspective).toBe("B");
    expect(store.passPending).toBe(true);
  });
});
