/**
 * COÛT sacrificeSelf/banishSelf (E4) — « Détruisez [cette carte] : CORPS ». Ce
 * coût REMPLACE l'inclinaison : il ne doit donc PAS exiger une source dressée.
 * Régression : le garde « déjà inclinée » courait avant la branche sacrifice, si
 * bien qu'une Chauve-Souris Vampyre inclinée ne pouvait pas se sacrifier.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useGameStore } from "../gameStore";
import { useCardStore } from "../cardStore";
import {
  createMockHeroCard,
  createMockHavreSacCard,
  createMockAllyCard,
} from "tests/factories/card";
import type { Card, Deck } from "@/types/cards";

/** Allié « Détruisez [self] : votre Héros regagne 2 PV » (onTap + sacrificeSelf). */
function sacrifier(): Card {
  return createMockAllyCard({
    id: "sacri",
    name: "Chauve-Souris (test)",
    stats: {
      niveau: { value: 1, element: "Air" },
      force: { value: 1, element: "Air" },
    },
    effects: [
      {
        description: "Détruisez la Chauve-Souris : votre Héros regagne 2 PV.",
        compiled: {
          trigger: "onTap",
          cost: "sacrificeSelf",
          ops: [{ op: "heroGainPv", n: 2 }],
        },
      },
    ],
  } as never);
}

function smallDeck(hero: Card, cards: Card[]): Deck {
  return {
    id: "d",
    name: "test",
    hero: hero as Deck["hero"],
    havreSac: createMockHavreSacCard(),
    cards: cards.map((card) => ({ card, quantity: 1 })),
    reserve: [],
    createdAt: "",
    updatedAt: "",
  };
}

function instOf(store: ReturnType<typeof useGameStore>, cardId: string) {
  return Object.values(store.state.instances).find((i) => i.cardId === cardId)!
    .instanceId;
}

describe("coût sacrificeSelf sur source INCLINÉE (E4)", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("une carte inclinée peut se sacrifier (le coût remplace l'inclinaison)", () => {
    const heroA = createMockHeroCard({ id: "A-hero", name: "A Héros" });
    useCardStore().cards = [
      heroA,
      createMockHeroCard({ id: "B-hero", name: "B Héros" }),
      sacrifier(),
    ];
    const store = useGameStore();
    store.startSandbox(
      smallDeck(heroA, [sacrifier()]),
      smallDeck(createMockHeroCard({ id: "B-hero", name: "B Héros" }), []),
      "A",
    );
    store.assistEffects = true;

    const sacId = instOf(store, "sacri");
    store.moveTo(sacId, { zone: "monde" });
    // On INCLINE la source (ex. elle a déjà attaqué / produit).
    store.toggleTap(sacId);
    expect(store.state.instances[sacId].orientation).toBe("tapped");

    const heroAId = store.state.seats.A.heroInstanceId!;
    store.adjustCounter(heroAId, "hp", -3);
    const hpBefore = store.state.instances[heroAId].counters.hp ?? 0;
    store.perspective = "A";

    // Activer le pouvoir sacrificiel malgré l'inclinaison.
    expect(store.activateTapPower(sacId)).toBe(true);
    expect(store.ruleError).toBeNull();
    // La source part en Défausse et le Héros regagne 2 PV.
    expect(store.state.instances[sacId].location.zone).toBe("defausse");
    expect(store.state.instances[heroAId].counters.hp ?? 0).toBe(hpBefore + 2);
  });
});
