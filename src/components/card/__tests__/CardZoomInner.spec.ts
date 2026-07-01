import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import CardZoomInner from "../CardZoomInner.vue";
import { createMockAllyCard } from "tests/factories/card";

function mountInner() {
  const card = createMockAllyCard({ id: "c", name: "Carte Test" });
  return mount(CardZoomInner, {
    props: {
      card,
      errata: [],
      elementColor: "#888",
      cardImg: "/x.webp",
      displayEffects: [
        { description: "Piochez une carte." },
        {
          description: "Precision sur la resolution en tournoi.",
          kind: "ruling",
        },
        {
          description: "Correction officielle du texte.",
          kind: "errata",
        },
      ],
    },
  });
}

describe("CardZoomInner — séparation effets / notes", () => {
  it("n'affiche que les effets réels sous « Effets »", () => {
    const wrapper = mountInner();
    const effects = wrapper.get('[data-testid="card-effects"]');
    expect(effects.text()).toContain("Piochez une carte");
    expect(effects.text()).not.toContain("tournoi");
    expect(effects.text()).not.toContain("Correction officielle");
  });

  it("regroupe rulings/errata sous « Notes » avec leur libellé", () => {
    const wrapper = mountInner();
    const notes = wrapper.get('[data-testid="card-notes"]');
    expect(notes.text()).toContain("resolution en tournoi");
    expect(notes.text()).toContain("Correction officielle");
    // Libellés d'annotation (ruling → Note, errata → Errata)
    expect(notes.text()).toContain("Note");
    expect(notes.text()).toContain("Errata");
    // Le vrai effet ne doit PAS apparaître dans la section Notes
    expect(notes.text()).not.toContain("Piochez une carte");
  });
});
