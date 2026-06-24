import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import DeckMagMeta from "@/components/deck/DeckMagMeta.vue";
import type { OfficialDeck } from "@/data/officialDecks";

const base: OfficialDeck = {
  id: "x",
  name: "X",
  description: "",
  extension: "dofus-mag",
  hero: "H",
  havreSac: "HS",
  cards: [],
};

describe("DeckMagMeta", () => {
  it("affiche lore, conseil et cartes maîtresses quand présents", () => {
    const w = mount(DeckMagMeta, {
      props: {
        deck: {
          ...base,
          lore: "Il était une fois les Gelées",
          howToPlay: "Tape fort et vite",
          keyCards: ["Roi Gelax", "Gelaxième Dimension"],
          magIssue: "Dofus Mag 124",
        },
      },
    });
    expect(w.text()).toContain("Il était une fois les Gelées");
    expect(w.text()).toContain("Tape fort et vite");
    expect(w.text()).toContain("Roi Gelax");
    expect(w.text()).toContain("Dofus Mag 124");
  });

  it("ne rend rien pour un deck sans métadonnées (starter)", () => {
    const w = mount(DeckMagMeta, { props: { deck: base } });
    expect(w.text().trim()).toBe("");
  });
});
