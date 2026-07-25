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

    // ORDRE des colonnes, pas seulement leur présence : si « Version imprimée »
    // et « À jouer » s'inversaient, le panneau annoncerait exactement l'inverse
    // de la vérité (« imprimé 6, à jouer 7 ») — et un toContain ne le verrait pas.
    const headers = w.findAll("thead th").map((h) => h.text());
    expect(headers).toEqual(["Champ", "Version imprimée", "À jouer"]);

    // Idem pour les cellules : valeurs distinctes (7 vs 6) pour qu'une inversion
    // change réellement l'assertion.
    const rows = w.findAll("tbody tr");
    expect(rows).toHaveLength(1);
    const cells = rows[0].findAll("td").map((td) => td.text());
    expect(cells).toEqual(["PA", "7", "6"]);
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
              { label: "  ", before: "a", after: "b" },
              { label: "PA", before: "7", after: "6" },
            ] as never,
          },
        ],
      },
    });

    // Une seule ligne rendue : celle au libellé blanc est écartée (une cellule
    // « Champ » vide serait muette). On assert sur les CELLULES et non sur
    // w.text() : un `not.toContain("a")` buterait sur le « a » de « ramené »
    // dans le résumé — assertion fragile qui teste la prose, pas le filtrage.
    const rows = w.findAll("tbody tr");
    expect(rows).toHaveLength(1);
    expect(rows[0].findAll("td").map((td) => td.text())).toEqual([
      "PA",
      "7",
      "6",
    ]);
  });
});
