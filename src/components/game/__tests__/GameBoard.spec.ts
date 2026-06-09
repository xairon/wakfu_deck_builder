import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { describe, it, expect, beforeEach } from "vitest";
import GameBoard from "../GameBoard.vue";
import { useGameStore } from "@/stores/gameStore";
import { createMockDeck } from "tests/factories/card";

describe("GameBoard — rendu", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("se monte (plateau + Monde) et rend des cartes, sans erreur", () => {
    const store = useGameStore();
    store.startSandbox(createMockDeck(), createMockDeck());
    const wrapper = mount(GameBoard, {
      global: { stubs: { CardZoomModal: true } },
    });
    expect(wrapper.find(".gtable").exists()).toBe(true);
    expect(wrapper.text()).toContain("Le Monde");
    // Héros (×2) + Havre-Sac (×2) au minimum
    expect(wrapper.findAll(".game-card").length).toBeGreaterThanOrEqual(2);
  });

  it("sélectionner une carte ouvre la barre d'action", async () => {
    const store = useGameStore();
    store.startSandbox(createMockDeck(), createMockDeck());
    const wrapper = mount(GameBoard, {
      global: { stubs: { CardZoomModal: true } },
    });
    await wrapper.find(".game-card").trigger("click");
    expect(wrapper.find(".gactionbar").exists()).toBe(true);
  });
});
