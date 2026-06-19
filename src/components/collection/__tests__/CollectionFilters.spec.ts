import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import CollectionFilters from "../CollectionFilters.vue";

const props = {
  extensions: [],
  mainTypes: [],
  subTypes: [],
  rarities: [],
  elements: [],
  searchQuery: "",
  selectedExtension: "",
  hideNotOwned: false,
  selectedSortField: "number",
  isDescending: false,
  selectedMainType: "",
  selectedSubType: "",
  selectedRarity: "",
  selectedElement: "",
  minLevel: null,
  maxLevel: null,
  minCost: null,
  maxCost: null,
  minForce: null,
  maxForce: null,
  effectQuery: "",
};

describe("CollectionFilters — filtres ajoutés", () => {
  it("émet update:effect-query sur saisie", async () => {
    const w = mount(CollectionFilters, { props });
    await w.get('[data-testid="filter-effect-query"]').setValue("piochez");
    expect(w.emitted("update:effect-query")?.at(-1)).toEqual(["piochez"]);
  });

  it("émet update:min-force / update:max-force (number)", async () => {
    const w = mount(CollectionFilters, { props });
    await w.get('[data-testid="filter-min-force"]').setValue("3");
    await w.get('[data-testid="filter-max-force"]').setValue("8");
    expect(w.emitted("update:min-force")?.at(-1)).toEqual([3]);
    expect(w.emitted("update:max-force")?.at(-1)).toEqual([8]);
  });

  it("émet update:min-force null quand le champ est vidé", async () => {
    const w = mount(CollectionFilters, {
      props: { ...props, minForce: 5 },
    });
    const input = w.get('[data-testid="filter-min-force"]');
    await input.setValue("5");
    await input.setValue("");
    // When cleared, v-model.number on an empty string gives "" which is not a number;
    // the emit handler should send null.
    expect(w.emitted("update:min-force")?.at(-1)).toEqual([null]);
  });
});
