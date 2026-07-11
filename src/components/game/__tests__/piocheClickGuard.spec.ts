/**
 * Bug rapporté 2026-07-10 : « quand je clique sur la pioche je pioche, c'est
 * pas normal dans ce module ». En RÈGLES ASSISTÉES, la pioche est AUTOMATIQUE
 * (fin de tour : main complétée jusqu'aux PA ; effets « Piochez … » résolus
 * seuls) — le clic sur la pile ne doit PAS piocher (façon MTGA), il explique
 * via l'assistant (ruleError). En mode MANUEL, le clic-pioche reste actif.
 */
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import GameBoard from "@/components/game/GameBoard.vue";
import { makeEffectSandbox } from "@/stores/__tests__/effectPipeline.harness";

async function clickMyPioche(assist: boolean) {
  const { store } = makeEffectSandbox({ first: "A", allAllies: true });
  store.assistEffects = assist;
  const wrapper = mount(GameBoard, { attachTo: document.body });
  const handBefore = store.state.seats.A.main.length;
  // MA Pioche = celle du siège du bas (dernière dans le DOM).
  const piles = wrapper
    .findAll("button.gpile")
    .filter((b) => (b.attributes("aria-label") ?? "").startsWith("Pioche"));
  const clicked = piles[piles.length - 1].trigger("click");
  // Lire AVANT le flush : le watcher de GameBoard CONSOMME ruleError (announce
  // → assistant de règles → clearRuleError) dès le tick suivant.
  const err = store.ruleError;
  await clicked;
  const drew = store.state.seats.A.main.length - handBefore;
  wrapper.unmount();
  return { drew, err };
}

describe("GameBoard — clic sur la Pioche", () => {
  it("règles assistées : ne pioche PAS, explique via l'assistant", async () => {
    const { drew, err } = await clickMyPioche(true);
    expect(drew).toBe(0);
    expect(err).toMatch(/pioche est automatique/i);
  });

  it("mode manuel : le clic pioche une carte (affordance table libre)", async () => {
    const { drew } = await clickMyPioche(false);
    expect(drew).toBe(1);
  });
});
