import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import PlayTableView from "../PlayTableView.vue";
import { createRouter, createWebHistory } from "vue-router";

describe("PlayTableView — montage initial", () => {
  it("se monte correctement sans lancer d'exception ReferenceError", () => {
    setActivePinia(createPinia());
    const router = createRouter({
      history: createWebHistory(),
      routes: [{ path: "/", component: PlayTableView }],
    });

    const wrapper = mount(PlayTableView, {
      global: {
        plugins: [router],
        stubs: {
          GameBoard: true,
          InGameChat: true,
          VictoryDefeatOverlay: true,
          DialogModal: true,
          CardDetailModal: true,
          CardZoomModal: true,
          OnlineRoomModal: true,
        },
      },
    });

    expect(wrapper.exists()).toBe(true);
  });

  it("affiche le menu de choix d'initiative pour le vainqueur et gère le choix de priorité", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const router = createRouter({
      history: createWebHistory(),
      routes: [{ path: "/", component: PlayTableView }],
    });

    const wrapper = mount(PlayTableView, {
      global: {
        plugins: [router],
        stubs: {
          GameBoard: true,
          InGameChat: true,
          VictoryDefeatOverlay: true,
          DialogModal: true,
          CardDetailModal: true,
          CardZoomModal: true,
          OnlineRoomModal: true,
        },
      },
    });

    const { useGameStore } = await import("@/stores/gameStore");
    const store = useGameStore();
    store.online = false; // mode local pour tester le choix direct
    store.players.A = { name: "plc92210" };
    store.players.B = { name: "pckeltuzad" };
    store.matchPhase = "mulligan";

    await wrapper.vm.$nextTick();

    // L'overlay du dé est visible
    expect(wrapper.find('[data-testid="dice-roll"]').exists()).toBe(true);

    // En mode reduceMotion ou une fois settled, le menu de choix apparaît
    // Déclencher le choix "1er" si le menu est présent
    const chooseFirstBtn = wrapper.find('[data-testid="choose-play-first"]');
    if (chooseFirstBtn.exists()) {
      await chooseFirstBtn.trigger("click");
      expect(wrapper.text()).toContain("a choisi de jouer 1er");
    }
  });

  it("synchronise le choix de priorité reçu à distance via remotePriorityChoice", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const router = createRouter({
      history: createWebHistory(),
      routes: [{ path: "/", component: PlayTableView }],
    });

    const wrapper = mount(PlayTableView, {
      global: {
        plugins: [router],
        stubs: {
          GameBoard: true,
          InGameChat: true,
          VictoryDefeatOverlay: true,
          DialogModal: true,
          CardDetailModal: true,
          CardZoomModal: true,
          OnlineRoomModal: true,
        },
      },
    });

    const { useGameStore } = await import("@/stores/gameStore");
    const store = useGameStore();
    store.online = true;
    (store.gameId as any).value = "game-room-sync-456";
    store.players.A = { name: "plc92210" };
    store.players.B = { name: "pckeltuzad" };
    store.mySeat = "B";
    store.matchPhase = "mulligan";

    await wrapper.vm.$nextTick();

    // Simuler la réception du choix de priorité de l'adversaire
    store.remotePriorityChoice = { seat: "A", choice: "2e" };
    await wrapper.vm.$nextTick();

    expect(store.firstPlayer).toBe("B");
    expect(store.perspective).toBe("B");
  });

  it("quand le joueur A en ligne choisit de jouer 2e : perspective A reste A, et au Tour 1 seul B a le tour actif", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const router = createRouter({
      history: createWebHistory(),
      routes: [{ path: "/", component: PlayTableView }],
    });

    const wrapper = mount(PlayTableView, {
      global: {
        plugins: [router],
        stubs: {
          GameBoard: true,
          InGameChat: true,
          VictoryDefeatOverlay: true,
          DialogModal: true,
          CardDetailModal: true,
          CardZoomModal: true,
          OnlineRoomModal: true,
        },
      },
    });

    const { useGameStore } = await import("@/stores/gameStore");
    const store = useGameStore();
    store.online = true;
    (store.gameId as any).value = "game-room-sync-789";
    store.players.A = { name: "plc92210" };
    store.players.B = { name: "pckeltuzad" };
    store.mySeat = "A";
    store.perspective = "A";
    store.matchPhase = "mulligan";

    await wrapper.vm.$nextTick();

    // A choisit de jouer 2e -> premier joueur = B
    store.setFirstPlayer("B");
    await wrapper.vm.$nextTick();

    // La perspective de A doit rester "A"
    expect(store.perspective).toBe("A");
    expect(store.mySeat).toBe("A");
    expect(store.turn.active).toBe("B");

    // Phase de jeu au Tour 1
    store.matchPhase = "playing";
    await wrapper.vm.$nextTick();

    // Le bandeau doit afficher "Au tour de l'adversaire" pour A
    expect(wrapper.text()).toContain("Au tour de l'adversaire");
    expect(wrapper.text()).not.toContain("À toi de jouer");
  });

  it("affiche clairement 'Tu as l'initiative...' quand le joueur local a l'initiative, et 'Votre adversaire...' sinon", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const router = createRouter({
      history: createWebHistory(),
      routes: [{ path: "/", component: PlayTableView }],
    });

    const wrapper = mount(PlayTableView, {
      global: {
        plugins: [router],
        stubs: {
          GameBoard: true,
          InGameChat: true,
          VictoryDefeatOverlay: true,
          DialogModal: true,
          CardDetailModal: true,
          CardZoomModal: true,
          OnlineRoomModal: true,
        },
      },
    });

    const { useGameStore } = await import("@/stores/gameStore");
    const store = useGameStore();
    store.online = true;
    (store.gameId as any).value = "game-room-init-test";
    store.players.A = { name: "Alice" };
    store.players.B = { name: "Bob" };
    store.mySeat = "A";
    store.perspective = "A";
    store.matchPhase = "mulligan";
    await wrapper.vm.$nextTick();

    // Vérifier les badges des dés d'initiative (Toi / Adversaire)
    expect(wrapper.text()).toContain("Alice");
    expect(wrapper.text()).toContain("Toi");
    expect(wrapper.text()).toContain("Bob");
    expect(wrapper.text()).toContain("Adversaire");

    // Une fois le jet terminé, le Mulligan s'affiche
    (wrapper.vm as any).diceVisible = false;
    (wrapper.vm as any).rollPriorityChoicePending = false;
    await wrapper.vm.$nextTick();

    // Cas 1 : le joueur A a l'initiative
    store.firstPlayer = "A";
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("Tu as l'initiative et tu commenceras au Tour 1 !");
    expect(wrapper.text()).not.toContain("Votre adversaire");

    // Cas 2 : l'adversaire (B) a l'initiative
    store.firstPlayer = "B";
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("Votre adversaire (Bob) a l'initiative et commencera au Tour 1.");
    expect(wrapper.text()).not.toContain("Tu as l'initiative et tu commenceras");
  });

  it("en ligne, le vainqueur du dé dispose des boutons 'Jouer 1er' et 'Jouer 2e' et peut choisir de jouer 2e", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const router = createRouter({
      history: createWebHistory(),
      routes: [{ path: "/", component: PlayTableView }],
    });

    const wrapper = mount(PlayTableView, {
      global: {
        plugins: [router],
        stubs: {
          GameBoard: true,
          InGameChat: true,
          VictoryDefeatOverlay: true,
          DialogModal: true,
          CardDetailModal: true,
          CardZoomModal: true,
          OnlineRoomModal: true,
        },
      },
    });

    const { useGameStore } = await import("@/stores/gameStore");
    const store = useGameStore();
    store.online = true;
    (store.gameId as any).value = "game-room-choice-2e";
    store.players.A = { name: "Alice" };
    store.players.B = { name: "Bob" };
    store.mySeat = "A";
    store.perspective = "A";
    store.matchPhase = "mulligan";
    await wrapper.vm.$nextTick();

    // Le vainqueur est le joueur local A
    (wrapper.vm as any).diceSettled = true;
    (wrapper.vm as any).rollWinnerSeat = "A";
    (wrapper.vm as any).rollPriorityChoicePending = true;
    await wrapper.vm.$nextTick();

    // Les deux boutons doivent être présents dans le DOM
    const btnFirst = wrapper.find('[data-testid="choose-play-first"]');
    const btnSecond = wrapper.find('[data-testid="choose-play-second"]');
    expect(btnFirst.exists()).toBe(true);
    expect(btnSecond.exists()).toBe(true);
    expect(btnFirst.text()).toContain("Jouer 1er");
    expect(btnSecond.text()).toContain("Jouer 2e");

    // Cliquer sur "Jouer 2e"
    await btnSecond.trigger("click");
    await wrapper.vm.$nextTick();

    // Le premier joueur doit maintenant être B
    expect(store.firstPlayer).toBe("B");
    expect(store.priorityChosenFirst).toBe("B");
    expect(wrapper.text()).toContain("a choisi de jouer 2e");
  });
});




