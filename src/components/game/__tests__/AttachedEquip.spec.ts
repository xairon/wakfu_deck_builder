import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import AttachedEquip from "../AttachedEquip.vue";
import { useGameStore } from "@/stores/gameStore";
import { useCardStore } from "@/stores/cardStore";
import type { Card, Deck } from "@/types/cards";
import type { RedactedInstance } from "@/game";
import {
  createMockHeroCard,
  createMockHavreSacCard,
  createMockAllyCard,
} from "tests/factories/card";

/** Deck minimal jouable (Héros + Havre-Sac + 48 Alliés Niveau 1). */
function makeDeck(tag: string): { deck: Deck; cards: Card[] } {
  const hero = createMockHeroCard({ id: tag + "-hero", name: tag + " Héros" });
  const sac = createMockHavreSacCard({ id: tag + "-sac", name: tag + " Sac" });
  const ally = createMockAllyCard({
    id: tag + "-ally",
    name: tag + " Allié",
    stats: {
      niveau: { value: 1, element: "Feu" },
      force: { value: 1, element: "Feu" },
    },
  });
  const deck: Deck = {
    id: tag,
    name: tag,
    hero,
    havreSac: sac,
    cards: [{ card: ally, quantity: 48 }],
    createdAt: "2026-07-07T00:00:00.000Z",
    updatedAt: "2026-07-07T00:00:00.000Z",
  };
  return { deck, cards: [hero, sac, ally] };
}

function bearerWith(attachments: string[]): RedactedInstance {
  return {
    instanceId: "bearer",
    cardId: null,
    owner: "A",
    controller: "A",
    face: "recto",
    orientation: "upright",
    counters: {},
    attachments,
  };
}

const mountOpts = { global: { stubs: { GameCard: true } } };

describe("AttachedEquip — rend les équipements attachés à un Porteur", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("ne rend RIEN quand le Porteur n'a aucun équipement", () => {
    const a = makeDeck("A");
    const b = makeDeck("B");
    useCardStore().cards = [...a.cards, ...b.cards];
    useGameStore().startSandbox(a.deck, b.deck, "A", { openingHand: true });
    const w = mount(AttachedEquip, {
      props: { bearer: bearerWith([]), selectedId: null },
      ...mountOpts,
    });
    expect(w.find('[data-testid="attached-equip"]').exists()).toBe(false);
  });

  it("rend UNE carte par équipement attaché (résolu via state.instances)", () => {
    const a = makeDeck("A");
    const b = makeDeck("B");
    useCardStore().cards = [...a.cards, ...b.cards];
    const store = useGameStore();
    store.startSandbox(a.deck, b.deck, "A", { openingHand: true });
    // N'importe quelle instance réelle sert de faux « équipement attaché » : le
    // point testé est que le composant la RÉSOUT depuis state.instances et la rend
    // (avant le correctif, l'équipement attaché n'apparaissait NULLE PART).
    const someId = Object.keys(store.state.instances)[0];
    expect(someId).toBeTruthy();
    const w = mount(AttachedEquip, {
      props: { bearer: bearerWith([someId]), selectedId: null },
      ...mountOpts,
    });
    expect(w.find('[data-testid="attached-equip"]').exists()).toBe(true);
    expect(w.findAll(".attach__card")).toHaveLength(1);
  });

  it("ignore les ids introuvables (aucune instance) sans planter", () => {
    const a = makeDeck("A");
    const b = makeDeck("B");
    useCardStore().cards = [...a.cards, ...b.cards];
    useGameStore().startSandbox(a.deck, b.deck, "A", { openingHand: true });
    const w = mount(AttachedEquip, {
      props: { bearer: bearerWith(["does-not-exist"]), selectedId: null },
      ...mountOpts,
    });
    expect(w.find('[data-testid="attached-equip"]').exists()).toBe(false);
  });
});
