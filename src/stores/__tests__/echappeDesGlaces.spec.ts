/**
 * Intégration store (W78) — Échappé des Glaces (bonta-brakmar, Action) :
 * « Gagnez un nombre d'XP égal à la valeur d'XP de l'Allié qui vient
 * d'apparaître depuis votre Défausse. » + « Ne jouez Échappé des Glaces que
 * lorsqu'un de vos Alliés vient d'apparaître depuis votre Défausse. »
 *
 * PROVENANCE d'apparition : le marqueur `justAppearedFromDefausse` accompagne
 * `justAppeared` (W74) quand l'entrée en jeu provient de la Défausse.
 * playCondition `allyJustAppearedFromDiscard` (gate whyCannotPlay) + op
 * `gainXpOfAppeared` (non-interactif : XP = valeur d'XP du référent).
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import { createMockAllyCard, createMockActionCard } from "tests/factories/card";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

const REVENANT: Card = createMockAllyCard({
  id: "revenant-test",
  name: "Revenant",
  subTypes: ["Monstre"],
  experience: 3,
});

const ECHAPPE: Card = {
  ...createMockActionCard({
    id: "echappe-test",
    name: "Échappé des Glaces",
  }),
  effects: [
    {
      description:
        "Gagnez un nombre d'XP égal à la valeur d'XP de l'Allié qui vient d'apparaître depuis votre Défausse.",
      compiled: {
        trigger: "onPlay",
        ops: [{ op: "gainXpOfAppeared", fromDiscard: true }],
      },
    },
    {
      description:
        "Ne jouez Échappé des Glaces que lorsqu'un de vos Alliés vient d'apparaître depuis votre Défausse.",
      compiled: {
        trigger: "onPlay",
        playCondition: { cond: "allyJustAppearedFromDiscard" },
        ops: [],
      },
    },
  ],
};

/** Fait apparaître un Allié DEPUIS LA DÉFAUSSE de `seat` (main → défausse → monde). */
function appearFromDiscard(
  store: ReturnType<typeof makeEffectSandbox>["store"],
  seat: "A" | "B",
) {
  const id = placeInZone(store, seat, { zone: "defausse", owner: seat });
  store.moveTo(id, { zone: "monde" });
  return id;
}

describe("Échappé des Glaces — provenance Défausse + gain d'XP du référent", () => {
  it("marqueur de provenance : depuis la Défausse → les DEUX jetons ; depuis la main → justAppeared seul", () => {
    const { store } = makeEffectSandbox({ allAllies: true, first: "A" });
    const fromDiscard = appearFromDiscard(store, "A");
    expect(
      store.state.instances[fromDiscard].counters.tokens?.justAppeared,
    ).toBe(1);
    expect(
      store.state.instances[fromDiscard].counters.tokens
        ?.justAppearedFromDefausse,
    ).toBe(1);

    // Une apparition « normale » (main → monde) déplace le marqueur et NE
    // pose PAS la provenance.
    const fromHand = placeInZone(store, "A", { zone: "monde" });
    expect(store.state.instances[fromHand].counters.tokens?.justAppeared).toBe(
      1,
    );
    expect(
      store.state.instances[fromHand].counters.tokens
        ?.justAppearedFromDefausse ?? 0,
    ).toBe(0);
    expect(
      store.state.instances[fromDiscard].counters.tokens
        ?.justAppearedFromDefausse ?? 0,
    ).toBe(0);
  });

  it("gate + résolution : injouable sans apparition-Défausse ; jouable après, XP = valeur d'XP du référent", () => {
    const { store } = makeEffectSandbox({
      allAllies: true,
      first: "A",
      extraCards: [ECHAPPE, REVENANT],
    });
    // Passer les premiers tours (restriction 4943 du 1er tour ≠ notre gate).
    store.endTurn();
    store.endTurn();
    const cardId = placeInZone(store, "A", { zone: "main", owner: "A" });
    store.state.instances[cardId].cardId = "echappe-test";
    const heroA = store.state.seats.A.heroInstanceId!;

    // AUCUN Allié apparu depuis la Défausse → la carte est refusée.
    expect(store.playFromHand(cardId)).toBe(false);
    expect(store.state.instances[cardId].location.zone).toBe("main");

    // Un Allié (XP 3) apparaît depuis la Défausse → jouable, +3 XP.
    const rid = appearFromDiscard(store, "A");
    store.state.instances[rid].cardId = "revenant-test";
    // Purger la « Limite de main » (picker OBLIGATOIRE ouvert par l'excès de
    // pioches du harnais — il bloquerait la pompe d'effets, pas notre gate).
    while (store.effectPicking) {
      const discardable = store.state.seats.A.main.find((i) => i !== cardId);
      store.effectPick(discardable!);
    }
    const xpBefore = store.state.instances[heroA].counters.xp ?? 0;
    expect(store.playFromHand(cardId)).toBe(true);
    expect(store.state.instances[heroA].counters.xp ?? 0).toBe(xpBefore + 3);
  });
});
