import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useGameStore } from "@/stores/gameStore";
import { useCardStore } from "@/stores/cardStore";
import { botStep, botReactInCombat } from "@/game/ai/botPolicy";
import type { Card, Deck } from "@/types/cards";
import {
  createMockHeroCard,
  createMockHavreSacCard,
  createMockAllyCard,
} from "tests/factories/card";

/** Deck minimal (Héros + Havre-Sac + 48 Alliés vanille SANS pouvoir). */
function makeDeck(tag: string): { deck: Deck; cards: Card[] } {
  const hero = createMockHeroCard({ id: tag + "-hero", name: tag + " Héros" });
  const sac = createMockHavreSacCard({ id: tag + "-sac", name: tag + " Sac" });
  const ally = createMockAllyCard({
    id: tag + "-ally",
    name: tag + " Allié",
    stats: {
      niveau: { value: 1, element: "Feu" },
      force: { value: 1, element: "Feu" },
    },
  });
  const deck: Deck = {
    id: tag,
    name: tag,
    hero,
    havreSac: sac,
    cards: [{ card: ally, quantity: 48 }],
    createdAt: "2026-07-08T00:00:00.000Z",
    updatedAt: "2026-07-08T00:00:00.000Z",
  };
  return { deck, cards: [hero, sac, ally] };
}

/** Deck dont le HÉROS porte un pouvoir onTap offensif « inflige 2 Dommages à
 *  l'Allié ou Héros de votre choix » (façon Tirlangue Portey). */
function makeDeckPoweredHero(tag: string): { deck: Deck; cards: Card[] } {
  const powerFace = {
    // Élément Air (comme Tirlangue) : le Héros produit de l'Air, donc il ne paie
    // pas un Allié Neutre (payé par le Havre-Sac) → reste dressé dans les tests.
    stats: { pv: 16, pa: 6, pm: 3, niveau: { value: 1, element: "Air" } },
    effects: [
      {
        description: "inflige 2 Dommages à l'Allié ou Héros de votre choix.",
        compiled: {
          trigger: "onTap" as const,
          ops: [
            {
              op: "damageTarget" as const,
              n: 2,
              element: "Air",
              heroes: true,
              zones: ["monde", "havreSac"] as ("monde" | "havreSac")[],
            },
          ],
        },
      },
    ] as unknown as Card["effects"],
    keywords: [],
  };
  const hero = createMockHeroCard({
    id: tag + "-hero",
    name: tag + " Tirlangue",
    recto: powerFace as never,
    verso: powerFace as never,
  });
  const sac = createMockHavreSacCard({ id: tag + "-sac", name: tag + " Sac" });
  const ally = createMockAllyCard({
    id: tag + "-ally",
    name: tag + " Allié",
    stats: {
      niveau: { value: 1, element: "Feu" },
      force: { value: 1, element: "Feu" },
    },
  });
  const deck: Deck = {
    id: tag,
    name: tag,
    hero,
    havreSac: sac,
    cards: [{ card: ally, quantity: 48 }],
    createdAt: "2026-07-09T00:00:00.000Z",
    updatedAt: "2026-07-09T00:00:00.000Z",
  };
  return { deck, cards: [hero, sac, ally] };
}

describe("botPolicy — le bot ne pollue pas le joueur avec ses sondages", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("sonder une carte de main INJOUABLE ne laisse pas de ruleError visible (T1)", () => {
    // Le bot sonde sa main via playFromHand ; une carte impayable (aucune
    // Ressource au 1er tour) posait un ruleError remonté à l'humain (assistant +
    // annonce lecteur d'écran) à CHAQUE tour du bot. Le sondage doit être muet.
    const a = makeDeck("A");
    const b = makeDeck("B");
    useCardStore().cards = [...a.cards, ...b.cards];
    const store = useGameStore();
    store.startSandbox(a.deck, b.deck, "B"); // tour du bot (B), 0 Ressource
    store.assistEffects = true;
    store.botAggressive = false;

    // Une carte du bot en main, injouable (coût non payable).
    const bAllyId = store.state.seats.B.pioche.find(
      (id) => store.state.instances[id]?.cardId === "B-ally",
    )!;
    store.moveTo(bAllyId, { zone: "main", owner: "B" });
    store.perspective = "B";
    store.ruleError = null;

    botStep(store, new Set());

    expect(store.ruleError).toBeNull();
  });

  it("ne pose PAS de ruleError en sondant une carte SANS pouvoir (« Pas de pouvoir à inclinaison automatisé »)", () => {
    // Régression : mainPhase sondait activateTapPower sur TOUTES ses cartes ; sur
    // une carte sans pouvoir compilé, le rejet posait un ruleError VISIBLE par
    // l'humain (assistant de règles). Le bot doit d'abord filtrer via hasTapPower.
    const a = makeDeck("A");
    const b = makeDeck("B");
    useCardStore().cards = [...a.cards, ...b.cards];
    const store = useGameStore();
    store.startSandbox(a.deck, b.deck, "B"); // tour du bot (B), mains vides
    store.assistEffects = true; // requis pour qu'activateTapPower s'exécute
    store.botAggressive = false; // pas d'attaque → on atteint l'étape des pouvoirs

    // Un Allié (sans pouvoir) dans le Monde du bot.
    const bAllyId = store.state.seats.B.pioche.find(
      (id) => store.state.instances[id]?.cardId === "B-ally",
    )!;
    store.moveTo(bAllyId, { zone: "monde" });
    store.perspective = "B";
    store.ruleError = null;

    botStep(store, new Set());

    expect(store.ruleError).not.toBe(
      "Pas de pouvoir à inclinaison automatisé.",
    );
  });

  it("un damageTarget OBLIGATOIRE sans cible adverse : le bot vise sa cible la MOINS pénalisante (P2-10)", () => {
    // « Infligez … à l'Allié ou Héros de votre choix » est OBLIGATOIRE : une fois
    // l'effet sur la pile, « Passer » est refusé (P2-10) tant qu'une cible légale
    // existe. Faute de cible adverse (Héros A embagué, 508.x), le bot ne peut plus
    // esquiver — il choisit la cible éligible la moins pénalisante (Force la plus
    // faible). Le VRAI garde anti-gaspillage vit en amont (ne pas JOUER la carte
    // sans cible, cf. tapPowerLacksAdverseTarget) — pas dans la résolution.
    const a = makeDeck("A");
    const b = makeDeck("B");
    useCardStore().cards = [...a.cards, ...b.cards];
    const store = useGameStore();
    store.startSandbox(a.deck, b.deck, "A");
    store.assistEffects = true;

    // Un Allié du bot dans le Monde ; le Héros A reste embagé, aucun Allié A au
    // Monde → aucune cible adverse légale (508.x).
    const bAllyId = store.state.seats.B.pioche.find(
      (id) => store.state.instances[id]?.cardId === "B-ally",
    )!;
    store.moveTo(bAllyId, { zone: "monde" });

    store.perspective = "B";
    store.enqueueEffect({
      seat: "B",
      cardName: "Tirlangue (test)",
      ops: [
        {
          op: "damageTarget",
          n: 2,
          element: "Air",
          heroes: true,
          zones: ["monde", "havreSac"],
        },
      ],
    });
    expect(store.effectTargeting?.op.op).toBe("damageTarget");
    const heroB = store.state.seats.B.heroInstanceId!;
    const hpBefore = store.state.instances[heroB].counters.hp ?? 0;

    botStep(store, new Set());

    // L'effet est résolu (plus de picker bloqué) et les 2 Dommages ont été
    // appliqués à UNE cible éligible du bot (obligatoire) — pas esquivés.
    expect(store.effectTargeting).toBeNull();
    const allyHit = (store.state.instances[bAllyId].counters.damage ?? 0) === 2;
    const heroHit =
      (store.state.instances[heroB].counters.hp ?? 0) === hpBefore - 2;
    expect(allyHit || heroHit).toBe(true);
  });

  it("n'INCLINE PAS un pouvoir offensif sans cible adverse (Tirlangue vs Héros embagé)", () => {
    // Le Héros du bot porte « inflige 2 Dommages à l'Allié ou Héros » ; l'adversaire
    // n'a que son Héros EMBAGÉ (hors de portée, 508.1b) et aucun Allié → le pouvoir
    // ne peut frapper personne. Le bot ne doit PAS gaspiller l'inclinaison.
    const a = makeDeck("A");
    const b = makeDeckPoweredHero("B");
    useCardStore().cards = [...a.cards, ...b.cards];
    const store = useGameStore();
    store.startSandbox(a.deck, b.deck, "B"); // tour du bot (B)
    store.assistEffects = true;
    store.botAggressive = false; // pas d'attaque → on atteint l'étape des pouvoirs
    store.perspective = "B";

    const heroB = store.state.seats.B.heroInstanceId!;
    // Plusieurs battements : le bot ne doit jamais incliner son Héros pour rien.
    const tried = new Set<string>();
    for (let i = 0; i < 5; i++) botStep(store, tried);

    expect(store.state.instances[heroB].orientation).toBe("upright");
    expect(store.effectTargeting).toBeNull();
  });

  it("1er tour (bot = 1er joueur) : pose Salle ET Allié dans son Havre-Sac (303.1), ne gaspille PAS Tirlangue", () => {
    const b = makeDeckPoweredHero("B"); // Héros type Tirlangue (pouvoir offensif)
    const salle = {
      ...createMockAllyCard({
        id: "b-salle",
        name: "Temple Test",
        stats: { niveau: { value: 0, element: "Neutre" } },
      }),
      mainType: "Salle",
    } as unknown as Card;
    const mondeAlly = createMockAllyCard({
      id: "b-monde",
      name: "Allié Monde",
      // Élément Neutre → payable par le Havre-Sac (producteur Neutre) au 1er tour.
      stats: {
        niveau: { value: 1, element: "Neutre" },
        force: { value: 1, element: "Neutre" },
      },
    });
    b.deck.cards.push({ card: salle, quantity: 1 });
    b.deck.cards.push({ card: mondeAlly, quantity: 1 });
    const a = makeDeck("A");
    useCardStore().cards = [...a.cards, ...b.cards, salle, mondeAlly];
    const store = useGameStore();
    store.startSandbox(a.deck, b.deck, "B"); // B commence → tour 1 = B
    store.assistEffects = true;
    store.botAggressive = false;

    // Salle + Allié-Monde en main de B.
    const salleId = store.state.seats.B.pioche.find(
      (id) => store.state.instances[id]?.cardId === "b-salle",
    )!;
    const mondeId = store.state.seats.B.pioche.find(
      (id) => store.state.instances[id]?.cardId === "b-monde",
    )!;
    store.moveTo(salleId, { zone: "main", owner: "B" });
    store.moveTo(mondeId, { zone: "main", owner: "B" });
    store.perspective = "B";
    const heroB = store.state.seats.B.heroInstanceId!;

    const tried = new Set<string>();
    for (let i = 0; i < 10; i++) botStep(store, tried);

    // Au 1er tour (Monde interdit, 506.3) : la Salle ET l'Allié arrivent dans le
    // Havre-Sac (303.1 — développement de Ressources) ; Tirlangue non gaspillé.
    expect(store.state.instances[salleId].location.zone).toBe("havreSac");
    expect(store.state.instances[mondeId].location.zone).toBe("havreSac");
    expect(store.state.instances[heroB].orientation).toBe("upright");
  });

  it("botReactInCombat : le bot DÉFENSEUR réagit à l'attaque en activant un pouvoir utile", () => {
    const a = makeDeck("A"); // A a un attaquant (A-ally, Force 1)
    const b = makeDeckPoweredHero("B"); // B a un Héros « inflige 2 Dommages »
    useCardStore().cards = [...a.cards, ...b.cards];
    const store = useGameStore();
    store.startSandbox(a.deck, b.deck, "A");
    store.assistEffects = true;

    // A place un attaquant et déclare une attaque à son tour (tour 3).
    const aAtkId = store.state.seats.A.pioche.find(
      (id) => store.state.instances[id]?.cardId === "A-ally",
    )!;
    store.moveTo(aAtkId, { zone: "monde" });
    store.nextTurn(); // 2 (B)
    store.nextTurn(); // 3 (A)
    store.perspective = "A";
    expect(store.beginCombat(aAtkId)).toBe(true);
    store.combatChooseTarget(store.state.seats.B.havreSacInstanceId!);
    expect(store.combatConfirmAttackers()).toBe(true); // step blockers, B défenseur

    // Vue côté bot le temps d'agir (comme le driver useBotOpponent).
    store.perspective = "B";
    const heroB = store.state.seats.B.heroInstanceId!;
    // L'attaquant de A (Monde) est une cible adverse légale → le bot réagit.
    expect(botReactInCombat(store, "B", new Set())).toBe(true);
    expect(store.state.instances[heroB].orientation).toBe("tapped");
  });

  it("botReactInCombat : ne réagit pas s'il n'a aucun pouvoir utile", () => {
    const a = makeDeck("A"); // attaquant
    const b = makeDeck("B"); // Héros SANS pouvoir
    useCardStore().cards = [...a.cards, ...b.cards];
    const store = useGameStore();
    store.startSandbox(a.deck, b.deck, "A");
    store.assistEffects = true;
    const aAtkId = store.state.seats.A.pioche.find(
      (id) => store.state.instances[id]?.cardId === "A-ally",
    )!;
    store.moveTo(aAtkId, { zone: "monde" });
    store.nextTurn();
    store.nextTurn();
    store.perspective = "A";
    store.beginCombat(aAtkId);
    store.combatChooseTarget(store.state.seats.B.havreSacInstanceId!);
    store.combatConfirmAttackers();
    store.perspective = "B";
    expect(botReactInCombat(store, "B", new Set())).toBe(false);
  });

  it("INCLINE bien le pouvoir offensif quand une cible adverse existe", () => {
    // Même Héros, mais l'adversaire a un Allié dans le Monde → cible légale : le bot
    // active le pouvoir (incline le Héros) au lieu de passer.
    const a = makeDeck("A");
    const b = makeDeckPoweredHero("B");
    useCardStore().cards = [...a.cards, ...b.cards];
    const store = useGameStore();
    store.startSandbox(a.deck, b.deck, "B");
    store.assistEffects = true;
    store.botAggressive = false;
    store.perspective = "B";

    // Un Allié adverse (A) exposé dans le Monde → cible légale du pouvoir.
    const aAllyId = store.state.seats.A.pioche.find(
      (id) => store.state.instances[id]?.cardId === "A-ally",
    )!;
    store.moveTo(aAllyId, { zone: "monde" });

    const heroB = store.state.seats.B.heroInstanceId!;
    const tried = new Set<string>();
    for (let i = 0; i < 5; i++) botStep(store, tried);

    expect(store.state.instances[heroB].orientation).toBe("tapped");
  });
});
