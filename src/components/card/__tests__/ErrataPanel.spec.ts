import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ErrataPanel from "@/components/card/ErrataPanel.vue";

const BASE = {
  date: "2011-10-05",
  source: "Forum officiel Wakfu",
  summary: "Coût en PA ramené à 6.",
  changes: [],
};

describe("ErrataPanel", () => {
  it("ne devrait rien rendre sans errata", () => {
    const w = mount(ErrataPanel, { props: { errata: [] } });
    expect(w.text()).toBe("");
  });

  it("devrait afficher le tableau des changements quand ils sont structurés", () => {
    const w = mount(ErrataPanel, {
      props: {
        errata: [
          { ...BASE, changes: [{ label: "PA", before: "7", after: "6" }] },
        ],
      },
    });
    expect(w.find("table").exists()).toBe(true);
    expect(w.text()).toContain("PA");
    expect(w.text()).toContain("7");
    expect(w.text()).toContain("6");
    // Le libellé de colonne parle des exemplaires physiques, pas de l'image
    // affichée à côté (qui, elle, montre déjà la valeur corrigée).
    expect(w.text()).toContain("Version imprimée");
  });

  it("devrait retomber sur la prose quand changes est vide", () => {
    const w = mount(ErrataPanel, {
      props: { errata: [{ ...BASE, before: "7 PA", after: "6 PA" }] },
    });
    expect(w.find("table").exists()).toBe(false);
    expect(w.text()).toContain("Coût en PA ramené à 6.");
    expect(w.text()).toContain("7 PA");
    expect(w.text()).toContain("6 PA");
  });

  it("devrait afficher la date en français et la source", () => {
    const w = mount(ErrataPanel, { props: { errata: [BASE] } });
    expect(w.text()).toContain("05/10/2011");
    expect(w.text()).toContain("Forum officiel Wakfu");
  });

  it("devrait ignorer une ligne de changement mal formée sans casser le reste", () => {
    const w = mount(ErrataPanel, {
      props: {
        errata: [
          {
            ...BASE,
            changes: [
              { label: "", before: "x", after: "y" },
              { label: "PA", before: "7", after: "6" },
            ] as never,
          },
        ],
      },
    });
    expect(w.text()).toContain("PA");
  });
});
