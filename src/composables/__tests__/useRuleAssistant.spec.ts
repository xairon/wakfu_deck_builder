import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { defineComponent, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { useRuleAssistant, type AssistantHint } from "../useRuleAssistant";
import { useGameStore } from "@/stores/gameStore";
import { createMockDeck } from "tests/factories/card";

// Harnais : monte un composant qui expose l'indice (contexte de composant réel,
// pour que watch/onUnmounted s'exécutent normalement).
const Harness = defineComponent({
  setup() {
    return useRuleAssistant();
  },
  template: "<div/>",
});

function hintOf(w: ReturnType<typeof mount>): AssistantHint | null {
  return (w.vm as unknown as { hint: AssistantHint | null }).hint;
}

describe("useRuleAssistant", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("en jeu, à ton tour → pas d'indication textuelle passive", () => {
    const store = useGameStore();
    const deck = createMockDeck();
    store.startSandbox(deck, deck, "A"); // matchPhase playing, perspective A, local
    store.nextTurn();
    store.nextTurn();
    const w = mount(Harness);
    expect(hintOf(w)).toBeNull();
  });

  it("au PREMIER tour → pas d'indication textuelle passive", () => {
    const store = useGameStore();
    const deck = createMockDeck();
    store.startSandbox(deck, deck, "A");
    const w = mount(Harness);
    expect(hintOf(w)).toBeNull();
  });

  it("phase mulligan → pas d'indication textuelle passive", () => {
    const store = useGameStore();
    const deck = createMockDeck();
    store.startMatch(deck, deck, { first: "A" });
    const w = mount(Harness);
    expect(hintOf(w)).toBeNull();
  });

  it("un refus de coup devient un indice WARN avec référence de règle", async () => {
    const store = useGameStore();
    const deck = createMockDeck();
    store.startSandbox(deck, deck, "A");
    const w = mount(Harness);
    (store as unknown as { ruleError: string | null }).ruleError =
      "Ce n'est pas votre tour.";
    await nextTick();
    const h = hintOf(w);
    expect(h?.tone).toBe("warn");
    expect(h?.text).toContain("tour");
    expect(h?.rule?.ref).toBe("Tour");
  });

  it("étape GÉANT du combat → indice de répartition (6135), pas l'indice générique", async () => {
    // Audit UX 2026-07 : à l'étape « geant », le coach affichait « Déclare les
    // blocages, puis résous le combat » (périmé — les blocages sont déjà
    // déclarés, on répartit la Force du Géant).
    const store = useGameStore();
    const deck = createMockDeck();
    store.startSandbox(deck, deck, "A");
    (store as unknown as { combat: Record<string, unknown> | null }).combat = {
      step: "geant",
      target: null,
      attackers: [],
      blocks: {},
      strikes: {},
      geantAssign: {},
      geantFor: null,
      geantConfirmed: [],
      ripostes: {},
      riposteFrom: null,
      riposteCandidates: [],
      pendingBlocker: null,
      reactingSeat: null,
    };
    await nextTick();
    const h = hintOf(mount(Harness));
    expect(h?.tone).toBe("action");
    expect(h?.text).toContain("Répartis");
    expect(h?.rule?.ref).toBe("6135");
  });

  it("dismiss efface le refus affiché", async () => {
    const store = useGameStore();
    const deck = createMockDeck();
    store.startSandbox(deck, deck, "A");
    store.nextTurn();
    store.nextTurn(); // hors 1er tour → repli sur l'indice d'action après dismiss
    const w = mount(Harness);
    (store as unknown as { ruleError: string | null }).ruleError =
      "Le Havre-Sac est plein (Taille atteinte).";
    await nextTick();
    expect(hintOf(w)?.tone).toBe("warn");
    expect(hintOf(w)?.rule?.ref).toBe("2626");
    (w.vm as unknown as { dismiss: () => void }).dismiss();
    await nextTick();
    // Plus de refus → l'assistant se ferme (null).
    expect(hintOf(w)).toBeNull();
  });
});
