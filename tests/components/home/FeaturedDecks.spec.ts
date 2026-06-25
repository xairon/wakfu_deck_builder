import { describe, it, expect } from "vitest";
import { mount, RouterLinkStub } from "@vue/test-utils";
import FeaturedDecks from "@/components/home/FeaturedDecks.vue";

const items = [
  {
    id: "deck-a",
    name: "Deck A",
    hero: "Héros A",
    img: "/images/cards/a_recto.webp",
  },
  {
    id: "deck-b",
    name: "Deck B",
    hero: "Héros B",
    img: "/images/cards/b_recto.webp",
  },
];

describe("FeaturedDecks", () => {
  it("rend un lien vers la page détail par deck", () => {
    const w = mount(FeaturedDecks, {
      props: { items },
      global: { stubs: { RouterLink: RouterLinkStub } },
    });
    const links = w.findAllComponents(RouterLinkStub);
    expect(links).toHaveLength(2);
    expect(links[0].props("to")).toBe("/decks/official/deck-a");
    expect(w.text()).toContain("Deck A");
  });
});
