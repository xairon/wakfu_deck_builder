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

  it("en jeu, à ton tour → indice d'ACTION", () => {
    const store = useGameStore();
    const deck = createMockDeck();
    store.startSandbox(deck, deck, "A"); // matchPhase playing, perspective A, local
    const w = mount(Harness);
    const h = hintOf(w);
    expect(h?.tone).toBe("action");
    expect(h?.text).toContain("À toi");
  });

  it("phase mulligan → indice INFO (tirage au sort annoncé après)", () => {
    const store = useGameStore();
    const deck = createMockDeck();
    store.startMatch(deck, deck, { first: "A" }); // matchPhase mulligan
    const w = mount(Harness);
    expect(hintOf(w)?.tone).toBe("info");
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

  it("dismiss efface le refus affiché", async () => {
    const store = useGameStore();
    const deck = createMockDeck();
    store.startSandbox(deck, deck, "A");
    const w = mount(Harness);
    (store as unknown as { ruleError: string | null }).ruleError =
      "Le Havre-Sac est plein (Taille atteinte).";
    await nextTick();
    expect(hintOf(w)?.tone).toBe("warn");
    expect(hintOf(w)?.rule?.ref).toBe("2626");
    (w.vm as unknown as { dismiss: () => void }).dismiss();
    await nextTick();
    // Plus de refus → on retombe sur l'indice d'action « à ton tour ».
    expect(hintOf(w)?.tone).toBe("action");
  });
});
