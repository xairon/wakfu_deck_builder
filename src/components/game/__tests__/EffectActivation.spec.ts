import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { useGameStore } from "@/stores/gameStore";
import EffectActivationBanner from "@/components/game/EffectActivationBanner.vue";
import { createMockDeck } from "tests/factories/card";

describe("EffectActivation & Journal isolation", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("devrait déclencher une bannière d'activation et émettre un événement SAID avec kind activate_effect", () => {
    const store = useGameStore();
    const deck = createMockDeck();
    store.startSandbox(deck, deck, "A");

    // Trouver une instance sur le plateau ou dans le deck
    const instId = Object.keys(store.state.instances)[0];
    expect(instId).toBeDefined();

    const ok = store.activateCardEffect(instId);
    expect(ok).toBe(true);

    // Vérifier l'état de la bannière
    expect(store.activeActivationBanner).not.toBeNull();
    expect(store.activeActivationBanner?.instanceId).toBe(instId);
    expect(store.activatedCardInstanceId).toBe(instId);

    // Vérifier l'événement émis
    const lastEvent = store.events[store.events.length - 1];
    expect(lastEvent.type).toBe("SAID");
    expect((lastEvent.payload as any)?.kind).toBe("activate_effect");

    // Le journal store.log doit contenir la ligne d'activation
    const lastLog = store.log[store.log.length - 1];
    expect(lastLog.text).toContain("⚡ active l'effet de");
  });

  it("devrait afficher le composant EffectActivationBanner et le fermer au clic sur le bouton", async () => {
    const store = useGameStore();
    const deck = createMockDeck();
    store.startSandbox(deck, deck, "A");
    const instId = Object.keys(store.state.instances)[0];

    const wrapper = mount(EffectActivationBanner, {
      global: {
        stubs: {
          Teleport: true,
        },
      },
    });

    // Au départ, pas de bannière
    expect(wrapper.find("[data-testid='effect-activation-banner']").exists()).toBe(false);

    // Déclenchement de l'effet
    store.activateCardEffect(instId);
    await wrapper.vm.$nextTick();

    // La bannière est maintenant affichée
    const bannerEl = wrapper.find("[data-testid='effect-activation-banner']");
    expect(bannerEl.exists()).toBe(true);
    expect(bannerEl.text()).toContain("EFFET ACTIVÉ");

    // Fermeture via store.dismissActivationBanner()
    store.dismissActivationBanner();
    await wrapper.vm.$nextTick();
    expect(wrapper.find("[data-testid='effect-activation-banner']").exists()).toBe(false);
  });

  it("devrait afficher un message d'action requise pour l'adversaire avec bouton Compris/Résolu", async () => {
    const store = useGameStore();
    const deck = createMockDeck();
    store.startSandbox(deck, deck, "A");
    store.perspective = "B"; // Nous sommes joueur B

    // Simulation de l'événement reçu de joueur A
    const nextSeq = store.events.length ? store.events[store.events.length - 1].seq + 1 : 1;
    store.applyServerEvent({
      gameId: "g1",
      seq: nextSeq,
      parentSeq: nextSeq - 1,
      actor: "A",
      type: "SAID",
      payload: {
        text: "⚡ active l'effet de Goultard",
        kind: "activate_effect",
        instanceId: "inst_123",
        cardId: "c_goultard",
        cardName: "Goultard",
        effectText: "Inflige 3 blessures à une cible.",
      },
      ts: Date.now(),
    });

    expect(store.activeActivationBanner).not.toBeNull();
    expect(store.activeActivationBanner?.isSelf).toBe(false);
    expect(store.activeActivationBanner?.cardName).toBe("Goultard");

    const wrapper = mount(EffectActivationBanner, {
      global: {
        stubs: {
          Teleport: true,
        },
      },
    });
    await wrapper.vm.$nextTick();

    const bannerEl = wrapper.find("[data-testid='effect-activation-banner']");
    expect(bannerEl.exists()).toBe(true);
    expect(bannerEl.text()).toContain("EFFET ACTIVÉ PAR L'ADVERSAIRE");
    expect(bannerEl.text()).toContain("Action requise");

    const confirmBtn = wrapper.find("[data-testid='activation-confirm-btn']");
    expect(confirmBtn.exists()).toBe(true);
    expect(confirmBtn.text()).toContain("Compris / Résolu");

    await confirmBtn.trigger("click");
    expect(store.activeActivationBanner).toBeNull();
  });

  it("devrait afficher les actions de recherche et de mélange uniquement dans le journal", () => {
    const store = useGameStore();
    const deck = createMockDeck();
    store.startSandbox(deck, deck, "A");

    // Recherche de pioche
    store.searchMyDeck();
    const lookEvent = store.events.find((e) => e.type === "LOOK");
    expect(lookEvent).toBeDefined();

    // Mélange de pioche
    store.shuffleMyDeck();
    const shuffleEvent = store.events.find((e) => e.type === "SHUFFLE");
    expect(shuffleEvent).toBeDefined();

    // Vérifier que le journal (store.log) contient les descriptions natives
    const logTexts = store.log.map((l) => l.text);
    expect(logTexts.some((t) => t.includes("cherche dans sa Pioche"))).toBe(true);
    expect(logTexts.some((t) => t.includes("mélange sa Pioche"))).toBe(true);

    // Vérifier qu'aucun événement SAID parasite n'a été émis pour le look et shuffle
    const saidEvents = store.events.filter((e) => e.type === "SAID");
    expect(saidEvents.some((e) => (e.payload as any)?.text?.includes("cherche dans sa Pioche"))).toBe(false);
    expect(saidEvents.some((e) => (e.payload as any)?.text?.includes("mélange sa Pioche"))).toBe(false);
  });
});
