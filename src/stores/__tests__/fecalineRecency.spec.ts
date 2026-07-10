/**
 * Vague W68 (deck-driven, starter Incarnam Fécaline la Sage) — RÉCENCE DE JEU.
 *
 * Fécaline : « [Incliner] : Gagnez 1 XP. Ne jouez ce pouvoir que lorsque vous
 * venez de jouer une carte Quête ou Parchemin. » Le pouvoir-tap est GATÉ par une
 * restriction de RÉCENCE (playCondition recentlyPlayedQuestParch), jugée à
 * l'activation ; le jeton `recentQuestParch` est posé sur le Héros à CHAQUE
 * playFromHand (1 si Quête/Parchemin, 0 sinon → stricte récence).
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import { createMockActionCard, createMockAllyCard } from "tests/factories/card";
import { useCardStore } from "../cardStore";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

const FECALINE: Card = createMockAllyCard({
  id: "fecaline-test",
  name: "Fécaline la Sage",
  subTypes: ["Féca"],
  effects: [
    {
      description:
        "[Incliner] : Gagnez 1 XP. Ne jouez ce pouvoir que lorsque vous venez de jouer une carte Quête ou Parchemin.",
      requiresIncline: true,
      compiled: {
        trigger: "onTap",
        playCondition: { cond: "recentlyPlayedQuestParch" },
        ops: [{ op: "gainXp", n: 1 }],
      },
    },
  ],
});

const PARCHEMIN: Card = createMockActionCard({
  id: "parch-test",
  name: "Un Parchemin",
  subTypes: ["Parchemin"],
});
const AUTRE: Card = createMockActionCard({
  id: "autre-test",
  name: "Une Action",
  subTypes: [],
});

function setup() {
  const { store } = makeEffectSandbox({
    first: "A",
    allAllies: true,
    extraCards: [FECALINE, PARCHEMIN, AUTRE],
  });
  // tour > 1 : la restriction « aucune carte dans le Monde au 1er tour » ne
  // s'applique plus (on veut jouer des cartes pour poser le jeton de récence).
  store.state.turn.number = 3;
  const fecalineId = placeInZone(store, "A", { zone: "monde" });
  store.state.instances[fecalineId].cardId = "fecaline-test";
  const heroId = store.state.seats.A.heroInstanceId!;
  const xp = () => store.state.instances[heroId].counters.xp ?? 0;
  // deux cartes en main : un Parchemin + une Action neutre.
  const parchId = placeInZone(store, "A", { zone: "main", owner: "A" });
  store.state.instances[parchId].cardId = "parch-test";
  const autreId = placeInZone(store, "A", { zone: "main", owner: "A" });
  store.state.instances[autreId].cardId = "autre-test";
  return { store, fecalineId, parchId, autreId, xp };
}

describe("Fécaline — récence Quête/Parchemin", () => {
  it("sans avoir joué de Quête/Parchemin : pouvoir refusé", () => {
    const { store, fecalineId, xp } = setup();
    expect(store.activateTapPower(fecalineId)).toBe(false);
    expect(store.ruleError).toContain("Quête ou Parchemin");
    expect(xp()).toBe(0);
  });

  it("après avoir joué un Parchemin : pouvoir autorisé → +1 XP, Fécaline inclinée", () => {
    const { store, fecalineId, parchId, xp } = setup();
    store.playFromHand(parchId);
    expect(store.activateTapPower(fecalineId)).toBe(true);
    expect(xp()).toBe(1);
    expect(store.state.instances[fecalineId].orientation).toBe("tapped");
  });

  it("STRICTE RÉCENCE : jouer autre chose APRÈS le Parchemin annule l'accès", () => {
    const { store, fecalineId, parchId, autreId, xp } = setup();
    store.playFromHand(parchId); // récence = Parchemin
    store.playFromHand(autreId); // écrase → récence = autre (0)
    expect(store.activateTapPower(fecalineId)).toBe(false);
    expect(xp()).toBe(0);
  });
});

describe("gate de CLASSE du Héros (heroClass — Gzenah)", () => {
  it("pouvoir refusé si le Héros n'est pas de la Classe ; autorisé sinon", () => {
    const { store } = setup();
    const GZENAH: Card = {
      id: "gzenah-test",
      name: "Gzenah la Guerrière",
      mainType: "Allié",
      subTypes: [],
      effects: [
        {
          description:
            "Iop. [Incliner] : L'Allié ou Héros de votre choix gagne +1 en Force et Géant jusqu'à la fin du tour.",
          requiresIncline: true,
          compiled: {
            trigger: "onTap",
            playCondition: { cond: "heroClass", class: "Iop" },
            ops: [
              {
                op: "buffForceTarget",
                n: 1,
                heroes: true,
                alsoKeyword: "Géant",
                zones: ["monde", "havreSac"],
              },
            ],
          },
        },
      ],
    } as unknown as Card;
    const cardStore = useCardStore();
    cardStore.cards = [...cardStore.cards, GZENAH];
    const gz = placeInZone(store, "A", { zone: "monde" });
    store.state.instances[gz].cardId = "gzenah-test";
    // Le Héros factice est IOP (factory) : un gate SRAM refuse, expliqué.
    GZENAH.effects![0].compiled!.playCondition = {
      cond: "heroClass",
      class: "Sram",
    };
    expect(store.activateTapPower(gz)).toBe(false);
    expect(store.ruleError).toContain("Sram");
    store.clearRuleError();
    expect(store.state.instances[gz].orientation).toBe("upright"); // rien consommé
    // Gate IOP (la Classe du Héros) → pouvoir activable, ciblage ouvert.
    GZENAH.effects![0].compiled!.playCondition = {
      cond: "heroClass",
      class: "Iop",
    };
    expect(store.activateTapPower(gz)).toBe(true);
    expect(store.effectTargeting).not.toBeNull();
  });
});

describe("récence PAR CATÉGORIE (recentPlay<Kind>) — écrivain + gate", () => {
  it("jouer une Action pose recentPlayAction=1 (et parchemin selon le subType), écrasés au jeu suivant", () => {
    const { store, parchId, autreId } = setup();
    const heroA = store.state.seats.A.heroInstanceId!;
    const tok = (name: string) =>
      store.state.instances[heroA].counters.tokens?.[name] ?? 0;
    store.playFromHand(parchId); // Action au subType Parchemin
    expect(tok("recentPlayAction")).toBe(1);
    expect(tok("recentPlayParchemin")).toBe(1);
    expect(tok("recentPlayEquipement")).toBe(0);
    store.playFromHand(autreId); // Action sans subType → parchemin écrasé
    expect(tok("recentPlayAction")).toBe(1);
    expect(tok("recentPlayParchemin")).toBe(0);
  });

  it("gate who:'other' : le pouvoir lit le Héros ADVERSE (refus si lui n'a rien joué)", () => {
    const { store } = setup();
    const BEBE: Card = {
      id: "bebe-test",
      name: "Bébé Crocodaille",
      mainType: "Allié",
      subTypes: [],
      effects: [
        {
          description:
            "Piochez une carte. N'utilisez ce pouvoir que lorsqu'un adversaire vient de jouer une Action.",
          compiled: {
            trigger: "onTap",
            playCondition: {
              cond: "recentlyPlayedKind",
              kinds: ["action"],
              who: "other",
            },
            ops: [{ op: "draw", n: 1 }],
          },
        },
      ],
    } as unknown as Card;
    const cardStore = useCardStore();
    cardStore.cards = [...cardStore.cards, BEBE];
    const bebeId = placeInZone(store, "A", { zone: "monde" });
    store.state.instances[bebeId].cardId = "bebe-test";
    // L'adversaire (B) n'a rien joué → refus avec motif.
    expect(store.activateTapPower(bebeId)).toBe(false);
    expect(store.ruleError).toContain("adversaire");
    store.clearRuleError();
    // On simule « B vient de jouer une Action » (jeton sur SON Héros).
    const heroB = store.state.seats.B.heroInstanceId!;
    store.state.instances[heroB].counters.tokens = {
      ...(store.state.instances[heroB].counters.tokens ?? {}),
      recentPlayAction: 1,
    };
    const handBefore = store.state.seats.A.main.length;
    expect(store.activateTapPower(bebeId)).toBe(true);
    expect(store.state.seats.A.main.length).toBe(handBefore + 1);
  });
});
