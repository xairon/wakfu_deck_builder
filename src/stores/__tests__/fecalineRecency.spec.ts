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
