import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useGameStore } from "@/stores/gameStore";
import { buildInitialLayout } from "@/game/engine/setup";

import { createMockDeck, createMockAllyCard } from "tests/factories/card";

describe("Validation du mélange du deck en mode partie 1v1", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("1. Le layout initial (buildInitialLayout) mélange d'emblée les cartes dans la pioche", () => {
    const card1 = createMockAllyCard({ id: "carte-a", name: "Carte A" });
    const card2 = createMockAllyCard({ id: "carte-b", name: "Carte B" });
    const card3 = createMockAllyCard({ id: "carte-c", name: "Carte C" });
    const deck = createMockDeck({
      cards: [
        { card: card1, quantity: 16 },
        { card: card2, quantity: 16 },
        { card: card3, quantity: 16 },
      ],
    });

    const layout = buildInitialLayout("partie-test", { A: deck, B: deck });
    const piocheInitiale = layout.seats.A.pioche.map((id) => layout.instances[id].cardId);

    // Les 16 premières cartes ne doivent PAS être toutes identiques ("carte-a")
    const les16PremieresIdentiques = piocheInitiale.slice(0, 16).every((id) => id === "carte-a");
    expect(les16PremieresIdentiques).toBe(false);
  });

  it("2. Au début de partie (createGame/startMatch), le deck est mélangé et les tirages successifs sont diversifiés", () => {
    const card1 = createMockAllyCard({ id: "carte-a", name: "Carte A" });
    const card2 = createMockAllyCard({ id: "carte-b", name: "Carte B" });
    const card3 = createMockAllyCard({ id: "carte-c", name: "Carte C" });
    const deckA = createMockDeck({
      cards: [
        { card: card1, quantity: 16 },
        { card: card2, quantity: 16 },
        { card: card3, quantity: 16 },
      ],
    });
    const deckB = createMockDeck({ cards: [{ card: card1, quantity: 48 }] });

    const store = useGameStore();
    store.startMatch(deckA, deckB, { first: "A" });

    const piocheIds = store.state.seats.A.pioche;
    const cartesPioche = piocheIds.map((id) => store.resolveInstanceCard(id)?.id);

    // La pioche ne doit pas être un bloc contigu de 16 cartes "carte-a"
    const les16PremieresSontIdentiques = cartesPioche.slice(0, 16).every((id) => id === "carte-a");
    expect(les16PremieresSontIdentiques).toBe(false);

    // Lorsqu'on pioche 5 cartes, la main contient une variété de cartes et non toujours la même
    const mainCartes = store.state.seats.A.main.map((id) => store.resolveInstanceCard(id)?.id);
    const cartesUniquesPiochees = new Set(mainCartes);
    expect(cartesUniquesPiochees.size).toBeGreaterThan(1);
  });

  it("3. À la fermeture du modal 'Chercher', la pioche est à nouveau réordonnée de façon aléatoire", () => {
    const card1 = createMockAllyCard({ id: "carte-a", name: "Carte A" });
    const card2 = createMockAllyCard({ id: "carte-b", name: "Carte B" });
    const card3 = createMockAllyCard({ id: "carte-c", name: "Carte C" });
    const deckA = createMockDeck({
      cards: [
        { card: card1, quantity: 16 },
        { card: card2, quantity: 16 },
        { card: card3, quantity: 16 },
      ],
    });
    const deckB = createMockDeck({ cards: [{ card: card1, quantity: 48 }] });

    const store = useGameStore();
    store.startSandbox(deckA, deckB, "A");

    const ordreAvantChercher = [...store.state.seats.A.pioche];

    // Simulation de l'action "Chercher dans le deck"
    const openOk = store.searchMyDeck();
    expect(openOk).toBe(true);

    // Simulation de la fermeture du modal de recherche (qui déclenche shuffleMyDeck)
    store.shuffleMyDeck();

    const ordreApresFermetureModal = [...store.state.seats.A.pioche];

    // L'ordre des identifiants d'instance dans la pioche doit avoir changé
    expect(ordreAvantChercher).not.toEqual(ordreApresFermetureModal);

    // Vérifier également qu'on peut piocher normalement après ce mélange
    const mainTailleAvant = store.state.seats.A.main.length;
    store.draw("A", 1);
    expect(store.state.seats.A.main.length).toBe(mainTailleAvant + 1);
  });

  it("4. À la fermeture du modal 'Chercher', le deck est mélangé MÊME si ce n'est PAS le tour du joueur", () => {
    const card1 = createMockAllyCard({ id: "carte-a", name: "Carte A" });
    const card2 = createMockAllyCard({ id: "carte-b", name: "Carte B" });
    const deckA = createMockDeck({ cards: [{ card: card1, quantity: 48 }] });
    const deckB = createMockDeck({
      cards: [
        { card: card1, quantity: 24 },
        { card: card2, quantity: 24 },
      ],
    });

    const store = useGameStore();
    // Joueur actif est "A"
    store.startMatch(deckA, deckB, { first: "A" });
    expect(store.state.turn.active).toBe("A");

    // Perspective est "B" (joueur NON-ACTIF)
    store.perspective = "B";

    const ordreAvantChercher = [...store.state.seats.B.pioche];

    // Joueur B cherche dans son deck hors-tour
    const openOk = store.searchMyDeck();
    expect(openOk).toBe(true);

    // Joueur B referme la recherche et mélange son deck
    expect(() => store.shuffleMyDeck()).not.toThrow();

    const ordreApresFermetureModal = [...store.state.seats.B.pioche];
    expect(ordreAvantChercher).not.toEqual(ordreApresFermetureModal);
  });
});

