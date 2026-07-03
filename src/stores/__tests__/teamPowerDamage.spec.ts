/**
 * Intégration store (W54) — Guma Bobeule : « Les Dommages infligés par les
 * pouvoirs de vos Alliés sont augmentés de 1 jusqu'à la fin du tour. »
 * Bout-en-bout : activer Guma pose le jeton `teamPowerDmgMod` sur le Héros ;
 * un POUVOIR D'ALLIÉ qui inflige des Dommages est augmenté (+1 par Guma,
 * cumulatif) ; une ACTION ne l'est pas (pas un pouvoir) ; le jeton est purgé
 * en fin de tour.
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import { createMockAllyCard } from "tests/factories/card";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

const GUMA: Card = createMockAllyCard({
  id: "guma-test",
  name: "Guma Bobeule",
  stats: {
    niveau: { value: 2, element: "Terre" },
    force: { value: 2, element: "Terre" },
  },
  effects: [
    {
      description:
        "Les Dommages infligés par les pouvoirs de vos Alliés sont augmentés de 1 jusqu'à la fin du tour.",
      requiresIncline: true,
      compiled: {
        trigger: "onTap",
        ops: [{ op: "buffTeamPowerDamageTurn", n: 1 }],
      },
    },
  ],
});

/** Allié à pouvoir-tap dommageant (1 Dommage à l'Allié de votre choix). */
const SNIPER: Card = createMockAllyCard({
  id: "sniper-test",
  name: "Sniper",
  stats: {
    niveau: { value: 1, element: "Feu" },
    force: { value: 1, element: "Feu" },
  },
  effects: [
    {
      description: "Le Sniper inflige 1 Dommage à l'Allié de votre choix.",
      requiresIncline: true,
      compiled: {
        trigger: "onTap",
        ops: [
          {
            op: "damageTarget",
            n: 1,
            element: "Feu",
            heroes: false,
            zones: ["monde", "havreSac"],
          },
        ],
      },
    },
  ],
});

function setup() {
  const { store } = makeEffectSandbox({
    first: "A",
    allAllies: true,
    extraCards: [GUMA, SNIPER],
  });
  const gumaId = placeInZone(store, "A", { zone: "monde" });
  store.state.instances[gumaId].cardId = "guma-test";
  const sniperId = placeInZone(store, "A", { zone: "monde" });
  store.state.instances[sniperId].cardId = "sniper-test";
  // cible adverse : Allié factice du deck mock (sans Force connue → jamais
  // détruit d'office, cf. harness — les Dommages s'accumulent en compteur).
  const targetId = placeInZone(store, "B", { zone: "monde" });
  return { store, gumaId, sniperId, targetId };
}

describe("Guma Bobeule — bonus des pouvoirs d'Alliés", () => {
  it("activer Guma pose le jeton sur le Héros ; le pouvoir du Sniper inflige 1+1", () => {
    const { store, gumaId, sniperId, targetId } = setup();
    const heroA = store.state.seats.A.heroInstanceId!;

    expect(store.activateTapPower(gumaId)).toBe(true);
    expect(store.state.instances[heroA].counters.tokens?.teamPowerDmgMod).toBe(
      1,
    );

    expect(store.activateTapPower(sniperId)).toBe(true);
    store.effectTargetChoose(targetId);
    expect(store.state.instances[targetId].counters.damage ?? 0).toBe(2); // 1+1
  });

  it("CUMULATIF : deux activations (jeton 2) → 1 Dommage devient 3", () => {
    const { store, gumaId, sniperId, targetId } = setup();
    const heroA = store.state.seats.A.heroInstanceId!;
    store.activateTapPower(gumaId);
    // seconde Guma simulée : re-pose du jeton via une seconde frame
    store.enqueueEffect({
      seat: "A",
      cardName: "Guma Bobeule",
      ops: [{ op: "buffTeamPowerDamageTurn", n: 1 }],
    });
    expect(store.state.instances[heroA].counters.tokens?.teamPowerDmgMod).toBe(
      2,
    );
    store.activateTapPower(sniperId);
    store.effectTargetChoose(targetId);
    expect(store.state.instances[targetId].counters.damage ?? 0).toBe(3); // 1+2
  });

  it("une ACTION n'est PAS boostée (pas un pouvoir — pas de powerSourceId)", () => {
    const { store, gumaId, targetId } = setup();
    store.activateTapPower(gumaId);
    // Action : frame SANS powerSourceId (chemin actionAtoms)
    store.enqueueEffect({
      seat: "A",
      cardName: "Action Test",
      ops: [
        {
          op: "damageTarget",
          n: 1,
          element: "Feu",
          heroes: false,
          zones: ["monde", "havreSac"],
        },
      ],
    });
    store.effectTargetChoose(targetId);
    expect(store.state.instances[targetId].counters.damage ?? 0).toBe(1); // non boosté
  });

  it("PURGE : le jeton disparaît en fin de tour", () => {
    const { store, gumaId } = setup();
    const heroA = store.state.seats.A.heroInstanceId!;
    store.activateTapPower(gumaId);
    expect(store.state.instances[heroA].counters.tokens?.teamPowerDmgMod).toBe(
      1,
    );
    store.endTurn();
    expect(
      store.state.instances[heroA].counters.tokens?.teamPowerDmgMod ?? 0,
    ).toBe(0);
  });
});
