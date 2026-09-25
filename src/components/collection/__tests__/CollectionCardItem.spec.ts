import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import CollectionCardItem from "../CollectionCardItem.vue";
import { createMockAllyCard } from "tests/factories/card";

let authenticated = true;
vi.mock("@/stores/authStore", () => ({
  useAuthStore: () => ({ isAuthenticated: authenticated }),
}));

function mountItem(props: Record<string, unknown> = {}) {
  return mount(CollectionCardItem, {
    props: {
      card: createMockAllyCard({ id: "card-1", name: "Bombite" }),
      quantity: 0,
      foilQuantity: 0,
      enableAddToDeck: false,
      ...props,
    },
    global: { stubs: { ErrataBadge: true } },
  });
}

describe("CollectionCardItem — mode sélection multiple", () => {
  beforeEach(() => {
    authenticated = true;
  });

  it("n'affiche pas de case à cocher hors mode sélection", () => {
    const w = mountItem();
    expect(w.find('[aria-pressed]').exists()).toBe(false);
  });

  it("affiche une case à cocher non cochée en mode sélection", () => {
    const w = mountItem({ selectionMode: true, selected: false });
    const checkbox = w.get('[aria-pressed]');
    expect(checkbox.attributes("aria-pressed")).toBe("false");
  });

  it("émet toggle-select au clic sur la case à cocher, sans ouvrir la fiche", async () => {
    const w = mountItem({ selectionMode: true, selected: false });
    await w.get('[aria-pressed]').trigger("click");

    expect(w.emitted("toggle-select")).toEqual([["card-1"]]);
    expect(w.emitted("select-card")).toBeUndefined();
  });

  it("émet toggle-select au clic sur la carte entière en mode sélection", async () => {
    const w = mountItem({ selectionMode: true, selected: false });
    await w.get('[role="button"]').trigger("click");

    expect(w.emitted("toggle-select")).toEqual([["card-1"]]);
    expect(w.emitted("select-card")).toBeUndefined();
  });

  it("ouvre la fiche (select-card) au clic hors mode sélection", async () => {
    const w = mountItem();
    await w.get('[role="button"]').trigger("click");

    expect(w.emitted("select-card")).toHaveLength(1);
    expect(w.emitted("toggle-select")).toBeUndefined();
  });

  it("masque la pastille de possession en mode sélection", () => {
    const w = mountItem({
      selectionMode: true,
      quantity: 3,
      foilQuantity: 0,
    });
    expect(w.text()).not.toContain("3/3");
  });
});
