import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";

const show = vi.fn();
const hide = vi.fn();
vi.mock("@/composables/useCardPreview", () => ({
  useCardPreview: () => ({
    show,
    hide,
    card: { value: null },
    mouseX: { value: 0 },
    mouseY: { value: 0 },
  }),
}));

import DeckCardGrid from "@/components/deck/DeckCardGrid.vue";
import type { DeckGalleryGroup } from "@/components/deck/deckGallery";
import type { Card } from "@/types/cards";

const groups: DeckGalleryGroup[] = [
  {
    section: "Alliés",
    total: 5,
    entries: [
      {
        name: "Carte A",
        quantity: 3,
        card: { id: "a", name: "Carte A", mainType: "Allié" } as Card,
      },
      { name: "Carte B", quantity: 2, card: null },
      {
        name: "Carte C",
        quantity: 1,
        card: {
          id: "c",
          name: "Carte C",
          mainType: "Action",
          stats: { pa: 3, niveau: { value: 1, element: "Feu" } },
        } as Card,
      },
    ],
  },
];

describe("DeckCardGrid", () => {
  it("affiche les sections, totaux et badges ×N en grille par défaut", () => {
    const w = mount(DeckCardGrid, { props: { groups } });
    expect(
      w.get('[data-testid="deck-card-grid"]').attributes("data-view"),
    ).toBe("grid");
    expect(w.text()).toContain("Alliés");
    expect(w.text()).toContain("5");
    expect(w.text()).toContain("×3");
    expect(w.text()).toContain("Carte B");
  });

  it("bascule en liste", async () => {
    const w = mount(DeckCardGrid, { props: { groups } });
    await w.get('[data-testid="toggle-view"]').trigger("click");
    expect(
      w.get('[data-testid="deck-card-grid"]').attributes("data-view"),
    ).toBe("list");
  });

  it("déclenche le survol-zoom sur une carte résolue", async () => {
    show.mockClear();
    const w = mount(DeckCardGrid, { props: { groups } });
    await w.get('[data-testid="card-tile-a"]').trigger("mouseenter");
    expect(show).toHaveBeenCalledTimes(1);
  });

  it("émet `select` au clic sur une carte résolue", async () => {
    const w = mount(DeckCardGrid, { props: { groups } });
    await w.get('[data-testid="card-tile-a"]').trigger("click");
    expect(w.emitted("select")?.[0]?.[0]).toMatchObject({ id: "a" });
  });

  it("affiche « PA · Élément » en vue liste pour une carte résolue, nom seul sinon", async () => {
    const w = mount(DeckCardGrid, { props: { groups } });
    await w.get('[data-testid="toggle-view"]').trigger("click");
    expect(w.text()).toContain("3 PA · Feu"); // Carte C (résolue)
    expect(w.text()).toContain("Carte B"); // non résolue : nom seul
    expect(w.text()).not.toContain("undefined PA");
  });
});
