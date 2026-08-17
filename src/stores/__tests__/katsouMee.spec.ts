/**
 * Vague W69 (deck-driven, starter Incarnam Katsou Mee) — COMPTEUR DE DÉPENSE +
 * AUTO-DESTRUCTION DE FIN DE TOUR.
 *
 * Katsou Mee : « [Terre] : Katsou Mee gagne +1 en Force. Si vous dépensez plus de
 * [Terre][Terre][Terre] de cette façon, détruisez Katsou Mee à la fin du tour. »
 * Pouvoir répétable : payer 1 Terre → +1 Force + compteur `katsouSpend`. À la 4e
 * utilisation, pose le flag `destroyAtTurnEnd` → le balayage de fin de tour
 * (turnEndDestroyEvents, partagé local/online) détruit Katsou (Défausse + XP).
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import { createMockAllyCard } from "tests/factories/card";

import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

const KATSOU: Card = createMockAllyCard({
  id: "katsou-test",
  name: "Katsou Mee",
  subTypes: ["Iop"],
  experience: 1,
  stats: {
    niveau: { value: 3, element: "Terre" },
    force: { value: 2, element: "Terre" },
  },
  effects: [
    {
      description: "[Terre] : Katsou Mee gagne +1 en Force …",
      compiled: {
        trigger: "onTap",
        cost: "paidOps",
        ops: [
          { op: "costTapResource", element: "Terre" },
          { op: "buffForceSelf", n: 1 },
          { op: "incTurnCounterSelf", counter: "katsouSpend" },
          {
            op: "conditional",
            cond: { cond: "selfCounterAtLeast", counter: "katsouSpend", n: 4 },
            ops: [{ op: "incTurnCounterSelf", counter: "destroyAtTurnEnd" }],
          },
        ],
      },
    },
  ],
});

/** Producteur de Terre = Allié dont la Force est Terre. */
function terreProducer(id: string): Card {
  return createMockAllyCard({
    id,
    name: id,
    stats: {
      niveau: { value: 1, element: "Terre" },
      force: { value: 1, element: "Terre" },
    },
  });
}

function setup(nProducers: number) {
  const P = Array.from({ length: nProducers }, (_, i) =>
    terreProducer(`terre-${i}`),
  );
  const { store } = makeEffectSandbox({
    first: "A",
    allAllies: true,
    extraCards: [KATSOU, ...P],
  });
  store.state.turn.number = 3;
  const katsouId = placeInZone(store, "A", { zone: "monde" });
  store.state.instances[katsouId].cardId = "katsou-test";
  for (const p of P) {
    const id = placeInZone(store, "A", { zone: "monde" });
    store.state.instances[id].cardId = p.id;
  }
  const heroB = store.state.seats.B.heroInstanceId!;
  return { store, katsouId, heroB };
}

/** Active le pouvoir de Katsou en payant le 1er producteur Terre proposé. */
function activate(store: ReturnType<typeof setup>["store"], katsouId: string) {
  store.activateTapPower(katsouId);
  if (store.effectTargeting?.op.op === "costTapResource") {
    const el = store.effectTargetIdsList[0];
    store.effectTargetChoose(el);
  }
}

describe("Katsou Mee — dépense cumulée + auto-destruction", () => {
  it("3 utilisations : +3 Force, PAS de flag → survit à la fin du tour", () => {
    const { store, katsouId } = setup(4);
    for (let i = 0; i < 3; i++) activate(store, katsouId);
    expect(store.state.instances[katsouId].counters.tokens?.katsouSpend).toBe(
      3,
    );
    expect(
      store.state.instances[katsouId].counters.tokens?.destroyAtTurnEnd ?? 0,
    ).toBe(0);
    store.nextTurn();
    expect(store.state.instances[katsouId].location.zone).toBe("monde");
  });

  it("4 utilisations : flag posé → détruit à la fin du tour (Défausse + XP adverse)", () => {
    const { store, katsouId, heroB } = setup(4);
    for (let i = 0; i < 4; i++) activate(store, katsouId);
    expect(store.state.instances[katsouId].counters.tokens?.katsouSpend).toBe(
      4,
    );
    expect(
      store.state.instances[katsouId].counters.tokens?.destroyAtTurnEnd ?? 0,
    ).toBeGreaterThan(0);
    const xpBefore = store.state.instances[heroB].counters.xp ?? 0;
    store.nextTurn();
    // détruit : quitte le Monde (Défausse) ; l'adversaire (B) gagne l'XP (415.1).
    expect(store.state.instances[katsouId].location.zone).toBe("defausse");
    expect(store.state.instances[heroB].counters.xp ?? 0).toBeGreaterThan(
      xpBefore,
    );
  });
});

describe("Fin de tour — déclenchés de mort du balayage (A10)", () => {
  it("une créature détruite à la fin du tour déclenche son « Quand détruit »", () => {
    const MARTYR: Card = createMockAllyCard({
      id: "martyr-test",
      name: "Martyr",
      effects: [
        {
          description: "Quand Martyr est détruit, votre Héros regagne 2 PV.",
          compiled: {
            trigger: "onSelfDestroyed",
            ops: [{ op: "heroGainPv", n: 2 }],
          },
        },
      ],
    });
    const { store } = makeEffectSandbox({
      first: "A",
      allAllies: true,
      extraCards: [MARTYR],
    });
    store.state.turn.number = 3;
    const id = placeInZone(store, "A", { zone: "monde" });
    store.state.instances[id].cardId = "martyr-test";
    const heroA = store.state.seats.A.heroInstanceId!;
    // Héros amputé pour rendre le regain observable.
    store.adjustCounter(heroA, "hp", -3);
    const hpBefore = store.state.instances[heroA].counters.hp!;
    // Flag « détruire à la fin du tour » (posé normalement par un effet Katsou-like).
    store.state.instances[id].counters.tokens = { destroyAtTurnEnd: 1 };
    store.nextTurn();
    // Détruit par le balayage ET son déclenché de mort a tourné (+2 PV).
    expect(store.state.instances[id].location.zone).toBe("defausse");
    expect(store.state.instances[heroA].counters.hp).toBe(hpBefore + 2);
  });
});
