import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { describe, it, expect, beforeEach } from "vitest";
import VictoryDefeatOverlay from "../VictoryDefeatOverlay.vue";
import { useGameStore } from "@/stores/gameStore";
import { createMockDeck } from "tests/factories/card";

describe("VictoryDefeatOverlay", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("affiche l'overlay lors d'une fin de partie et le ferme en continuant la partie lors du clic sur 'Rester dans la partie'", async () => {
    const store = useGameStore();
    store.startSandbox(createMockDeck(), createMockDeck());
    const me = store.perspective;
    const heroId = store.state.seats[me].heroInstanceId!;

    const wrapper = mount(VictoryDefeatOverlay);
    expect(wrapper.find('[data-testid="victory-defeat-overlay"]').exists()).toBe(false);

    // Infliger dégâts mortels
    store.adjustCounter(heroId, "hp", -20);
    expect(store.matchPhase).toBe("finished");

    await wrapper.vm.$nextTick();
    const overlay = wrapper.find('[data-testid="victory-defeat-overlay"]');
    expect(overlay.exists()).toBe(true);

    // Clic sur "Rester dans la partie"
    const stayBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Rester dans la partie"));
    expect(stayBtn).toBeTruthy();

    await stayBtn!.trigger("click");
    expect(store.matchPhase).toBe("playing");
    expect(store.continuedMatch).toBe(true);

    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="victory-defeat-overlay"]').exists()).toBe(false);
  });
});
