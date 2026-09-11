import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { mount } from "@vue/test-utils";
import CollectionCompletion from "../CollectionCompletion.vue";
import { useCardStore } from "@/stores/cardStore";
import { createMockAllyCard } from "tests/factories/card";

describe("CollectionCompletion", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("émet select-extension avec le nom de l'extension au clic sur « Sélectionner »", async () => {
    const cardStore = useCardStore();
    cardStore.setCards([
      createMockAllyCard({
        id: "a1",
        extension: { name: "Incarnam" },
        rarity: "Commune" as never,
      }),
      createMockAllyCard({
        id: "a2",
        extension: { name: "Astrub" },
        rarity: "Commune" as never,
      }),
    ]);

    const w = mount(CollectionCompletion);
    const buttons = w.findAll("button");
    const incarnamButton = buttons.find((b) =>
      b.element.closest("article")?.textContent?.includes("Incarnam"),
    );
    expect(incarnamButton).toBeTruthy();

    await incarnamButton!.trigger("click");

    expect(w.emitted("select-extension")).toEqual([["Incarnam"]]);
  });

  it("n'affiche pas la barre de sélection multiple hors mode sélection", () => {
    const w = mount(CollectionCompletion, {
      props: { selectionMode: false },
    });
    expect(w.find('[data-testid="bulk-mark-owned"]').exists()).toBe(false);
  });

  it("affiche la barre de sélection multiple imbriquée et relaie ses événements", async () => {
    const w = mount(CollectionCompletion, {
      props: {
        selectionMode: true,
        selectedCount: 3,
        filteredCount: 10,
        extensions: ["Incarnam"],
      },
    });

    expect(w.text()).toContain("3 sélectionnées");

    await w.get('[data-testid="bulk-mark-owned"]').trigger("click");
    await w.get('[data-testid="bulk-deselect-all"]').trigger("click");
    await w.get('[data-testid="bulk-exit"]').trigger("click");

    expect(w.emitted("mark-owned")).toHaveLength(1);
    expect(w.emitted("deselect-all")).toHaveLength(1);
    expect(w.emitted("exit")).toHaveLength(1);
  });
});
