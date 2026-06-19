import { setActivePinia, createPinia } from "pinia";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import CollectionGrid from "../CollectionGrid.vue";
import { createMockAllyCard } from "tests/factories/card";

/** Items au format encapsulé { card, quantity, foilQuantity } (comme CollectionView). */
function items(quantities: number[]) {
  return quantities.map((q, i) => ({
    card: createMockAllyCard({ id: `c-${i}`, name: `Carte ${i}` }),
    quantity: q,
    foilQuantity: 0,
  }));
}

function mountGrid(filteredCards: unknown[]) {
  return mount(CollectionGrid, {
    props: { filteredCards, pageSize: 2 },
    global: { stubs: { CollectionCardItem: true } },
  });
}

describe("CollectionGrid — pagination", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // jsdom n'implémente pas scrollIntoView (appelé par goTo).
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("ajuster la quantité d'une carte ne ramène PAS à la page 1", async () => {
    // 5 cartes, pageSize 2 → 3 pages.
    const wrapper = mountGrid(items([0, 0, 0, 0, 0]));
    await wrapper.get('[aria-label="Page suivante"]').trigger("click");
    expect(wrapper.text()).toContain("page 2/3");

    // Ajout/retrait d'une copie : MÊME jeu de cartes (mêmes ids, même ordre),
    // seule une quantité change → le parent repasse un NOUVEAU tableau.
    await wrapper.setProps({ filteredCards: items([0, 3, 0, 0, 0]) });

    expect(wrapper.text()).toContain("page 2/3");
  });

  it("changer le jeu de cartes (recherche/filtre) ramène à la page 1", async () => {
    const wrapper = mountGrid(items([0, 0, 0, 0, 0]));
    await wrapper.get('[aria-label="Page suivante"]').trigger("click");
    expect(wrapper.text()).toContain("page 2/3");

    // Jeu de cartes différent (ids différents) → vraie nouvelle liste.
    const other = [0, 0, 0, 0].map((q, i) => ({
      card: createMockAllyCard({ id: `x-${i}`, name: `Autre ${i}` }),
      quantity: q,
      foilQuantity: 0,
    }));
    await wrapper.setProps({ filteredCards: other });

    expect(wrapper.text()).toContain("page 1/2");
  });
});
