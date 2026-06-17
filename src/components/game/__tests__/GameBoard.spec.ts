import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { describe, it, expect, beforeEach, vi } from "vitest";
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

describe("GameBoard — jouer depuis la main (clavier/clic, P3.6)", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("devrait jouer une carte de la main via playFromHand, pas un moveTo brut", async () => {
    const store = useGameStore();
    store.startSandbox(createMockDeck(), createMockDeck());
    store.assist = true;
    const me = store.perspective;
    // startSandbox ne distribue pas de main d'ouverture : on pioche une carte.
    if (store.state.seats[me].main.length === 0) store.draw(me);
    const handId = store.state.seats[me].main[0];
    expect(handId).toBeTruthy();

    const playSpy = vi.spyOn(store, "playFromHand");

    const wrapper = mount(GameBoard, {
      global: { stubs: { CardZoomModal: true } },
    });

    // Sélectionner la carte de main → ouvre la barre d'action.
    await wrapper.get(`[data-testid="card-${handId}"]`).trigger("click");
    const mondeBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("→ Monde"));
    expect(mondeBtn).toBeTruthy();

    await mondeBtn!.trigger("click");

    // Le chemin clavier/clic passe par playFromHand (coût + légalité), comme le DnD.
    expect(playSpy).toHaveBeenCalledWith(handId);
  });
});
