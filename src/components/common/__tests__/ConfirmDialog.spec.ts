import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ConfirmDialog from "../ConfirmDialog.vue";

describe("ConfirmDialog", () => {
  it("devrait rendre le dialog quand open=true", () => {
    const wrapper = mount(ConfirmDialog, {
      props: {
        open: true,
        title: "Confirmer l'action",
        message: "Êtes-vous sûr ?",
      },
    });
    expect(
      wrapper.get("[data-testid='confirm-dialog']").attributes("open"),
    ).toBeDefined();
    expect(wrapper.text()).toContain("Confirmer l'action");
    expect(wrapper.text()).toContain("Êtes-vous sûr ?");
  });

  it("devrait ne pas avoir l'attribut open quand open=false", () => {
    const wrapper = mount(ConfirmDialog, {
      props: { open: false, title: "Test" },
    });
    expect(
      wrapper.get("[data-testid='confirm-dialog']").attributes("open"),
    ).toBeUndefined();
  });

  it("devrait émettre confirm au clic sur le bouton de confirmation", async () => {
    const wrapper = mount(ConfirmDialog, {
      props: { open: true, title: "Test" },
    });
    await wrapper.get("[data-testid='confirm-ok']").trigger("click");
    expect(wrapper.emitted("confirm")).toHaveLength(1);
  });

  it("devrait émettre cancel au clic sur le bouton d'annulation", async () => {
    const wrapper = mount(ConfirmDialog, {
      props: { open: true, title: "Test" },
    });
    await wrapper.get("[data-testid='confirm-cancel']").trigger("click");
    expect(wrapper.emitted("cancel")).toHaveLength(1);
  });

  it("devrait utiliser btn-error quand danger=true", () => {
    const wrapper = mount(ConfirmDialog, {
      props: { open: true, title: "Supprimer", danger: true },
    });
    expect(wrapper.get("[data-testid='confirm-ok']").classes()).toContain(
      "btn-error",
    );
  });

  it("devrait utiliser btn-primary quand danger=false (défaut)", () => {
    const wrapper = mount(ConfirmDialog, {
      props: { open: true, title: "Confirmer" },
    });
    expect(wrapper.get("[data-testid='confirm-ok']").classes()).toContain(
      "btn-primary",
    );
  });

  it("devrait utiliser les labels personnalisés", () => {
    const wrapper = mount(ConfirmDialog, {
      props: {
        open: true,
        title: "Test",
        confirmLabel: "Oui",
        cancelLabel: "Non",
      },
    });
    expect(wrapper.get("[data-testid='confirm-ok']").text()).toBe("Oui");
    expect(wrapper.get("[data-testid='confirm-cancel']").text()).toBe("Non");
  });

  it("devrait utiliser les labels par défaut si non fournis", () => {
    const wrapper = mount(ConfirmDialog, {
      props: { open: true, title: "Test" },
    });
    expect(wrapper.get("[data-testid='confirm-ok']").text()).toBe("Confirmer");
    expect(wrapper.get("[data-testid='confirm-cancel']").text()).toBe(
      "Annuler",
    );
  });
});
