/**
 * Déclenchés de mort EN COMBAT (P0-2, 804.7). Régression : `resolveCombat`
 * n'émettait aucun RuleEvent `destroyed`, donc « Quand détruit » ne partait
 * jamais quand la créature mourait en combat (le mode de mort principal) —
 * Tofu Mutant, Tofu Céleste & co. étaient marqués « couverts » mais muets.
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

/** Allié dont la mort régénère 2 PV au Héros contrôleur (onSelfDestroyed sûr). */
function nerbe(): Card {
  return createMockAllyCard({
    id: "nerbe",
    name: "Nerbe",
    stats: {
      niveau: { value: 1, element: "Feu" },
      force: { value: 1, element: "Feu" },
    },
    effects: [
      {
        description: "Quand le Nerbe est détruit, votre Héros regagne 2 PV.",
        compiled: {
          trigger: "onSelfDestroyed",
          ops: [{ op: "heroGainPv", n: 2 }],
        },
      },
    ],
  } as never);
}

/** Gros bloqueur adverse (Force 3) qui tue le Nerbe en duel. */
function gros(): Card {
  return createMockAllyCard({
    id: "gros",
    name: "Gros Bouftou",
    stats: {
      niveau: { value: 1, element: "Feu" },
      force: { value: 3, element: "Feu" },
    },
    effects: [],
  } as never);
}

function smallDeck(hero: Card, cards: Card[]): Deck {
  return {
    id: `deck-${cards.map((c) => c.id).join("-")}`,
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

describe("Déclenché de mort en combat (P0-2)", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("un Allié tué en duel déclenche son onSelfDestroyed (le Héros regagne 2 PV)", () => {
    useCardStore().cards = [
      createMockHeroCard({ id: "A-hero", name: "A Héros" }),
      createMockHeroCard({ id: "B-hero", name: "B Héros" }),
      nerbe(),
      gros(),
    ];
    const store = useGameStore();
    store.startSandbox(
      smallDeck(createMockHeroCard({ id: "A-hero", name: "A Héros" }), [
        nerbe(),
      ]),
      smallDeck(createMockHeroCard({ id: "B-hero", name: "B Héros" }), [
        gros(),
      ]),
      "A",
    );
    store.assistEffects = true;

    const nerbeId = instOf(store, "nerbe");
    const grosId = instOf(store, "gros");
    store.moveTo(nerbeId, { zone: "monde" }); // Nerbe de A
    store.moveTo(grosId, { zone: "monde" }); // Gros de B

    // A blesse d'abord son Héros pour rendre le regain observable.
    const heroA = store.state.seats.A.heroInstanceId!;
    store.adjustCounter(heroA, "hp", -3);
    const hpBefore = store.state.instances[heroA].counters.hp ?? 0;

    // Tour 3 (A) : A attaque le Héros de B avec le Nerbe ; B bloque avec le Gros.
    store.nextTurn(); // 2 (B)
    store.nextTurn(); // 3 (A)
    store.perspective = "A";
    expect(store.beginCombat(nerbeId)).toBe(true);
    store.combatChooseTarget(store.state.seats.B.havreSacInstanceId!);
    expect(store.combatConfirmAttackers()).toBe(true);
    // B bloque avec le Gros (Force 3 > 1) → le Nerbe meurt.
    store.perspective = "B";
    store.combatToggleBlock(grosId); // 1 attaquant → auto-assigné
    store.combatConfirmBlocks();
    store.perspective = "A";
    store.combatResolve();

    expect(store.state.instances[nerbeId].location.zone).toBe("defausse");
    // onSelfDestroyed résolu : +2 PV au Héros de A.
    expect(store.state.instances[heroA].counters.hp).toBe(hpBefore + 2);
  });
});
