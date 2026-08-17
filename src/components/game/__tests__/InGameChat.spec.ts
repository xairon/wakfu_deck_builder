import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import InGameChat from "@/components/game/InGameChat.vue";
import { useGameStore } from "@/stores/gameStore";

describe("InGameChat.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("devrait afficher le bouton d'ouverture du chat et garder la fenêtre fermée par défaut", () => {
    const wrapper = mount(InGameChat);

    const toggleBtn = wrapper.find('[data-testid="ingame-chat-toggle"]');
    expect(toggleBtn.exists()).toBe(true);

    const chatWindow = wrapper.find('[data-testid="ingame-chat-window"]');
    expect(chatWindow.isVisible()).toBe(false);
  });

  it("devrait basculer la visibilité de la fenêtre au clic sur le bouton toggle sans détruire les messages", async () => {
    const wrapper = mount(InGameChat);
    const toggleBtn = wrapper.find('[data-testid="ingame-chat-toggle"]');

    // Ouverture
    await toggleBtn.trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="ingame-chat-window"]').isVisible()).toBe(
      true,
    );

    // Saisie et envoi d'un message
    const input = wrapper.find('[data-testid="ingame-chat-input"]');
    await input.setValue("Message test retention");
    const form = wrapper.find(".chat-input-form");
    await form.trigger("submit.prevent");
    await wrapper.vm.$nextTick();
    await new Promise((r) => setTimeout(r, 50));

    // Fermeture via le bouton de fermeture ✕
    const closeBtn = wrapper.find('[data-testid="ingame-chat-close"]');
    await closeBtn.trigger("click");
    await wrapper.vm.$nextTick();

    const chatWindow = wrapper.find('[data-testid="ingame-chat-window"]');
    expect((chatWindow.element as HTMLElement).style.display).toBe("none");

    // Réouverture : la liste contient toujours le message
    await toggleBtn.trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="ingame-chat-window"]').isVisible()).toBe(
      true,
    );
    expect(wrapper.text()).toContain("Message test retention");
  });

  it("devrait afficher un badge de notification quand un nouveau message arrive alors que le chat est fermé", async () => {
    const wrapper = mount(InGameChat);
    const store = useGameStore();

    // S'assurer que le chat est fermé
    expect(wrapper.find('[data-testid="ingame-chat-window"]').isVisible()).toBe(
      false,
    );
    expect(
      wrapper.find('[data-testid="ingame-chat-unread-badge"]').exists(),
    ).toBe(false);

    // Simulation d'un événement SAID d'un autre joueur (adversaire)
    store.events = [
      {
        gameId: "g1",
        seq: 1,
        parentSeq: 0,
        actor: "B",
        type: "SAID",
        payload: { text: "Salut Joueur 1 !" },
        ts: Date.now(),
      },
    ];

    await wrapper.vm.$nextTick();

    // Le badge doit s'afficher avec le compte de 1
    const badge = wrapper.find('[data-testid="ingame-chat-unread-badge"]');
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toBe("1");

    // À l'ouverture du chat, le badge doit se réinitialiser et disparaître
    const toggleBtn = wrapper.find('[data-testid="ingame-chat-toggle"]');
    await toggleBtn.trigger("click");
    await wrapper.vm.$nextTick();

    expect(
      wrapper.find('[data-testid="ingame-chat-unread-badge"]').exists(),
    ).toBe(false);
  });

  it("devrait permettre d'envoyer un message via le champ de saisie et la touche Entrée", async () => {
    const wrapper = mount(InGameChat, {
      props: {
        localPlayerName: "Yugo",
      },
    });

    const toggleBtn = wrapper.find('[data-testid="ingame-chat-toggle"]');
    await toggleBtn.trigger("click");
    await wrapper.vm.$nextTick();

    const input = wrapper.find('[data-testid="ingame-chat-input"]');
    await input.setValue("Bien joué !");
    await input.trigger("keydown.enter");
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Bien joué !");
  });
});
