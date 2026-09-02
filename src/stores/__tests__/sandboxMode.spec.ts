import { setActivePinia, createPinia } from "pinia";
import { beforeEach, describe, it, expect } from "vitest";
import { useGameStore } from "../gameStore";
import { createMockDeck } from "tests/factories/card";

describe("gameStore — Mode Entraînement Solo (Sandbox / Hot-seat)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("démarre une partie sandbox avec isSandbox=true et sans rideau bloquant de passation", () => {
    const store = useGameStore();
    const deckA = createMockDeck({ id: "deck-a", name: "Deck Test A" });
    const deckB = createMockDeck({ id: "deck-b", name: "Deck Test B" });

    store.startMatch(deckA, deckB, {
      first: "A",
      isSandbox: true,
      nameA: "Deck Test A",
      nameB: "Deck Test B",
    });

    expect(store.isSandbox).toBe(true);
    expect(store.botSeat).toBe(null);
    expect(store.passPending).toBe(false);
    expect(store.matchPhase).toBe("mulligan");
    expect(store.perspective).toBe("A");
  });

  it("gère le cycle de mulligan des deux joueurs sans rideau de passation en mode sandbox", () => {
    const store = useGameStore();
    const deckA = createMockDeck({ id: "deck-a", name: "Deck Test A" });
    const deckB = createMockDeck({ id: "deck-b", name: "Deck Test B" });

    store.startMatch(deckA, deckB, {
      first: "A",
      isSandbox: true,
    });

    // Joueur A garde sa main
    expect(store.mulliganSeat).toBe("A");
    expect(store.passPending).toBe(false);
    store.keepHand();

    // Bascule automatique sur Joueur B pour son mulligan sans rideau bloquant
    expect(store.mulliganSeat).toBe("B");
    expect(store.perspective).toBe("B");
    expect(store.passPending).toBe(false);

    // Joueur B garde sa main → début de partie
    store.keepHand();
    expect(store.matchPhase).toBe("playing");
    expect(store.perspective).toBe("A");
    expect(store.passPending).toBe(false);
  });

  it("met à jour la main du joueur ciblé lors d'un mulligan sans toucher à l'adversaire", () => {
    const store = useGameStore();
    const deckA = createMockDeck({ id: "deck-a", name: "Deck Test A" });
    const deckB = createMockDeck({ id: "deck-b", name: "Deck Test B" });

    store.startMatch(deckA, deckB, {
      first: "A",
      isSandbox: true,
    });

    const initialHandA = [...store.state.seats.A.main];
    const initialHandB = [...store.state.seats.B.main];
    expect(initialHandA.length).toBe(6);
    expect(initialHandB.length).toBe(6);

    // 1. Mulligan gratuit de Joueur A (6 cartes)
    store.mulligan("A");
    expect(store.mulliganCount("A")).toBe(1);
    expect(store.perspective).toBe("A");
    expect(store.mulliganSeat).toBe("A");
    expect(store.state.seats.A.main.length).toBe(6);
    // La main de B est restée intacte
    expect(store.state.seats.B.main).toEqual(initialHandB);

    // 2. Deuxième mulligan de Joueur A (5 cartes)
    store.mulligan("A");
    expect(store.mulliganCount("A")).toBe(2);
    expect(store.state.seats.A.main.length).toBe(5);
    expect(store.state.seats.B.main).toEqual(initialHandB);

    // Joueur A garde sa main
    store.keepHand();
    expect(store.mulliganSeat).toBe("B");
    expect(store.perspective).toBe("B");

    const handABeforeMulliganB = [...store.state.seats.A.main];

    // 3. Mulligan gratuit de Joueur B (6 cartes)
    store.mulligan("B");
    expect(store.mulliganCount("B")).toBe(1);
    expect(store.perspective).toBe("B");
    expect(store.mulliganSeat).toBe("B");
    expect(store.state.seats.B.main.length).toBe(6);
    // La main de A est restée intacte
    expect(store.state.seats.A.main).toEqual(handABeforeMulliganB);

    // Joueur B garde sa main → début de la partie
    store.keepHand();
    expect(store.matchPhase).toBe("playing");
  });

  it("bascule la perspective automatiquement sur le joueur actif lors de endTurn() sans rideau", () => {
    const store = useGameStore();
    const deckA = createMockDeck({ id: "deck-a", name: "Deck Test A" });
    const deckB = createMockDeck({ id: "deck-b", name: "Deck Test B" });

    store.startMatch(deckA, deckB, {
      first: "A",
      isSandbox: true,
    });

    // Skip mulligans
    store.keepHand();
    store.keepHand();

    expect(store.turn.active).toBe("A");
    expect(store.perspective).toBe("A");
    expect(store.passPending).toBe(false);

    // Joueur A termine son tour
    store.endTurn();

    // Tour 2 : actif = B, perspective = B, aucun rideau de passation bloquant
    expect(store.turn.number).toBe(2);
    expect(store.turn.active).toBe("B");
    expect(store.perspective).toBe("B");
    expect(store.passPending).toBe(false);

    // Joueur B termine son tour
    store.endTurn();

    // Tour 3 : actif = A, perspective = A
    expect(store.turn.number).toBe(3);
    expect(store.turn.active).toBe("A");
    expect(store.perspective).toBe("A");
    expect(store.passPending).toBe(false);
  });

  it("permet de basculer manuellement la vue / perspective avec togglePerspective()", () => {
    const store = useGameStore();
    const deckA = createMockDeck({ id: "deck-a", name: "Deck Test A" });
    const deckB = createMockDeck({ id: "deck-b", name: "Deck Test B" });

    store.startMatch(deckA, deckB, {
      first: "A",
      isSandbox: true,
    });

    expect(store.perspective).toBe("A");

    store.togglePerspective();
    expect(store.perspective).toBe("B");

    store.togglePerspective();
    expect(store.perspective).toBe("A");
  });

  it("permet de déplacer les cartes de l'adversaire partout (deck, main, défausse, bannie, monde, havre-sac)", () => {
    const store = useGameStore();
    const deckA = createMockDeck({ id: "deck-a", name: "Deck Test A" });
    const deckB = createMockDeck({ id: "deck-b", name: "Deck Test B" });

    store.startMatch(deckA, deckB, {
      first: "A",
      isSandbox: true,
    });
    store.keepHand();
    store.keepHand();

    // Récupérer une carte de l'adversaire (Joueur B) depuis sa main
    const oppCardId = store.state.seats.B.main[0];
    expect(oppCardId).toBeDefined();

    // 1. Déplacer la carte adverse vers le Monde (terrain)
    store.moveTo(oppCardId, { zone: "monde" });
    expect(store.state.instances[oppCardId]?.location.zone).toBe("monde");

    // 2. Déplacer la carte adverse vers la Défausse (Cimetière) de B
    store.moveTo(oppCardId, { zone: "defausse", owner: "B" });
    expect(store.state.instances[oppCardId]?.location).toEqual({ zone: "defausse", owner: "B" });
    expect(store.state.seats.B.defausse).toContain(oppCardId);

    // 3. Déplacer la carte adverse vers la Zone Bannie (Exil) de B
    store.moveTo(oppCardId, { zone: "exil", owner: "B" });
    expect(store.state.instances[oppCardId]?.location).toEqual({ zone: "exil", owner: "B" });
    expect(store.state.seats.B.exil).toContain(oppCardId);

    // 4. Déplacer la carte adverse vers la Pioche (Deck) de B
    store.moveTo(oppCardId, { zone: "pioche", owner: "B" }, { at: "top" });
    expect(store.state.instances[oppCardId]?.location).toEqual({ zone: "pioche", owner: "B" });
    expect(store.state.seats.B.pioche).toContain(oppCardId);

    // 5. Déplacer la carte adverse vers la Main de B
    store.moveTo(oppCardId, { zone: "main", owner: "B" });
    expect(store.state.instances[oppCardId]?.location).toEqual({ zone: "main", owner: "B" });
    expect(store.state.seats.B.main).toContain(oppCardId);

    // 6. Déplacer la carte adverse vers le Havre-Sac de B
    store.moveTo(oppCardId, { zone: "havreSac", owner: "B" });
    expect(store.state.instances[oppCardId]?.location).toEqual({ zone: "havreSac", owner: "B" });
  });
});
