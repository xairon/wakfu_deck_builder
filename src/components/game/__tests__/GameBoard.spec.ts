import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { describe, it, expect, beforeEach, vi } from "vitest";
import GameBoard from "../GameBoard.vue";
import { useGameStore } from "@/stores/gameStore";
import { useCardStore } from "@/stores/cardStore";
import { createMockDeck, createMockHavreSacCard } from "tests/factories/card";

describe("GameBoard — rendu", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("se monte (plateau) et rend des cartes, sans erreur", () => {
    const store = useGameStore();
    store.startSandbox(createMockDeck(), createMockDeck());
    const wrapper = mount(GameBoard, {
      global: { stubs: { CardZoomModal: true } },
    });
    expect(wrapper.find(".gtable").exists()).toBe(true);
    expect(wrapper.find(".gmid").exists()).toBe(false);
    // Héros (×2) + Havre-Sac (×2) au minimum
    expect(wrapper.findAll(".game-card").length).toBeGreaterThanOrEqual(2);
  });

  it("sélectionner une carte ouvre la barre d'action sans bouton Activer", async () => {
    const store = useGameStore();
    store.startSandbox(createMockDeck(), createMockDeck());
    const wrapper = mount(GameBoard, {
      global: { stubs: { CardZoomModal: true } },
    });
    await wrapper.find(".game-card").trigger("click");
    expect(wrapper.find(".gactionbar").exists()).toBe(true);
    expect(wrapper.text()).not.toContain("Activer");
  });

  it("permet de modifier la résistance du Havre-Sac avec les boutons + et -", async () => {
    const store = useGameStore();
    const deck = createMockDeck({
      havreSac: createMockHavreSacCard({
        stats: { resistance: 15 } as any,
      }),
    });
    store.startSandbox(deck, deck);
    const me = store.perspective;
    const sacId = store.state.seats[me].havreSacInstanceId!;
    const initialRes = store.state.instances[sacId]?.counters.resistance ?? 15;

    const wrapper = mount(GameBoard, {
      global: { stubs: { CardZoomModal: true } },
    });

    const plusBtn = wrapper.find('[data-testid="havre-res-plus-me"]');
    expect(plusBtn.exists()).toBe(true);
    await plusBtn.trigger("click");
    expect(store.state.instances[sacId].counters.resistance).toBe(initialRes + 1);

    const minusBtn = wrapper.find('[data-testid="havre-res-minus-me"]');
    expect(minusBtn.exists()).toBe(true);
    await minusBtn.trigger("click");
    expect(store.state.instances[sacId].counters.resistance).toBe(initialRes);
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

describe("GameBoard — Level Up du Héros", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("devrait afficher le bouton Level Up quand un Héros est sélectionné et basculer son Niveau", async () => {
    const store = useGameStore();
    const deck = createMockDeck();
    store.startSandbox(deck, createMockDeck());
    const me = store.perspective;
    const heroId = store.state.seats[me].heroInstanceId!;

    const cardStore = useCardStore();
    if (deck.hero) cardStore.cards = [deck.hero];

    const wrapper = mount(GameBoard, {
      global: { stubs: { CardZoomModal: true } },
    });

    // Sélectionner le Héros → la barre d'action s'ouvre sans bouton action-levelup (géré par le HUD)
    await wrapper.get(`[data-testid="card-${heroId}"]`).trigger("click");
    const levelUpBtn = wrapper.find('[data-testid="action-levelup"]');
    expect(levelUpBtn.exists()).toBe(false);

    // Basculer au niveau 2 via le store
    store.toggleFlip(heroId);
    expect(store.state.instances[heroId].face).toBe("verso");
  });
});

describe("GameBoard — menu rouage & menu de deck (Mill)", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("ouvre le menu au survol du deck et permet d'exécuter l'action Mill", async () => {
    const store = useGameStore();
    store.startSandbox(createMockDeck(), createMockDeck());
    const me = store.perspective;
    const initialPioche = store.state.seats[me].pioche.length;
    const topCardId = store.state.seats[me].pioche[0];

    const wrapper = mount(GameBoard, {
      global: { stubs: { CardZoomModal: true } },
    });

    const moreBtn = wrapper.find('[data-testid="action-more-menu"]');
    expect(moreBtn.exists()).toBe(true);

    // Ouvre le menu au survol du deck
    const deckSlot = wrapper.find(".gpiles__slot--deck");
    expect(deckSlot.exists()).toBe(true);
    await deckSlot.trigger("mouseenter");
    const millBtn = wrapper.find('[data-testid="action-mill"]');
    expect(millBtn.exists()).toBe(true);

    // Exécute l'action Mill
    await millBtn.trigger("click");
    expect(store.state.seats[me].pioche.length).toBe(initialPioche - 1);
    expect(store.state.seats[me].defausse).toContain(topCardId);
  });

  it("affiche bien la dernière carte défaussée au-dessus de la pile de défausse", async () => {
    const store = useGameStore();
    store.startSandbox(createMockDeck(), createMockDeck());
    const me = store.perspective;

    const card1 = store.state.seats[me].main[0];
    const card2 = store.state.seats[me].main[1];

    store.moveTo(card1, { zone: "defausse", owner: me });
    expect(store.state.seats[me].defausse[0]).toBe(card1);

    store.moveTo(card2, { zone: "defausse", owner: me });
    expect(store.state.seats[me].defausse[0]).toBe(card2);

    const wrapper = mount(GameBoard, {
      global: { stubs: { CardZoomModal: true } },
    });

    const discardSlots = wrapper.findAll(".gpile--discard");
    expect(discardSlots.length).toBeGreaterThan(0);
  });

  it("permet d'ouvrir la défausse et de bannir une carte vers la zone d'exil", async () => {
    const store = useGameStore();
    store.startSandbox(createMockDeck(), createMockDeck());
    const me = store.perspective;

    // Déplacer une carte vers la défausse
    const cardId = store.state.seats[me].pioche[0];
    store.moveTo(cardId, { zone: "defausse", owner: me });
    expect(store.state.seats[me].defausse).toContain(cardId);
    expect(store.state.seats[me].exil).not.toContain(cardId);

    const wrapper = mount(GameBoard, {
      global: { stubs: { CardZoomModal: true } },
    });

    // Clic sur la pile de défausse non-vide pour ouvrir le browser de défausse
    const discardPile = wrapper
      .findAllComponents({ name: "PileStack" })
      .find((c) => c.props("label") === "Défausse" && c.props("count") > 0);
    expect(discardPile).toBeDefined();
    await discardPile!.trigger("click");
    await flushPromises();

    const browser = wrapper.find('[data-testid="pile-browser"]');
    expect(browser.exists()).toBe(true);

    // Bouton de bannissement pour la carte
    const banishBtn = wrapper.find(`[data-testid="pile-banish-${cardId}"]`);
    expect(banishBtn.exists()).toBe(true);
    expect(banishBtn.text()).toContain("Bannir");

    // Clic sur Bannir
    await banishBtn.trigger("click");
    await flushPromises();

    // La carte doit être dans l'exil et plus dans la défausse
    expect(store.state.seats[me].exil).toContain(cardId);
    expect(store.state.seats[me].defausse).not.toContain(cardId);
  });

  it("permet de bannir une carte depuis la défausse adverse vers l'exil adverse", async () => {
    const store = useGameStore();
    store.startSandbox(createMockDeck(), createMockDeck());
    const opp = store.perspective === "A" ? "B" : "A";

    const oppCardId = store.state.seats[opp].pioche[0];
    store.moveTo(oppCardId, { zone: "defausse", owner: opp });
    expect(store.state.seats[opp].defausse).toContain(oppCardId);
    expect(store.state.seats[opp].exil).not.toContain(oppCardId);

    const wrapper = mount(GameBoard, {
      global: { stubs: { CardZoomModal: true } },
    });

    // Trouver et cliquer sur la défausse de l'adversaire (non vide)
    const oppDiscardPile = wrapper
      .findAllComponents({ name: "PileStack" })
      .find((c) => c.props("label") === "Défausse" && c.props("count") > 0);
    expect(oppDiscardPile).toBeDefined();
    await oppDiscardPile!.trigger("click");
    await flushPromises();

    const banishBtn = wrapper.find(`[data-testid="pile-banish-${oppCardId}"]`);
    expect(banishBtn.exists()).toBe(true);

    // Les boutons de récupération vers la main du joueur courant ne doivent pas s'afficher pour l'adversaire
    const recoverMainBtn = wrapper.find(
      `[data-testid="pile-recover-main-${oppCardId}"]`,
    );
    expect(recoverMainBtn.exists()).toBe(false);

    await banishBtn.trigger("click");
    await flushPromises();

    expect(store.state.seats[opp].exil).toContain(oppCardId);
    expect(store.state.seats[opp].defausse).not.toContain(oppCardId);
  });
});

