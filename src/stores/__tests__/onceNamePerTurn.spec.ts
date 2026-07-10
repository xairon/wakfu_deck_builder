/**
 * « Vous ne pouvez jouer qu'une seule <Nom> par tour. » (Puissance d'Ogrest) —
 * flag compilé `onceNamePerTurn` : au jeu, jeton `oncePlayed_<slug>` posé sur
 * VOTRE Héros (purgé au changement de tour, préfixe TURN_TOKEN) ; whyCannotPlay
 * refuse une DEUXIÈME copie du même NOM le même tour (les rééditions partagent
 * la limite — clé = nom normalisé).
 */
import { describe, expect, it } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import type { Card, Deck } from "@/types/cards";
import { useGameStore } from "../gameStore";
import { useCardStore } from "../cardStore";
import { createMockActionCard, createMockDeck } from "tests/factories/card";
import { compileActionEffectText } from "@/game/rules/effects/dsl";

const TEXT =
  "L'Allié ou Héros de votre choix gagne +4 en Force et Géant jusqu'à la fin du tour. Vous ne pouvez jouer qu'une seule Puissance d'Ogrest par tour.";

function ogrest(id: string): Card {
  const compiled = compileActionEffectText(TEXT, "Puissance d'Ogrest");
  if (!compiled) throw new Error("le DSL ne compile pas Puissance d'Ogrest");
  return createMockActionCard({
    id,
    name: "Puissance d'Ogrest",
    stats: { niveau: { value: 0, element: "Neutre" } },
    effects: [{ description: TEXT, compiled }],
  });
}

describe("onceNamePerTurn — Puissance d'Ogrest", () => {
  it("le DSL compile le corps + le flag (clause strippée)", () => {
    const c = compileActionEffectText(TEXT, "Puissance d'Ogrest");
    expect(c).toEqual({
      trigger: "onPlay",
      onceNamePerTurn: true,
      ops: [
        {
          op: "buffForceTarget",
          n: 4,
          heroes: true,
          alsoKeyword: "Géant",
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("2e copie du même NOM refusée le même tour, rejouable au tour suivant", () => {
    setActivePinia(createPinia());
    const c1 = ogrest("ogrest-a");
    const c2 = ogrest("ogrest-b"); // réédition : autre id, MÊME nom
    const deck: Deck = createMockDeck();
    deck.cards[0] = { card: c1, quantity: 1 };
    deck.cards[1] = { card: c2, quantity: 1 };
    const cardStore = useCardStore();
    cardStore.cards = [
      deck.hero!,
      deck.havreSac!,
      ...deck.cards.map((dc) => dc.card),
    ].filter((c): c is Card => !!c);
    const store = useGameStore();
    store.startSandbox(deck, deck, "A");
    while (store.state.turn.number < 3 || store.state.turn.active !== "A") {
      store.nextTurn();
    }
    const toHand = (cardId: string): string => {
      for (const inst of Object.values(store.state.instances)) {
        if (inst.owner === "A" && inst.cardId === cardId) {
          store.moveTo(inst.instanceId, { zone: "main", owner: "A" });
          return inst.instanceId;
        }
      }
      throw new Error(`carte ${cardId} absente`);
    };
    const id1 = toHand("ogrest-a");
    const id2 = toHand("ogrest-b");
    // 1re copie : jouable — l'effet ouvre un ciblage qu'on laisse de côté.
    expect(store.playFromHand(id1)).toBe(true);
    expect(store.ruleError).toBeNull();
    if (store.effectTargeting) store.effectTargetSkip();
    // 2e copie MÊME TOUR : refusée par le NOM.
    expect(store.playFromHand(id2)).toBe(false);
    expect(store.ruleError).toContain("une seule");
    store.clearRuleError();
    // Tour suivant de A : le jeton est purgé → rejouable.
    store.nextTurn();
    store.nextTurn();
    expect(store.playFromHand(id2)).toBe(true);
    expect(store.ruleError).toBeNull();
  });
});
