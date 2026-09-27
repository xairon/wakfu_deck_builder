import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import ToastContainer from "../ToastContainer.vue";
import { useToast } from "@/composables/useToast";

describe("ToastContainer.vue", () => {
  beforeEach(() => {
    const { clearToasts } = useToast();
    clearToasts();
  });

  it("affiche une missive de notification avec son titre et son message", async () => {
    const { info } = useToast();
    info("Bienvenue dans le Monde des Douze !", {
      title: "Chronique d'Astrub",
    });

    const wrapper = mount(ToastContainer);
    await nextTick();

    expect(wrapper.text()).toContain("Chronique d'Astrub");
    expect(wrapper.text()).toContain("Bienvenue dans le Monde des Douze !");
    expect(wrapper.text()).toContain("Missive du Monde des Douze");
  });

  it("déclenche le callback onClick au clic sur la missive", async () => {
    const { info } = useToast();
    const handleClick = vi.fn();

    info("Nouveau message privé de Yugo", {
      title: "Message privé reçu",
      actionLabel: "Ouvrir la missive",
      onClick: handleClick,
    });

    const wrapper = mount(ToastContainer);
    await nextTick();

    expect(wrapper.text()).toContain("Ouvrir la missive");

    const toastElement = wrapper.find(".toast-missive");
    expect(toastElement.exists()).toBe(true);

    await toastElement.trigger("click");
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("ferme le toast sans déclencher onClick quand on clique sur le bouton fermer", async () => {
    const { info } = useToast();
    const handleClick = vi.fn();

    info("Notification informative", {
      title: "Info",
      onClick: handleClick,
    });

    const wrapper = mount(ToastContainer);
    await nextTick();

    const closeBtn = wrapper.find("button[aria-label='Fermer la notification']");
    expect(closeBtn.exists()).toBe(true);

    await closeBtn.trigger("click");
    expect(handleClick).not.toHaveBeenCalled();
  });
});
