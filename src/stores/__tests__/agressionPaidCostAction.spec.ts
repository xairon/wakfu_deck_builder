/**
 * Régression (bugs #1 + #2 signalés en jeu) — Agression est une ACTION dont le
 * SEUL effet est un pouvoir à coût payé « Inclinez l'un de vos Alliés ou Héros :
 * il inflige sa Force … » qui se compile en `trigger: "onTap"` (cost paidOps,
 * actor costTarget). Elle doit :
 *   1. se résoudre par le flux de ciblage PROTÉGÉ (508.x — le Héros adverse
 *      embagé n'est PAS une cible légale) ;
 *   2. partir en Défausse après résolution (et non « rester sur la table » dans
 *      le Monde).
 * Avant le correctif, `playEffects` n'acceptait que `trigger: "onPlay"` → Agression
 * était jouée dans le Monde, jamais défaussée, et ses Dommages appliqués hors du
 * pipeline (contournant la protection).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useGameStore } from "../gameStore";
import { useCardStore } from "../cardStore";
import {
  createMockHeroCard,
  createMockHavreSacCard,
  createMockActionCard,
  createMockAllyCard,
} from "tests/factories/card";
import type { Card, Deck } from "@/types/cards";

/** Agression (Incarnam) : effet réel + deux rulings (kind → hors printedEffects). */
function makeAgression(): Card {
  return createMockActionCard({
    id: "agression-test",
    name: "Agression",
    // Niveau 0 : coût de lancement nul → test isolé du paiement de Ressources
    // (le correctif porte sur le coût PAYÉ « Inclinez … », pas sur le Niveau).
    stats: { niveau: { value: 0, element: "Neutre" } },
    effects: [
      {
        description:
          "Inclinez l'un de vos Alliés ou Héros : il inflige sa Force en Dommages à l'Allié ou Héros de votre choix.",
        compiled: {
          trigger: "onTap",
          cost: "paidOps",
          actor: "costTarget",
          ops: [
            {
              op: "costTapControlled",
              heroes: true,
              zones: ["monde", "havreSac"],
            },
            {
              op: "damageTargetByForce",
              element: "Neutre",
              heroes: true,
              zones: ["monde", "havreSac"],
            },
          ],
        },
      },
      { description: "Ruling de Force.", kind: "ruling" },
      { description: "Ruling de Portée.", kind: "ruling" },
    ] as unknown as Card["effects"],
  });
}

function bouftou(): Card {
  return createMockAllyCard({
    id: "bouftou-test",
    name: "Bouftou",
    subTypes: ["Monstre", "Bouftou"],
    stats: {
      niveau: { value: 2, element: "Terre" },
      force: { value: 2, element: "Terre" },
    },
  });
}

function smallDeck(cards: Card[]): Deck {
  return {
    id: `deck-${Math.random().toString(36).slice(2)}`,
    name: "test",
    hero: createMockHeroCard(),
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

describe("Agression — Action à coût payé (onTap paidOps)", () => {
  beforeEach(() => setActivePinia(createPinia()));

  function setup(bWorldAlly: boolean) {
    const cible = createMockAllyCard({ id: "cible-test", name: "Cible" });
    useCardStore().cards = [makeAgression(), bouftou(), cible];
    const store = useGameStore();
    store.assistEffects = true;
    store.startSandbox(
      smallDeck([makeAgression(), bouftou()]),
      smallDeck([cible]),
      "A",
    );

    const agrId = instOf(store, "agression-test");
    const bftId = instOf(store, "bouftou-test");
    const cibId = instOf(store, "cible-test");
    store.moveTo(agrId, { zone: "main", owner: "A" });
    store.moveTo(bftId, { zone: "monde" });
    if (bWorldAlly) store.moveTo(cibId, { zone: "monde" });
    // Tour 3 = 2e tour de A (pas de restriction du 1er tour de partie).
    store.nextTurn(); // → tour 2 (B)
    store.nextTurn(); // → tour 3 (A)
    return { store, agrId, bftId, cibId };
  }

  it("se résout par le ciblage protégé : le Héros adverse embagé n'est pas ciblable", () => {
    const { store, agrId, bftId, cibId } = setup(true);
    const heroB = store.state.seats.B.heroInstanceId!;

    expect(store.playFromHand(agrId)).toBe(true);
    // 1) fenêtre de coût : « Inclinez l'un de vos Alliés ou Héros »
    expect(store.effectTargeting?.op.op).toBe("costTapControlled");
    store.effectTargetChoose(bftId);

    // 2) fenêtre de dégâts : Héros B PROTÉGÉ (havreSac) exclu, Cible du Monde incluse
    expect(store.effectTargeting?.op.op).toBe("damageTargetByForce");
    expect(store.effectTargetIdsList).not.toContain(heroB);
    expect(store.effectTargetIdsList).toContain(cibId);

    // 3) résolution sur la Cible : 2 Dommages (Force du Bouftou), Héros B intact
    store.effectTargetChoose(cibId);
    expect(store.state.instances[cibId].counters.damage).toBe(2);
    expect(store.state.instances[heroB].counters.hp).toBe(20);

    // 4) l'Action part en Défausse (ne reste pas sur la table dans le Monde)
    expect(store.state.seats.A.defausse).toContain(agrId);
    expect(store.state.monde).not.toContain(agrId);
  });
});
