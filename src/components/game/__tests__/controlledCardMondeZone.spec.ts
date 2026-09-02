import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { useGameStore } from "@/stores/gameStore";
import GameBoard from "../GameBoard.vue";
import { createMockDeck } from "tests/factories/card";

describe("GameBoard — Carte adverse sous contrôle et affichage dans la zone Monde", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("affiche une carte adverse sous notre contrôle dans 'Vos alliés' (monde joueur) et la rend draggable", async () => {
    const store = useGameStore();
    store.startSandbox(createMockDeck(), createMockDeck());
    const me = store.perspective;
    const opp = me === "A" ? "B" : "A";

    // On récupère une carte appartenant à l'adversaire (opp) et on la met dans le Monde
    const oppCardId = store.state.seats[opp].pioche[0];
    store.moveTo(oppCardId, { zone: "monde" });

    // Initialement, elle appartient à opp et est contrôlée par opp
    expect(store.state.instances[oppCardId].owner).toBe(opp);
    expect(store.state.instances[oppCardId].controller).toBe(opp);

    const wrapper = mount(GameBoard, {
      global: { stubs: { CardZoomModal: true } },
    });

    // Avant transfert : elle se trouve dans le terrain adverse
    let oppField = wrapper.find('[aria-label="Alliés adverses"]');
    let myField = wrapper.find('[aria-label="Vos alliés"]');
    expect(oppField.find(`[data-iid="${oppCardId}"]`).exists()).toBe(true);
    expect(myField.find(`[data-iid="${oppCardId}"]`).exists()).toBe(false);

    // L'adversaire transfère le contrôle de la carte à 'me'
    store.transferControl(oppCardId, me);
    await wrapper.vm.$nextTick();

    // Après transfert : elle doit se trouver dans le terrain du joueur 'me' (ma zone monde) !
    oppField = wrapper.find('[aria-label="Alliés adverses"]');
    myField = wrapper.find('[aria-label="Vos alliés"]');
    expect(oppField.find(`[data-iid="${oppCardId}"]`).exists()).toBe(false);
    expect(myField.find(`[data-iid="${oppCardId}"]`).exists()).toBe(true);

    // Et elle doit être draggable
    const cardComp = myField.findComponent({ name: "GameCard" });
    expect(cardComp.props("draggable")).toBe(true);
  });

  it("permet de déplacer la carte contrôlée entre le Havre-Sac et la zone Monde tout en restant dans l'espace du joueur", async () => {
    const store = useGameStore();
    store.startSandbox(createMockDeck(), createMockDeck());
    const me = store.perspective;
    const opp = me === "A" ? "B" : "A";

    const oppCardId = store.state.seats[opp].pioche[0];
    store.moveTo(oppCardId, { zone: "monde" });
    store.transferControl(oppCardId, me);

    const wrapper = mount(GameBoard, {
      global: { stubs: { CardZoomModal: true } },
    });

    // 1. Déplacer vers le Havre-Sac du joueur
    store.moveTo(oppCardId, { zone: "havreSac", owner: me });
    await wrapper.vm.$nextTick();

    let insideField = wrapper.find('[aria-label="Intérieur du Havre-Sac"]');
    let myField = wrapper.find('[aria-label="Vos alliés"]');
    expect(insideField.find(`[data-iid="${oppCardId}"]`).exists()).toBe(true);
    expect(myField.find(`[data-iid="${oppCardId}"]`).exists()).toBe(false);

    // 2. Déplacer à nouveau vers le Monde
    store.moveTo(oppCardId, { zone: "monde" });
    await wrapper.vm.$nextTick();

    insideField = wrapper.find('[aria-label="Intérieur du Havre-Sac"]');
    myField = wrapper.find('[aria-label="Vos alliés"]');
    const oppField = wrapper.find('[aria-label="Alliés adverses"]');

    expect(insideField.find(`[data-iid="${oppCardId}"]`).exists()).toBe(false);
    expect(myField.find(`[data-iid="${oppCardId}"]`).exists()).toBe(true);
    expect(oppField.find(`[data-iid="${oppCardId}"]`).exists()).toBe(false);
  });
});
