/**
 * Vague W60 (deck-driven, starter Incarnam Merelyne Manro) — COÛT VARIABLE X.
 *
 * Merelyne Manro : « [Incliner], X[Neutre] : Détruisez l'Équipement de Niveau X
 * de votre choix. » (coûts récupérés du raw ; scriptée dans CARD_SCRIPTS).
 *
 * Deux primitives :
 *  1) `costPayX` — le joueur incline X producteurs (0..disponibles) ; X =
 *     nombre incliné → posé sur la frame (boundCount). Skippable ; X=0 légal.
 *  2) `destroyTarget{exactLevelFromCount}` — Niveau EXACT = X (boundCount), figé
 *     à l'ouverture du ciblage : seuls les Équipements de Niveau X sont éligibles.
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import {
  createMockEquipmentCard,
} from "tests/factories/card";

import {
  makeEffectSandbox,
  placeInZone,
} from "@/stores/__tests__/effectPipeline.harness";

type Store = ReturnType<typeof makeEffectSandbox>["store"];

const EQUIP2: Card = createMockEquipmentCard({
  id: "equip-lvl2",
  name: "Arme Niv2",
  stats: { niveau: { value: 2, element: "Feu" } },
});
const EQUIP3: Card = createMockEquipmentCard({
  id: "equip-lvl3",
  name: "Arme Niv3",
  stats: { niveau: { value: 3, element: "Feu" } },
});

/** Injecte une instance EN JEU (Monde) directement dans l'état du sandbox. */
function injectInMonde(
  store: Store,
  seat: "A" | "B",
  cardId: string,
  id: string,
) {
  store.state.instances[id] = {
    instanceId: id,
    cardId,
    owner: seat,
    controller: seat,
    orientation: "upright",
    location: { zone: "monde" },
    counters: {},
  } as never;
  (store.state as unknown as { monde: string[] }).monde.push(id);
}

const MERELYNE_OPS = [
  { op: "costPayX" as const },
  {
    op: "destroyTarget" as const,
    what: "Équipement" as const,
    exactLevelFromCount: true,
    zones: ["monde"] as ("monde" | "havreSac")[],
  },
];

function setup() {
  const { store } = makeEffectSandbox({
    first: "A",
    allAllies: true,
    extraCards: [EQUIP2, EQUIP3],
  });
  // deux producteurs (Alliés dressés dans le Monde de A)
  const p1 = placeInZone(store, "A", { zone: "monde" });
  const p2 = placeInZone(store, "A", { zone: "monde" });
  // la source du pouvoir (une créature de A, déjà en jeu)
  const src = placeInZone(store, "A", { zone: "monde" });
  // deux Équipements adverses en jeu (Niveau 2 et 3)
  injectInMonde(store, "B", "equip-lvl2", "eq2");
  injectInMonde(store, "B", "equip-lvl3", "eq3");
  return { store, p1, p2, src };
}

describe("costPayX + destroyTarget exactLevelFromCount (Merelyne Manro)", () => {
  it("payer X=2 → destroyTarget se lie à Niveau 2 : seul l'Équipement Niv2 est détruit", () => {
    const { store, p1, p2, src } = setup();
    store.enqueueEffect({
      seat: "A",
      cardName: "Merelyne Manro",
      sourceId: src,
      ops: MERELYNE_OPS,
    });
    // 1) coût variable X : on incline deux producteurs puis on s'arrête (X=2 ;
    //    d'autres producteurs restent — source/Héros/Havre-Sac — donc on borne
    //    le paiement via « Passer »).
    expect(store.effectTargeting?.op.op).toBe("costPayX");
    store.effectTargetChoose(p1);
    store.effectTargetChoose(p2);
    store.effectTargetSkip(); // s'arrête à X=2
    // X=2 lié → le ciblage bascule sur destroyTarget
    expect(store.effectTargeting?.op.op).toBe("destroyTarget");
    // Niveau exact figé à X=2
    expect(
      (store.effectTargeting?.op as { exactLevel?: number }).exactLevel,
    ).toBe(2);
    // 2) détruire l'Équipement Niveau 2 (le Niv3 n'est pas éligible)
    store.effectTargetChoose("eq2");
    expect(store.state.instances["eq2"]?.location.zone).toBe("defausse");
    expect(store.state.instances["eq3"]?.location.zone).toBe("monde"); // intact
  });

  it("payer X=1 (s'arrêter après un producteur) → Niveau 1 : aucun Équipement Niv2/3 éligible → no-op", () => {
    const { store, p1, src } = setup();
    store.enqueueEffect({
      seat: "A",
      cardName: "Merelyne Manro",
      sourceId: src,
      ops: MERELYNE_OPS,
    });
    store.effectTargetChoose(p1);
    store.effectTargetSkip(); // s'arrête à X=1
    // destroyTarget Niveau 1 : ni eq2 ni eq3 éligibles → effet passé, rien détruit
    expect(store.state.instances["eq2"]?.location.zone).toBe("monde");
    expect(store.state.instances["eq3"]?.location.zone).toBe("monde");
  });
});
