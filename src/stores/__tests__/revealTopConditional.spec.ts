/**
 * Intégration store (W81) — revealTopConditional (non-interactif) :
 *  - discardDraw (Alysse) : défausse le dessus ; si Élément matche → pioche 1.
 *  - takeElse (Hilary/Berlanette) : révèle dessus/dessous ; si type matche →
 *    main ; sinon recycle (sous la Pioche) ou Défausse.
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import {
  createMockAllyCard,
  createMockEquipmentCard,
} from "tests/factories/card";
import { makeEffectSandbox } from "./effectPipeline.harness";

const AIR_CARD: Card = createMockAllyCard({
  id: "air-card-test",
  name: "Carte Air",
  stats: { niveau: { value: 2, element: "Air" } },
});
const FEU_CARD: Card = createMockAllyCard({
  id: "feu-card-test",
  name: "Carte Feu",
  stats: { niveau: { value: 2, element: "Feu" } },
});
const EQUIP: Card = createMockEquipmentCard({
  id: "equip-test-w81",
  name: "Épée de Test",
});

function setup() {
  return makeEffectSandbox({
    first: "A",
    allAllies: true,
    extraCards: [AIR_CARD, FEU_CARD, EQUIP],
  });
}

describe("revealTopConditional — défausse/révèle conditionnel", () => {
  it("discardDraw : dessus [Air] matche → défaussé + pioche 1", () => {
    const { store } = setup();
    const top = store.state.seats.A.pioche[0];
    store.state.instances[top].cardId = "air-card-test";
    const handBefore = store.state.seats.A.main.length;

    store.enqueueEffect({
      seat: "A",
      cardName: "Alysse",
      ops: [
        { op: "revealTopConditional", mode: "discardDraw", element: "Air" },
      ],
    });

    expect(store.state.instances[top].location.zone).toBe("defausse");
    // +1 pioche (la carte défaussée ne revient pas en main).
    expect(store.state.seats.A.main.length).toBe(handBefore + 1);
  });

  it("discardDraw : dessus [Feu] ne matche pas [Air] → défaussé, AUCUNE pioche", () => {
    const { store } = setup();
    const top = store.state.seats.A.pioche[0];
    store.state.instances[top].cardId = "feu-card-test";
    const handBefore = store.state.seats.A.main.length;

    store.enqueueEffect({
      seat: "A",
      cardName: "Alysse",
      ops: [
        { op: "revealTopConditional", mode: "discardDraw", element: "Air" },
      ],
    });

    expect(store.state.instances[top].location.zone).toBe("defausse");
    expect(store.state.seats.A.main.length).toBe(handBefore);
  });

  it("takeElse : dessus Équipement → en main ; sinon recyclé sous la Pioche", () => {
    const { store } = setup();
    const top = store.state.seats.A.pioche[0];
    store.state.instances[top].cardId = "equip-test-w81";

    store.enqueueEffect({
      seat: "A",
      cardName: "Hilary Goll",
      ops: [
        {
          op: "revealTopConditional",
          mode: "takeElse",
          whatIn: ["Équipement"],
          otherwise: "recycle",
        },
      ],
    });
    expect(store.state.instances[top].location.zone).toBe("main");

    // Cas SINON : le nouveau dessus (un Allié mock) est recyclé sous la Pioche.
    const top2 = store.state.seats.A.pioche[0];
    store.enqueueEffect({
      seat: "A",
      cardName: "Hilary Goll",
      ops: [
        {
          op: "revealTopConditional",
          mode: "takeElse",
          whatIn: ["Équipement"],
          otherwise: "recycle",
        },
      ],
    });
    const pioche = store.state.seats.A.pioche;
    expect(pioche[pioche.length - 1]).toBe(top2);
  });

  it("takeElse depuis le DESSOUS (Berlanette) : Allié du dessous → en main", () => {
    const { store } = setup();
    const pioche = store.state.seats.A.pioche;
    const bottom = pioche[pioche.length - 1];

    store.enqueueEffect({
      seat: "A",
      cardName: "Berlanette Chichi",
      ops: [
        {
          op: "revealTopConditional",
          from: "bottom",
          mode: "takeElse",
          whatIn: ["Allié", "Équipement"],
          otherwise: "discard",
        },
      ],
    });
    // Le deck mock allAllies : la carte du dessous est un Allié → en main.
    expect(store.state.instances[bottom].location.zone).toBe("main");
  });
});
