/**
 * Portée 508.1b/c pour les ops de MASSE (P0-3). Un `damageAll`/`destroyAll`/`tapAll`
 * visant l'adversaire (zones par défaut [monde, havreSac]) ne doit PAS atteindre
 * l'intérieur du Havre-Sac adverse — cohérent avec le ciblage générique.
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

/** Héros de A dont le pouvoir inflige 2 Dommages à TOUS les Alliés adverses
 *  (Monde ET Havre-Sac — la fuite testée). */
function heroDamageAll(): Card {
  const face = {
    stats: { pv: 16, pa: 6, pm: 3 },
    effects: [
      {
        description: "inflige 2 Dommages à tous les Alliés adverses.",
        compiled: {
          trigger: "onTap",
          ops: [
            {
              op: "damageAll",
              n: 2,
              element: "Feu",
              controller: "opponent",
              heroes: false,
              zones: ["monde", "havreSac"],
            },
          ],
        },
      },
    ],
    keywords: [],
  };
  return createMockHeroCard({
    id: "A-hero",
    name: "A Balayeur",
    recto: face as never,
    verso: face as never,
  });
}

function ally(id: string): Card {
  return createMockAllyCard({
    id,
    name: id,
    stats: {
      niveau: { value: 1, element: "Feu" },
      force: { value: 5, element: "Feu" },
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

describe("Ops de masse — portée 508 (P0-3)", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("un damageAll adverse frappe l'Allié adverse au Monde mais épargne celui du Havre-Sac", () => {
    useCardStore().cards = [
      heroDamageAll(),
      createMockHeroCard({ id: "B-hero", name: "B Héros" }),
      ally("b-monde"),
      ally("b-bag"),
    ];
    const store = useGameStore();
    store.startSandbox(
      smallDeck(heroDamageAll(), []),
      smallDeck(createMockHeroCard({ id: "B-hero", name: "B Héros" }), [
        ally("b-monde"),
        ally("b-bag"),
      ]),
      "A",
    );
    store.assistEffects = true;

    const bMonde = instOf(store, "b-monde");
    const bBag = instOf(store, "b-bag");
    store.moveTo(bMonde, { zone: "monde" }); // Allié B exposé
    store.moveTo(bBag, { zone: "havreSac", owner: "B" }); // Allié B embagué

    // A active le pouvoir de balayage.
    store.perspective = "A";
    const heroA = store.state.seats.A.heroInstanceId!;
    expect(store.activateTapPower(heroA)).toBe(true);

    // 508 : le Monde encaisse 2 ; le Havre-Sac adverse est hors de portée.
    expect(store.state.instances[bMonde].counters.damage ?? 0).toBe(2);
    expect(store.state.instances[bBag].counters.damage ?? 0).toBe(0);
  });
});
