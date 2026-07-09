import { mount, flushPromises } from "@vue/test-utils";
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

    // Le chemin clavier/clic passe par playFromHand (coût + légalité), comme le
    // DnD — la destination visée (Monde) est transmise (choix de zone 303.1).
    expect(playSpy).toHaveBeenCalledWith(handId, undefined, "monde");
  });

  it("« → Socle » joue la carte de la main vers le Havre-Sac (choix 303.1)", async () => {
    const store = useGameStore();
    store.startSandbox(createMockDeck(), createMockDeck());
    store.assist = true;
    const me = store.perspective;
    if (store.state.seats[me].main.length === 0) store.draw(me);
    const handId = store.state.seats[me].main[0];
    expect(handId).toBeTruthy();

    const playSpy = vi.spyOn(store, "playFromHand");

    const wrapper = mount(GameBoard, {
      global: { stubs: { CardZoomModal: true } },
    });

    await wrapper.get(`[data-testid="card-${handId}"]`).trigger("click");
    const socleBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("→ Socle"));
    expect(socleBtn).toBeTruthy();

    await socleBtn!.trigger("click");

    // Le bouton « → Socle » porte le choix de zone du contrôleur (Havre-Sac).
    expect(playSpy).toHaveBeenCalledWith(handId, undefined, "havreSac");
  });
});

describe("GameBoard — mouvement du Héros (414.1 / 508.x)", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("propose de sortir puis de rentrer le Héros quand il est sélectionné", async () => {
    const store = useGameStore();
    store.startSandbox(createMockDeck(), createMockDeck(), "B"); // B commence
    store.endTurn(); // → tour 2, actif/perspective A (sortie autorisée)
    const me = store.perspective;
    const heroId = store.state.seats[me].heroInstanceId!;
    expect(store.state.instances[heroId].location.zone).toBe("havreSac");

    const wrapper = mount(GameBoard, {
      global: { stubs: { CardZoomModal: true } },
    });
    // Sélectionner le Héros (intérieur du Havre-Sac) → bouton « Sortir ».
    await wrapper.get(`[data-testid="card-${heroId}"]`).trigger("click");
    const moveBtn = wrapper.find('[data-testid="action-move-hero"]');
    expect(moveBtn.exists()).toBe(true);
    expect(moveBtn.text()).toContain("Sortir dans le Monde");

    await moveBtn.trigger("click");
    expect(store.state.instances[heroId].location.zone).toBe("monde");

    // Le Héros exposé (dans le Monde) : re-sélection → bouton « Rentrer ».
    await wrapper.get(`[data-testid="card-${heroId}"]`).trigger("click");
    expect(wrapper.find('[data-testid="action-move-hero"]').text()).toContain(
      "Rentrer au Havre-Sac",
    );
  });

  it("désactive le bouton (motif) quand la sortie est illégale (1er tour)", async () => {
    const store = useGameStore();
    store.startSandbox(createMockDeck(), createMockDeck(), "A"); // A commence → tour 1
    const me = store.perspective;
    const heroId = store.state.seats[me].heroInstanceId!;

    const wrapper = mount(GameBoard, {
      global: { stubs: { CardZoomModal: true } },
    });
    await wrapper.get(`[data-testid="card-${heroId}"]`).trigger("click");
    const moveBtn = wrapper.find('[data-testid="action-move-hero"]');
    expect(moveBtn.exists()).toBe(true);
    expect((moveBtn.element as HTMLButtonElement).disabled).toBe(true);
    expect(moveBtn.attributes("title")).toContain("premier tour");
  });
});

describe("GameBoard — a11y clavier (barre d'action)", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("devrait déplacer le focus vers la barre d'action à la sélection", async () => {
    const store = useGameStore();
    store.startSandbox(createMockDeck(), createMockDeck());
    const wrapper = mount(GameBoard, {
      attachTo: document.body, // requis pour document.activeElement en jsdom
      global: { stubs: { CardZoomModal: true } },
    });

    await wrapper.find(".game-card").trigger("click");
    await flushPromises(); // le watcher focalise après un nextTick

    const firstBtn = wrapper.find(".gactionbar .gbtn").element as HTMLElement;
    expect(firstBtn).toBeTruthy();
    expect(document.activeElement).toBe(firstBtn);

    wrapper.unmount();
  });

  it("devrait refermer la barre d'action sur Échap", async () => {
    const store = useGameStore();
    store.startSandbox(createMockDeck(), createMockDeck());
    const wrapper = mount(GameBoard, {
      attachTo: document.body,
      global: { stubs: { CardZoomModal: true } },
    });

    await wrapper.find(".game-card").trigger("click");
    expect(wrapper.find(".gactionbar").exists()).toBe(true);

    await wrapper.find(".gactionbar").trigger("keydown", { key: "Escape" });
    expect(wrapper.find(".gactionbar").exists()).toBe(false);

    wrapper.unmount();
  });
});
