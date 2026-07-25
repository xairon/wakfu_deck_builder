import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ErrataForm from "@/components/admin/ErrataForm.vue";

const CARDS = [{ id: "opee-tissoin-incarnam", name: "Opée Tissoin" }];

function state(over = {}) {
  return {
    card_id: "",
    errata_date: "",
    source: "",
    summary: "",
    before_text: "",
    after_text: "",
    changes: [],
    ...over,
  };
}

describe("ErrataForm", () => {
  it("devrait exposer les champs attendus", () => {
    const w = mount(ErrataForm, {
      props: { modelValue: state(), cards: CARDS },
    });
    for (const id of [
      "f-card",
      "f-date",
      "f-source",
      "f-summary",
      "f-before",
      "f-after",
    ])
      expect(w.find(`[data-testid="${id}"]`).exists()).toBe(true);
  });

  it("devrait ajouter puis retirer une ligne de changement", async () => {
    const w = mount(ErrataForm, {
      props: { modelValue: state(), cards: CARDS },
    });
    await w.find('[data-testid="add-change"]').trigger("click");
    expect(w.find('[data-testid="change-label-0"]').exists()).toBe(true);
    await w.find('[data-testid="remove-change-0"]').trigger("click");
    expect(w.find('[data-testid="change-label-0"]').exists()).toBe(false);
  });

  it("devrait pré-remplir les changements existants", () => {
    const w = mount(ErrataForm, {
      props: {
        modelValue: state({
          changes: [{ label: "PA", before: "7", after: "6" }],
        }),
        cards: CARDS,
      },
    });
    expect(
      (w.find('[data-testid="change-label-0"]').element as HTMLInputElement)
        .value,
    ).toBe("PA");
  });

  it("devrait émettre submit", async () => {
    const w = mount(ErrataForm, {
      props: {
        modelValue: state({ summary: "x", card_id: "y" }),
        cards: CARDS,
      },
    });
    await w.find('[data-testid="errata-submit"]').trigger("click");
    expect(w.emitted("submit")).toBeTruthy();
  });
});
