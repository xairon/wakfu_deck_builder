/**
 * Vague W64 (deck-driven, starter Incarnam Guy Yomtella) — SÉLECTION MULTI-
 * POUVOIRS + coût multi-Ressource.
 *
 * Guy Yomtella porte DEUX pouvoirs onTap :
 *  - pwr0 « [Incliner], [Air] : … inflige 1 Dommage [Air] … » (tapsSource) ;
 *  - pwr1 « [Air][Air] : Redressez Guy Yomtella. » (2 Air, N'INCLINE PAS).
 * activateTapPower choisit le premier pouvoir compatible avec l'orientation :
 * Guy incliné → pwr1 (redresse-soi) ; Guy dressé → pwr0 (qui incline). La garde
 * de payabilité compte les costTapResource EN TÊTE (2 Air distincts requis).
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import { createMockAllyCard } from "tests/factories/card";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

const GUY: Card = createMockAllyCard({
  id: "guy-yomtella-test",
  name: "Guy Yomtella",
  stats: {
    niveau: { value: 2, element: "Air" },
    force: { value: 1, element: "Air" },
  },
  effects: [
    {
      description: "[Incliner], [Air] : Guy Yomtella inflige 1 Dommage [Air].",
      compiled: {
        trigger: "onTap",
        cost: "paidOps",
        tapsSource: true,
        ops: [
          { op: "costTapResource", element: "Air" },
          {
            op: "damageTarget",
            n: 1,
            element: "Air",
            heroes: false,
            zones: ["monde", "havreSac"],
          },
        ],
      },
    },
    {
      description: "[Air][Air] : Redressez Guy Yomtella.",
      compiled: {
        trigger: "onTap",
        cost: "paidOps",
        ops: [
          { op: "costTapResource", element: "Air" },
          { op: "costTapResource", element: "Air" },
          { op: "untapSelf" },
        ],
      },
    },
  ],
});

/** Allié producteur d'Air (Élément de Force = Air → resourceElement Air). */
function airProducer(id: string): Card {
  return createMockAllyCard({
    id,
    name: id,
    stats: {
      niveau: { value: 1, element: "Air" },
      force: { value: 1, element: "Air" },
    },
  });
}

function setup(nProducers: number) {
  const P = Array.from({ length: nProducers }, (_, i) =>
    airProducer(`air-${i}`),
  );
  const { store } = makeEffectSandbox({
    first: "A",
    allAllies: true,
    extraCards: [GUY, ...P],
  });
  // Guy en jeu, INCLINÉ (il vient d'utiliser pwr0).
  const guyId = placeInZone(store, "A", { zone: "monde" });
  store.state.instances[guyId].cardId = "guy-yomtella-test";
  store.state.instances[guyId].orientation = "tapped";
  // producteurs Air dressés.
  const prodIds = P.map((p) => {
    const id = placeInZone(store, "A", { zone: "monde" });
    store.state.instances[id].cardId = p.id;
    return id;
  });
  return { store, guyId, prodIds };
}

describe("Guy Yomtella — multi-pouvoirs + coût 2 Air", () => {
  it("Guy incliné + 2 Air : pwr1 sélectionné → paie 2 Air → Guy redressé", () => {
    const { store, guyId, prodIds } = setup(2);
    expect(store.activateTapPower(guyId)).toBe(true);
    // pwr1 ouvre le paiement de la 1re Ressource
    expect(store.effectTargeting?.op.op).toBe("costTapResource");
    store.effectTargetChoose(prodIds[0]);
    store.effectTargetChoose(prodIds[1]);
    // untapSelf : Guy est redressé, les 2 producteurs inclinés
    expect(store.state.instances[guyId].orientation).toBe("upright");
    expect(store.state.instances[prodIds[0]].orientation).toBe("tapped");
    expect(store.state.instances[prodIds[1]].orientation).toBe("tapped");
  });

  it("Guy incliné + 1 seul Air : coût 2 Air impayable → activation refusée (Guy reste incliné)", () => {
    const { store, guyId } = setup(1);
    expect(store.activateTapPower(guyId)).toBe(false);
    expect(store.state.instances[guyId].orientation).toBe("tapped");
    expect(store.effectTargeting).toBeNull();
  });
});
