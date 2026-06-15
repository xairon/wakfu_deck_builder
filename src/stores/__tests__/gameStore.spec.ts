import { setActivePinia, createPinia } from "pinia";
import { beforeEach, describe, it, expect } from "vitest";
import type { Card, Deck } from "@/types/cards";
import type { DraftEvent, PersistedEvent } from "@/game";
import { createGame } from "@/game";
import { useGameStore } from "../gameStore";
import { useCardStore } from "../cardStore";
import {
  createMockAllyCard,
  createMockDeck,
  createMockHavreSacCard,
  createMockHeroCard,
} from "tests/factories/card";

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

describe("gameStore — pouvoirs continus & destructions d'état (lot B)", () => {
  beforeEach(() => setActivePinia(createPinia()));

  function smallDeck(cards: Card[]): Deck {
    return {
      id: `deck-${Math.random().toString(36).slice(2)}`,
      name: "test",
      hero: createMockHeroCard(),
      havreSac: createMockHavreSacCard(),
      cards: cards.map((card) => ({ card, quantity: 1 })),
      createdAt: "",
      updatedAt: "",
    };
  }

  function instOf(store: ReturnType<typeof useGameStore>, cardId: string) {
    return Object.values(store.state.instances).find(
      (i) => i.cardId === cardId,
    )!.instanceId;
  }

  it("devrait détruire d'office le Vrombyx à main vide (1414) avec XP adverse", () => {
    const vrombyx = createMockAllyCard({
      id: "vrombyx-test",
      name: "Vrombyx",
      stats: { niveau: { value: 5, element: "Feu" } }, // pas de Force imprimée
      experience: 2,
      effects: [
        {
          description:
            "La force du Vrombyx est toujours égale au nombre de vos cartes en main.",
        },
      ],
    });
    const filler = createMockAllyCard({ id: "filler-test", name: "Filler" });
    useCardStore().cards = [vrombyx, filler];
    const store = useGameStore();
    store.startSandbox(smallDeck([vrombyx, filler]), smallDeck([]), "A");
    const vId = instOf(store, "vrombyx-test");
    const fId = instOf(store, "filler-test");
    // une carte en main : le Vrombyx entre en jeu à Force effective 1
    store.moveTo(fId, { zone: "main", owner: "A" });
    store.moveTo(vId, { zone: "monde" });
    expect(store.state.monde).toContain(vId);
    expect(store.effectiveForceOf(vId)).toEqual({ value: 1, delta: 1 });
    // main vidée : destruction d'état immédiate + XP à l'adversaire (415.1)
    store.moveTo(fId, { zone: "defausse", owner: "A" });
    expect(store.state.seats.A.defausse).toContain(vId);
    const heroB = store.state.seats.B.heroInstanceId!;
    expect(store.state.instances[heroB].counters.xp).toBe(2);
    expect(store.matchPhase).toBe("playing"); // le point fixe s'arrête
  });

  it("devrait expliquer le refus d'un bloqueur qui ne peut pas bloquer (Jicé)", () => {
    const jice = createMockAllyCard({
      id: "jice-test",
      name: "Jicé Aouaire",
      stats: {
        niveau: { value: 2, element: "Terre" },
        force: { value: 3, element: "Terre" },
      },
      effects: [{ description: "Jicé Aouaire ne peut pas bloquer." }],
    });
    const atk = createMockAllyCard({
      id: "atk-test",
      name: "Attaquant",
      stats: {
        niveau: { value: 1, element: "Feu" },
        force: { value: 2, element: "Feu" },
      },
    });
    useCardStore().cards = [jice, atk];
    const store = useGameStore();
    store.startSandbox(smallDeck([atk]), smallDeck([jice]), "A");
    const atkId = instOf(store, "atk-test");
    const jiceId = instOf(store, "jice-test");
    store.moveTo(atkId, { zone: "monde" });
    store.moveTo(jiceId, { zone: "monde" });
    store.nextTurn(); // tour 2 (B)
    store.nextTurn(); // tour 3 (A) — l'attaque devient légale
    expect(store.beginCombat()).toBe(true);
    store.combatToggleAttacker(atkId);
    store.combatChooseTarget(store.state.seats.B.heroInstanceId!);
    expect(store.combatConfirmAttackers()).toBe(true);
    // clic sur Jicé : refus EXPLIQUÉ, pas silencieux
    store.combatToggleBlock(jiceId);
    expect(store.combat?.blocks).toEqual({});
    expect(store.ruleError).toBe("Jicé Aouaire ne peut pas bloquer.");
  });
});

describe("gameStore — combat, bus & Trêve (lot C)", () => {
  beforeEach(() => setActivePinia(createPinia()));

  function smallDeck(cards: Card[]): Deck {
    return {
      id: `deck-${Math.random().toString(36).slice(2)}`,
      name: "test",
      hero: createMockHeroCard(),
      havreSac: createMockHavreSacCard(),
      cards: cards.map((card) => ({ card, quantity: 1 })),
      createdAt: "",
      updatedAt: "",
    };
  }

  function instOf(store: ReturnType<typeof useGameStore>, cardId: string) {
    return Object.values(store.state.instances).find(
      (i) => i.cardId === cardId,
    )!.instanceId;
  }

  it("incline les attaquants à la déclaration et applique « Quand il attaque » (A6 + bus)", () => {
    const bruss = createMockAllyCard({
      id: "bruss-test",
      name: "Bruss",
      stats: {
        niveau: { value: 1, element: "Feu" },
        force: { value: 2, element: "Feu" },
      },
      effects: [
        {
          description: "Quand Bruss attaque, il gagne +2 en Force.",
          compiled: {
            trigger: "onSelfAttacks",
            ops: [{ op: "combatModSelf", force: 2, pm: 0 }],
          },
        },
      ],
    });
    useCardStore().cards = [bruss];
    const store = useGameStore();
    store.startSandbox(smallDeck([bruss]), smallDeck([]), "A");
    const id = instOf(store, "bruss-test");
    store.moveTo(id, { zone: "monde" });
    store.nextTurn(); // tour 2 (B)
    store.nextTurn(); // tour 3 (A) — l'attaque devient légale
    expect(store.beginCombat()).toBe(true);
    store.combatToggleAttacker(id);
    store.combatChooseTarget(store.state.seats.B.heroInstanceId!);
    expect(store.combatConfirmAttackers()).toBe(true);
    // A6 : incliné dès la déclaration
    expect(store.state.instances[id].orientation).toBe("tapped");
    // bus : « Quand il attaque » a posé +2 Force (jeton de combat)
    expect(store.effectiveForceOf(id)).toEqual({ value: 4, delta: 2 });
  });

  it("Trêve : jeton posé (tour + 2), conservé le tour adverse, purgé à votre tour suivant", () => {
    const store = useGameStore();
    store.startSandbox(smallDeck([]), smallDeck([]), "A");
    store.enqueueEffect({
      seat: "A",
      cardName: "Trêve",
      ops: [{ op: "globalDamageShield" }],
    });
    const heroA = store.state.seats.A.heroInstanceId!;
    const tok = () =>
      store.state.instances[heroA].counters.tokens?.treveUntilTurn ?? 0;
    expect(tok()).toBe(3); // tour 1 + 2
    store.nextTurn(); // tour 2 (adverse) — conservée
    expect(tok()).toBe(3);
    store.nextTurn(); // tour 3 (votre tour) — expirée
    expect(tok()).toBe(0);
  });
});

describe("gameStore — jeu en ligne (clients de confiance)", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("applique les echos serveur et soumet les intentions sans application locale", async () => {
    const submitted: DraftEvent[] = [];
    let emit: ((e: PersistedEvent) => void) | null = null;
    const transport = {
      submit: async (_id: string, d: DraftEvent) => {
        submitted.push(d);
        return { seq: 0 };
      },
      subscribe: (_id: string, cb: (e: PersistedEvent) => void) => {
        emit = cb;
        return () => {};
      },
    };
    const deck = createMockDeck();
    useCardStore().cards = deck.cards.map((dc) => dc.card);
    const { events } = createGame(
      "g-online",
      { A: deck, B: deck },
      { firstPlayer: "A", seedA: "a", seedB: "b" },
    );
    const store = useGameStore();
    store.connectOnline("g-online", "A", transport);
    expect(store.online).toBe(true);
    // le serveur diffuse la mise en place (events COMPLETS) → l'état se construit
    for (const ev of events) emit!(ev);
    expect(store.state.monde.length).toBe(2); // les 2 Havre-Sac
    // une action manuelle soumet l'intention, SANS l'appliquer localement
    const havre = store.state.seats.A.havreSacInstanceId!;
    store.toggleTap(havre);
    await new Promise((r) => setTimeout(r, 0));
    expect(submitted).toHaveLength(1);
    expect(submitted[0].type).toBe("SET_ORIENTATION");
    expect(store.state.instances[havre].orientation).toBe("upright");
  });
});
