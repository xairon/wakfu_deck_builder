import { setActivePinia, createPinia } from "pinia";
import { beforeEach, describe, it, expect } from "vitest";
import type { Card, Deck } from "@/types/cards";
import type { DraftEvent, PersistedEvent, RedactedEvent, Seat } from "@/game";
import { createGame, setCounter } from "@/game";
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

  it("gate « Attaquer » : eligibleAttackerIds + canDeclareAttack suivent la légalité (premier tour, mal d'invocation, Havre-Sac, 1/tour)", () => {
    const atk = createMockAllyCard({
      id: "ready-test",
      name: "Prêt",
      stats: {
        niveau: { value: 1, element: "Feu" },
        force: { value: 2, element: "Feu" },
      },
    });
    useCardStore().cards = [atk];
    const store = useGameStore();
    store.startSandbox(smallDeck([atk, atk]), smallDeck([]), "A");
    // tour 1 (A) : premier tour → aucune attaque déclarable
    expect(store.canDeclareAttack).toBe(false);
    const ids = Object.values(store.state.instances)
      .filter((i) => i.controller === "A" && i.cardId === "ready-test")
      .map((i) => i.instanceId);
    const ready = ids[0];
    const sick = ids[1];
    store.moveTo(ready, { zone: "monde" }); // arrive tour 1
    store.nextTurn(); // tour 2 (B)
    store.nextTurn(); // tour 3 (A) — attaque légale
    store.moveTo(sick, { zone: "monde" }); // arrive tour 3 → mal d'invocation
    expect(store.canDeclareAttack).toBe(true);
    expect(store.eligibleAttackerIds).toContain(ready); // prêt depuis le tour 1
    expect(store.eligibleAttackerIds).not.toContain(sick); // arrivé ce tour
    expect(store.eligibleAttackerIds).not.toContain(
      store.state.seats.A.havreSacInstanceId, // pas un combattant
    );
    // après avoir attaqué : plus déclarable ce tour (1/tour)
    store.beginCombat(ready);
    store.combatChooseTarget(store.state.seats.B.heroInstanceId!);
    store.combatConfirmAttackers();
    store.combatResolve();
    expect(store.canDeclareAttack).toBe(false);
  });

  it("riposte : ≥2 attaquants libres ouvrent l'étape riposte, le défenseur choisit (707.1)", () => {
    const mk = (id: string, force: number, el: "Feu" | "Terre") =>
      createMockAllyCard({
        id,
        name: id,
        stats: {
          niveau: { value: 1, element: el },
          force: { value: force, element: el },
        },
      });
    const atk1 = mk("atk1", 1, "Feu");
    const atk2 = mk("atk2", 1, "Feu");
    const cible = mk("cible", 3, "Terre");
    useCardStore().cards = [atk1, atk2, cible];
    const store = useGameStore();
    store.startSandbox(smallDeck([atk1, atk2]), smallDeck([cible]), "A");
    const a1 = instOf(store, "atk1");
    const a2 = instOf(store, "atk2");
    const cb = instOf(store, "cible");
    store.moveTo(a1, { zone: "monde" });
    store.moveTo(a2, { zone: "monde" });
    store.moveTo(cb, { zone: "monde" });
    store.nextTurn();
    store.nextTurn(); // tour 3 (A)
    store.beginCombat(a1);
    store.combatToggleAttacker(a2);
    store.combatChooseTarget(cb);
    expect(store.combatConfirmAttackers()).toBe(true);
    store.combatResolve();
    expect(store.combat?.step).toBe("riposte");
    expect([...store.combatRiposteIds].sort()).toEqual([a1, a2].sort());
    store.combatChooseRiposte(a2);
    // la cible (F3) frappe atk2 → atk2 détruit ; atk1 et la cible survivent
    expect(store.combat).toBeNull();
    expect(store.state.instances[a2].location.zone).toBe("defausse");
    expect(store.state.instances[a1].location.zone).toBe("monde");
    expect(store.state.instances[cb].location.zone).toBe("monde");
  });

  it("multi-bloqueurs : le défenseur choisit l'attaquant gang-bloqué (704)", () => {
    const mk = (id: string, el: "Feu" | "Terre") =>
      createMockAllyCard({
        id,
        name: id,
        stats: {
          niveau: { value: 1, element: el },
          force: { value: 2, element: el },
        },
      });
    const atk1 = mk("ba1", "Feu");
    const atk2 = mk("ba2", "Feu");
    const blk = mk("blk", "Terre");
    useCardStore().cards = [atk1, atk2, blk];
    const store = useGameStore();
    store.startSandbox(smallDeck([atk1, atk2]), smallDeck([blk]), "A");
    const a1 = instOf(store, "ba1");
    const a2 = instOf(store, "ba2");
    const b = instOf(store, "blk");
    store.moveTo(a1, { zone: "monde" });
    store.moveTo(a2, { zone: "monde" });
    store.moveTo(b, { zone: "monde" });
    store.nextTurn();
    store.nextTurn(); // tour 3 (A)
    store.beginCombat(a1);
    store.combatToggleAttacker(a2);
    store.combatChooseTarget(store.state.seats.B.heroInstanceId!);
    store.combatConfirmAttackers();
    // 2 attaquants → cliquer le bloqueur l'arme sans l'assigner
    store.combatToggleBlock(b);
    expect(store.combat?.pendingBlocker).toBe(b);
    expect(store.combat?.blocks[b]).toBeUndefined();
    // le défenseur choisit l'attaquant gang-bloqué
    store.combatChooseBlockTarget(a2);
    expect(store.combat?.blocks[b]).toBe(a2);
    expect(store.combat?.pendingBlocker).toBeNull();
  });

  it("réaction (706.5) : l'attaquant cède la main, le défenseur joue hors-tour, puis retour", () => {
    const atk = createMockAllyCard({
      id: "ratk",
      name: "RAtk",
      stats: {
        niveau: { value: 1, element: "Feu" },
        force: { value: 2, element: "Feu" },
      },
    });
    // carte de réaction NEUTRE niv 1 → payable par n'importe quelle Ressource (4398)
    const react = createMockAllyCard({
      id: "rcard",
      name: "RCard",
      stats: {
        niveau: { value: 1, element: "Neutre" },
        force: { value: 1, element: "Neutre" },
      },
    });
    // Héros + Havre-Sac explicites dans le cardStore : sinon getCard renvoie
    // null pour les producteurs et B n'a aucune Ressource (artefact de test).
    const heroA = createMockHeroCard({ id: "rheroA" });
    const sacA = createMockHavreSacCard({ id: "rsacA" });
    const heroB = createMockHeroCard({ id: "rheroB" });
    const sacB = createMockHavreSacCard({ id: "rsacB" });
    useCardStore().cards = [atk, react, heroA, sacA, heroB, sacB];
    const mk = (hero: Card, sac: Card, cards: Card[]): Deck => ({
      id: `deck-${hero.id}`,
      name: hero.id,
      hero: hero as Deck["hero"],
      havreSac: sac as Deck["havreSac"],
      cards: cards.map((card) => ({ card, quantity: 1 })),
      createdAt: "",
      updatedAt: "",
    });
    const store = useGameStore();
    store.startSandbox(mk(heroA, sacA, [atk]), mk(heroB, sacB, [react]), "A");
    const a = instOf(store, "ratk");
    const rc = instOf(store, "rcard");
    store.moveTo(a, { zone: "monde" });
    store.moveTo(rc, { zone: "main", owner: "B" }); // carte en main de B
    store.nextTurn();
    store.nextTurn(); // tour 3 (A)
    store.beginCombat(a);
    store.combatChooseTarget(store.state.seats.B.heroInstanceId!);
    store.combatConfirmAttackers(); // étape blockers
    // l'attaquant cède la main au défenseur
    store.combatOfferReaction();
    expect(store.combat?.reactingSeat).toBe("B");
    expect(store.perspective).toBe("B");
    expect(store.passPending).toBe(true);
    store.reveal(); // hand-off réaction
    expect(store.passPending).toBe(false);
    // B joue sa carte HORS de son tour → acceptée (légalité de tour relâchée)
    const ok = store.playFromHand(rc);
    expect([ok, store.ruleError]).toEqual([true, null]);
    expect(store.state.instances[rc].location.zone).not.toBe("main");
    // fin de réaction → retour à l'attaquant
    store.combatEndReaction();
    expect(store.combat?.reactingSeat).toBeNull();
    expect(store.perspective).toBe("A");
  });

  it("507.5 : Pioche vide → la Défausse est remélangée pour piocher", () => {
    const cards = ["s1", "s2", "s3"].map((id) =>
      createMockAllyCard({
        id,
        name: id,
        stats: {
          niveau: { value: 1, element: "Feu" },
          force: { value: 1, element: "Feu" },
        },
      }),
    );
    useCardStore().cards = cards;
    const store = useGameStore();
    store.startSandbox(smallDeck(cards), smallDeck(cards), "A");
    // vider la Pioche de A vers la Défausse
    const pioche = [...store.state.seats.A.pioche];
    expect(pioche.length).toBe(3);
    for (const id of pioche) store.moveTo(id, { zone: "defausse", owner: "A" });
    expect(store.state.seats.A.pioche.length).toBe(0);
    expect(store.state.seats.A.defausse.length).toBe(3);
    // piocher 1 → remélange Défausse→Pioche puis pioche
    store.draw("A", 1);
    expect(store.state.seats.A.main.length).toBe(1);
    expect(store.state.seats.A.defausse.length).toBe(0);
    expect(store.state.seats.A.pioche.length).toBe(2);
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

  it("applyServerEvent applique le patch reveals au state dérivé", () => {
    const store = useGameStore();
    // Un event redacté qui porte uniquement un patch `reveals` : l'identité
    // révélée est mémorisée (monotone) et exposée via revealedCardId, prête à
    // être appliquée au state si l'instance existe.
    store.applyServerEvent({
      gameId: "g",
      seq: 99,
      parentSeq: 98,
      actor: "A",
      type: "SAID",
      payload: { text: "x" },
      ts: 0,
      reveals: { ci_X: "real-card" },
    } as never);
    expect(store.revealedCardId("ci_X")).toBe("real-card");
    expect(store.revealedCardId("ci_absent")).toBeNull();
  });
});

function ev(seq: number, reveals?: Record<string, string>): RedactedEvent {
  return {
    gameId: "g",
    seq,
    parentSeq: seq - 1,
    actor: "A",
    type: "SAID",
    payload: { text: String(seq) },
    ts: 0,
    ...(reveals ? { reveals } : {}),
  } as RedactedEvent;
}

describe("applyServerEvent — ordre & resync", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("applique en ordre, dédoublonne, et tient le journal contigu", () => {
    const store = useGameStore();
    const journal = [ev(1), ev(2), ev(3)];
    const transport = {
      submit: async () => ({ seq: 0 }),
      subscribe: () => () => {},
      pull: async () => [] as RedactedEvent[],
      concede: async () => {},
    };
    store.connectOnline("g", "A", transport);
    store.applyServerEvent(journal[0]);
    store.applyServerEvent(journal[1]);
    store.applyServerEvent(journal[1]); // doublon ignoré
    store.applyServerEvent(journal[2]);
    expect(store.onlineJournalSeqs()).toEqual([1, 2, 3]);
  });

  it("met en tampon le hors-ordre et PULL pour combler le trou", async () => {
    const store = useGameStore();
    const full = [ev(1), ev(2), ev(3)];
    let pullArgs: number | null = null;
    const transport = {
      submit: async () => ({ seq: 0 }),
      subscribe: () => () => {},
      pull: async (_g: string, since: number) => {
        pullArgs = since;
        return full.slice(since);
      },
      concede: async () => {},
    };
    store.connectOnline("g", "A", transport);
    store.applyServerEvent(ev(3)); // trou : on n'a pas 1,2 → tampon + pull(0)
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(pullArgs).toBe(0);
    expect(store.onlineJournalSeqs()).toEqual([1, 2, 3]);
  });
});

describe("resyncOnline — course connexion-avant-join", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("rattrape un journal créé APRÈS la connexion (le joueur n'est plus bloqué)", async () => {
    const store = useGameStore();
    const full = [ev(1), ev(2), ev(3)];
    let available: RedactedEvent[] = []; // serveur encore vide au connect (lobby)
    const transport = {
      submit: async () => ({ seq: 0 }),
      subscribe: () => () => {},
      pull: async (_g: string, since: number) => available.slice(since),
      concede: async () => {},
    };
    store.connectOnline("g", "B", transport); // pull(0) tourne sur journal VIDE
    await new Promise((r) => setTimeout(r, 0));
    expect(store.onlineJournalSeqs()).toEqual([]); // rien reçu → resterait bloqué
    available = full; // joinGame vient de créer les events serveur
    await store.resyncOnline(); // le fix : rattrapage explicite
    expect(store.onlineJournalSeqs()).toEqual([1, 2, 3]);
  });
});

describe("matchPhase en ligne (dérivé du journal)", () => {
  beforeEach(() => setActivePinia(createPinia()));

  function started(seq: number): RedactedEvent {
    // Layout minimal mais VALIDE : deux Héros vivants au Havre-Sac. La phase de
    // match dérivée vérifie désormais aussi la victoire (PV ≤ 0), donc l'état
    // doit comporter des sièges et des Héros — sinon « hors du jeu » (103.2c).
    return {
      gameId: "g",
      seq,
      parentSeq: seq - 1,
      actor: "system",
      type: "GAME_STARTED",
      payload: {
        state: {
          instances: {
            hA: {
              instanceId: "hA",
              location: { zone: "havreSac", owner: "A" },
              counters: { hp: 20, xp: 0 },
            },
            hB: {
              instanceId: "hB",
              location: { zone: "havreSac", owner: "B" },
              counters: { hp: 20, xp: 0 },
            },
          },
          seats: {
            A: { heroInstanceId: "hA" },
            B: { heroInstanceId: "hB" },
          },
        },
      },
      ts: 0,
    } as unknown as RedactedEvent;
  }
  function mullDone(seat: "A" | "B", seq: number): RedactedEvent {
    return {
      gameId: "g",
      seq,
      parentSeq: seq - 1,
      actor: seat,
      type: "MULLIGAN_DONE",
      payload: { seat },
      ts: 0,
    } as RedactedEvent;
  }

  it("journal vide ⇒ lobby ; GAME_STARTED ⇒ mulligan ; les deux MULLIGAN_DONE ⇒ playing", () => {
    const store = useGameStore();
    const transport = {
      submit: async () => ({ seq: 0 }),
      subscribe: () => () => {},
      pull: async () => [] as RedactedEvent[],
      concede: async () => {},
    };
    store.connectOnline("g", "A", transport);
    expect(store.matchPhase).toBe("lobby");
    store.applyServerEvent(started(1));
    expect(store.matchPhase).toBe("mulligan");
    store.applyServerEvent(mullDone("A", 2));
    expect(store.matchPhase).toBe("mulligan"); // un seul siège prêt
    store.applyServerEvent(mullDone("B", 3));
    expect(store.matchPhase).toBe("playing");
    expect(store.mulliganDoneOnline()).toEqual({ A: true, B: true });
  });
});

describe("victoire en ligne (dérivée de l'état partagé)", () => {
  beforeEach(() => setActivePinia(createPinia()));

  function mullDone(seat: "A" | "B", seq: number): RedactedEvent {
    return {
      gameId: "g",
      seq,
      parentSeq: seq - 1,
      actor: seat,
      type: "MULLIGAN_DONE",
      payload: { seat },
      ts: 0,
    } as RedactedEvent;
  }
  function counterEv(
    seat: "A" | "B",
    instanceId: string,
    counter: string,
    value: number,
    seq: number,
  ): RedactedEvent {
    return {
      ...setCounter(seat, instanceId, counter, value),
      gameId: "g",
      seq,
      parentSeq: seq - 1,
      ts: 0,
    } as RedactedEvent;
  }

  /** Branche une partie en ligne au siège A, jusqu'en phase « playing ». */
  function startedOnlineGame(): {
    store: ReturnType<typeof useGameStore>;
    nextSeq: () => number;
  } {
    const deck = createMockDeck();
    useCardStore().cards = deck.cards.map((dc) => dc.card);
    const { events } = createGame(
      "g",
      { A: deck, B: deck },
      { firstPlayer: "A", seedA: "a", seedB: "b" },
    );
    const store = useGameStore();
    const transport = {
      submit: async () => ({ seq: 0 }),
      subscribe: () => () => {},
      pull: async () => [] as RedactedEvent[],
      concede: async () => {},
    };
    store.connectOnline("g", "A", transport);
    for (const ev of events) store.applyServerEvent(ev);
    let seq = events[events.length - 1].seq;
    const nextSeq = () => ++seq;
    store.applyServerEvent(mullDone("A", nextSeq()));
    store.applyServerEvent(mullDone("B", nextSeq()));
    expect(store.matchPhase).toBe("playing");
    return { store, nextSeq };
  }

  it("PV d'un Héros ≤ 0 ⇒ matchPhase 'finished' + l'adversaire l'emporte", () => {
    const { store, nextSeq } = startedOnlineGame();
    const heroB = store.state.seats.B.heroInstanceId!;
    // le serveur diffuse les dégâts létaux portés au Héros B (résolution
    // manuelle : un joueur a fixé ses PV à 0) → victoire dérivée de l'état.
    store.applyServerEvent(counterEv("B", heroB, "hp", 0, nextSeq()));
    expect(store.matchPhase).toBe("finished");
    expect(store.winner).toBe("A");
  });

  it("Héros blessé mais vivant ⇒ la partie continue (pas de fin prématurée)", () => {
    const { store, nextSeq } = startedOnlineGame();
    const heroB = store.state.seats.B.heroInstanceId!;
    store.applyServerEvent(counterEv("B", heroB, "hp", 5, nextSeq()));
    expect(store.matchPhase).toBe("playing");
    expect(store.winner).toBeNull();
  });

  it("la fin est TERMINALE : un echo ultérieur ne « dé-finit » pas la partie", () => {
    const { store, nextSeq } = startedOnlineGame();
    const heroA = store.state.seats.A.heroInstanceId!;
    const heroB = store.state.seats.B.heroInstanceId!;
    // morts SÉQUENTIELLES : A tombe le premier (B encore vivant) → B l'emporte.
    store.applyServerEvent(counterEv("A", heroA, "hp", 0, nextSeq()));
    expect(store.matchPhase).toBe("finished");
    expect(store.winner).toBe("B");
    // un event ultérieur (l'autre Héros tombe aussi, ou un simple message) NE
    // doit PAS ramener la phase à « playing » ni changer le vainqueur.
    store.applyServerEvent(counterEv("B", heroB, "hp", 0, nextSeq()));
    expect(store.matchPhase).toBe("finished");
    expect(store.winner).toBe("B");
  });

  it("double 0 PV dans la MÊME mise à jour d'état ⇒ aucun vainqueur (103.3)", () => {
    const { store, nextSeq } = startedOnlineGame();
    const heroA = store.state.seats.A.heroInstanceId!;
    const heroB = store.state.seats.B.heroInstanceId!;
    const seqA = nextSeq();
    const seqB = nextSeq();
    // livraison hors-ordre : l'event B (postérieur) arrive d'abord et reste en
    // tampon ; l'arrivée de A déclenche l'ajout des DEUX en un seul lot → un seul
    // calcul de victoire sur un état où les deux Héros sont à 0 simultanément.
    store.applyServerEvent(counterEv("B", heroB, "hp", 0, seqB));
    expect(store.matchPhase).toBe("playing"); // rien d'appliqué (trou de seq)
    store.applyServerEvent(counterEv("A", heroA, "hp", 0, seqA));
    expect(store.matchPhase).toBe("playing"); // égalité : pas de fausse victoire
    expect(store.winner).toBeNull();
  });
});

describe("fin autoritative serveur (GAME_OVER) + mode assisté partagé", () => {
  beforeEach(() => setActivePinia(createPinia()));

  function mullDone(seat: "A" | "B", seq: number): RedactedEvent {
    return {
      gameId: "g",
      seq,
      parentSeq: seq - 1,
      actor: seat,
      type: "MULLIGAN_DONE",
      payload: { seat },
      ts: 0,
    } as RedactedEvent;
  }
  function gameOver(
    winner: "A" | "B" | "draw",
    reason: "concede" | "defeat" | "disconnect",
    seq: number,
  ): RedactedEvent {
    return {
      gameId: "g",
      seq,
      parentSeq: seq - 1,
      actor: "system",
      type: "GAME_OVER",
      payload: { winner, reason },
      ts: 0,
    } as RedactedEvent;
  }

  it("un GAME_OVER diffusé fige la partie (finished) et désigne le vainqueur sur le client", () => {
    const deck = createMockDeck();
    useCardStore().cards = deck.cards.map((dc) => dc.card);
    const { events } = createGame(
      "g",
      { A: deck, B: deck },
      { firstPlayer: "A", seedA: "a", seedB: "b" },
    );
    const store = useGameStore();
    const transport = {
      submit: async () => ({ seq: 0 }),
      subscribe: () => () => {},
      pull: async () => [] as RedactedEvent[],
      concede: async () => {},
    };
    store.connectOnline("g", "B", transport); // on observe depuis le siège B
    for (const ev of events) store.applyServerEvent(ev);
    let seq = events[events.length - 1].seq;
    store.applyServerEvent(mullDone("A", ++seq));
    store.applyServerEvent(mullDone("B", ++seq));
    expect(store.matchPhase).toBe("playing");
    // concession de B → le serveur diffuse GAME_OVER{winner:'A', concede} :
    // les deux clients dérivent finished + vainqueur A depuis le journal.
    store.applyServerEvent(gameOver("A", "concede", ++seq));
    expect(store.matchPhase).toBe("finished");
    expect(store.winner).toBe("A");
  });

  it("connectOnline(..., assisted=true) active les règles assistées (mode partagé)", () => {
    const store = useGameStore();
    const transport = {
      submit: async () => ({ seq: 0 }),
      subscribe: () => () => {},
      pull: async () => [] as RedactedEvent[],
      concede: async () => {},
    };
    store.connectOnline("g", "A", transport, true);
    expect(store.assist).toBe(true);
    // par défaut (omis) → règles libres
    store.connectOnline("g", "A", transport);
    expect(store.assist).toBe(false);
  });
});
