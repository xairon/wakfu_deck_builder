import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import CollectionSelectionToolbar from "../CollectionSelectionToolbar.vue";

const props = { selectedCount: 2, filteredCount: 42 };

describe("CollectionSelectionToolbar", () => {
  it("affiche le nombre de cartes sélectionnées et le total filtré", () => {
    const w = mount(CollectionSelectionToolbar, { props });
    expect(w.text()).toContain("2 sélectionnées");
    expect(w.text()).toContain("42 résultats");
  });

  it("émet select-all-page / select-all-filtered / deselect-all / exit", async () => {
    const w = mount(CollectionSelectionToolbar, { props });
    await w.get('[data-testid="bulk-select-all-page"]').trigger("click");
    await w.get('[data-testid="bulk-select-all-filtered"]').trigger("click");
    await w.get('[data-testid="bulk-deselect-all"]').trigger("click");
    await w.get('[data-testid="bulk-exit"]').trigger("click");

    expect(w.emitted("select-all-page")).toHaveLength(1);
    expect(w.emitted("select-all-filtered")).toHaveLength(1);
    expect(w.emitted("deselect-all")).toHaveLength(1);
    expect(w.emitted("exit")).toHaveLength(1);
  });

  it("émet mark-owned et mark-missing", async () => {
    const w = mount(CollectionSelectionToolbar, { props });
    await w.get('[data-testid="bulk-mark-owned"]').trigger("click");
    await w.get('[data-testid="bulk-mark-missing"]').trigger("click");

    expect(w.emitted("mark-owned")).toHaveLength(1);
    expect(w.emitted("mark-missing")).toHaveLength(1);
  });

  it("émet adjust avec le delta et isFoil corrects", async () => {
    const w = mount(CollectionSelectionToolbar, { props });
    await w.get('[data-testid="bulk-normal-plus"]').trigger("click");
    await w.get('[data-testid="bulk-normal-minus"]').trigger("click");
    await w.get('[data-testid="bulk-foil-plus"]').trigger("click");
    await w.get('[data-testid="bulk-foil-minus"]').trigger("click");

    expect(w.emitted("adjust")).toEqual([
      [1, false],
      [-1, false],
      [1, true],
      [-1, true],
    ]);
  });

  it("désactive les actions groupées quand aucune carte n'est sélectionnée", () => {
    const w = mount(CollectionSelectionToolbar, {
      props: { selectedCount: 0, filteredCount: 42 },
    });

    expect(
      w.get('[data-testid="bulk-mark-owned"]').attributes("disabled"),
    ).toBeDefined();
    expect(
      w.get('[data-testid="bulk-mark-missing"]').attributes("disabled"),
    ).toBeDefined();
    expect(
      w.get('[data-testid="bulk-deselect-all"]').attributes("disabled"),
    ).toBeDefined();
  });

  it("désactive les actions groupées pendant un traitement (busy)", () => {
    const w = mount(CollectionSelectionToolbar, {
      props: { ...props, busy: true },
    });

    expect(
      w.get('[data-testid="bulk-mark-owned"]').attributes("disabled"),
    ).toBeDefined();
    expect(
      w.get('[data-testid="bulk-normal-plus"]').attributes("disabled"),
    ).toBeDefined();
  });
});
