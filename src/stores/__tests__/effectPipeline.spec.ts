import { describe, it, expect } from "vitest";
import { otherSeat } from "@/game";
import {
  makeEffectSandbox,
  placeInZone,
  counters,
  logText,
} from "./effectPipeline.harness";

describe("pipeline d'effets — ops self / non-interactives", () => {
  it("draw : pioche N cartes", () => {
    const { store } = makeEffectSandbox();
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "draw", n: 2 }],
    });
    expect(store.state.seats.A.main.length).toBe(2);
  });

  it("heroGainPv / heroLosePv : ajuste les PV du Héros actif", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    const heroId = store.state.seats.A.heroInstanceId!;
    const base = store.state.instances[heroId].counters.hp ?? 0;
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "heroGainPv", n: 3 }],
    });
    expect(store.state.instances[heroId].counters.hp).toBe(base + 3);
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "heroLosePv", n: 1 }],
    });
    expect(store.state.instances[heroId].counters.hp).toBe(base + 2);
  });

  it("damageOppHero : retire des PV au Héros adverse", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    const oppHero = store.state.seats[otherSeat("A")].heroInstanceId!;
    const base = store.state.instances[oppHero].counters.hp ?? 0;
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "damageOppHero", n: 2 }],
    });
    expect(store.state.instances[oppHero].counters.hp).toBe(base - 2);
  });

  it("havreSacGainResistance : ajoute de la Résistance au Havre-Sac", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    const sacId = store.state.seats.A.havreSacInstanceId!;
    const base = store.state.instances[sacId].counters.resistance ?? 0;
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "havreSacGainResistance", n: 2 }],
    });
    expect(store.state.instances[sacId].counters.resistance).toBe(base + 2);
  });

  it("loseStatTurn : pose un modificateur négatif de PA/PM sur le Héros", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    const heroId = store.state.seats.A.heroInstanceId!;
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "loseStatTurn", stat: "pa", n: 2 }],
    });
    expect(store.state.instances[heroId].counters.tokens?.paMod).toBe(-2);
  });

  it("shuffleDeck : mélange la Pioche sans en changer la taille", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    const before = store.state.seats.A.pioche.length;
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "shuffleDeck" }],
    });
    expect(store.state.seats.A.pioche.length).toBe(before);
  });

  it("gainXp : accorde de l'XP au Héros (effet résolu, file vidée)", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "gainXp", n: 1 }],
    });
    // l'effet se résout (pas de pause interactive) et émet une ligne de journal.
    expect(store.effectPicking).toBeNull();
    expect(store.effectTargeting).toBeNull();
    expect(logText(store)).toContain("Héros de Joueur 1");
  });
});

describe("pipeline d'effets — ops self gardées (source en jeu)", () => {
  it("buffForceSelf : +Force temporaire si la source est en jeu, sinon no-op", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    const id = placeInZone(store, "A", { zone: "monde" });
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      sourceId: id,
      ops: [{ op: "buffForceSelf", n: 2 }],
    });
    expect(store.state.instances[id].counters.tokens?.forceMod).toBe(2);
    // sans sourceId en jeu → aucun changement d'état
    const before = JSON.stringify(store.state.instances);
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "buffForceSelf", n: 9 }],
    });
    expect(JSON.stringify(store.state.instances)).toBe(before);
  });

  it("tapSelf : incline la source redressée en jeu", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    const id = placeInZone(store, "A", { zone: "monde" });
    expect(store.state.instances[id].orientation).toBe("upright");
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      sourceId: id,
      ops: [{ op: "tapSelf" }],
    });
    expect(store.state.instances[id].orientation).toBe("tapped");
  });

  it("destroySelf : envoie la source en Défausse", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    const id = placeInZone(store, "A", { zone: "monde" });
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      sourceId: id,
      ops: [{ op: "destroySelf" }],
    });
    expect(store.state.seats.A.defausse).toContain(id);
    // `monde` est une zone PARTAGÉE au niveau racine (pas par siège).
    expect(store.state.monde).not.toContain(id);
  });

  it("combatModSelf : pose les jetons de combat sur la source", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    const id = placeInZone(store, "A", { zone: "monde" });
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      sourceId: id,
      ops: [{ op: "combatModSelf", force: 2, pm: 1, geant: true }],
    });
    const t = counters(store, id).tokens;
    expect(t.forceCombatMod).toBe(2);
    expect(t.pmCombatMod).toBe(1);
    expect(t.geantCombatMod).toBe(1);
  });
});

describe("pipeline d'effets — jetons posés sur le Héros", () => {
  it("buffForceAlliesMondeTurn : pose teamForceMod sur le Héros (valeur fixe)", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    const heroId = store.state.seats.A.heroInstanceId!;
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "buffForceAlliesMondeTurn", n: 2 }],
    });
    expect(store.state.instances[heroId].counters.tokens?.teamForceMod).toBe(2);
  });

  it("globalDamageShield : pose treveUntilTurn = turn.number + 2 sur le Héros", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    const heroId = store.state.seats.A.heroInstanceId!;
    const expected = store.state.turn.number + 2;
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "globalDamageShield" }],
    });
    expect(store.state.instances[heroId].counters.tokens?.treveUntilTurn).toBe(
      expected,
    );
  });
});

describe("pipeline d'effets — piles (effectPicking)", () => {
  it("discardFromHand : ouvre un picker dans la main, le clic défausse", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    store.draw("A", 3);
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "discardFromHand", n: 1 }],
    });
    expect(store.effectPicking).not.toBeNull();
    expect(store.effectPicking?.zone).toBe("main");
    const pick = store.effectPickIds[0];
    store.effectPick(pick);
    expect(store.state.seats.A.defausse).toContain(pick);
    expect(store.effectPicking).toBeNull();
  });

  it("effectPickSkip : un choix non obligatoire se passe et vide le picker", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    store.draw("A", 2);
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "discardFromHand", n: 1 }],
    });
    expect(store.effectPicking).not.toBeNull();
    store.effectPickSkip();
    expect(store.effectPicking).toBeNull();
    expect(store.state.seats.A.defausse.length).toBe(0);
  });

  it("recycleFromDiscard n>1 : le picker reste ouvert jusqu'à épuiser remaining", () => {
    const { store } = makeEffectSandbox({ first: "A" });
    store.draw("A", 3);
    for (const id of [...store.state.seats.A.main])
      store.moveTo(id, { zone: "defausse", owner: "A" });
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "recycleFromDiscard", n: 2 }],
    });
    expect(store.effectPicking?.remaining).toBe(2);
    store.effectPick(store.effectPickIds[0]);
    expect(store.effectPicking?.remaining).toBe(1);
    store.effectPick(store.effectPickIds[0]);
    expect(store.effectPicking).toBeNull();
  });

  it("searchDeck dest main : trouve une carte du type demandé et la prend en main", () => {
    const { store, deck, cardStore } = makeEffectSandbox({ first: "A" });
    for (const dc of deck.cards) dc.card.mainType = "Allié";
    cardStore.cards = [
      deck.hero!,
      deck.havreSac!,
      ...deck.cards.map((dc) => dc.card),
    ];
    const handBefore = store.state.seats.A.main.length;
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "searchDeck", what: "Allié", dest: "main" }],
    });
    expect(store.effectPicking?.zone).toBe("pioche");
    store.effectPick(store.effectPickIds[0]);
    expect(store.state.seats.A.main.length).toBe(handBefore + 1);
    expect(store.effectPicking).toBeNull();
  });

  it("searchDeck dest monde : la carte entre en jeu (zone Monde partagée)", () => {
    const { store, deck, cardStore } = makeEffectSandbox({ first: "A" });
    for (const dc of deck.cards) dc.card.mainType = "Allié";
    cardStore.cards = [
      deck.hero!,
      deck.havreSac!,
      ...deck.cards.map((dc) => dc.card),
    ];
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "searchDeck", what: "Allié", dest: "monde" }],
    });
    const picked = store.effectPickIds[0];
    store.effectPick(picked);
    expect(store.state.monde).toContain(picked);
    expect(store.effectPicking).toBeNull();
  });

  it("searchDeck sans match : effet passé, pas de picker", () => {
    const { store, deck, cardStore } = makeEffectSandbox({ first: "A" });
    for (const dc of deck.cards) dc.card.mainType = "Allié";
    cardStore.cards = [
      deck.hero!,
      deck.havreSac!,
      ...deck.cards.map((dc) => dc.card),
    ];
    store.enqueueEffect({
      seat: "A",
      cardName: "T",
      ops: [{ op: "searchDeck", what: "Dofus", dest: "main" }],
    });
    expect(store.effectPicking).toBeNull();
  });
});
