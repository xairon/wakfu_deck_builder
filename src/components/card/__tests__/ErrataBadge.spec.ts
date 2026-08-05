import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";

// État mutable partagé par le mock — déclaré via vi.hoisted pour survivre au
// hoisting de vi.mock (sinon TDZ : le factory s'exécute avant l'affectation
// normale des `let`/`const` du fichier).
const state = vi.hoisted(() => ({ cacheReady: false }));

vi.mock("@/services/errataService", () => ({
  hasErrata: (id: string) => state.cacheReady && id === "opee-tissoin-incarnam",
  // Simule le chargement asynchrone réel : preloadErrata() ne résout
  // qu'après un micro-tick, et c'est LUI qui peuple le cache.
  preloadErrata: () =>
    Promise.resolve().then(() => {
      state.cacheReady = true;
    }),
}));

import ErrataBadge from "@/components/card/ErrataBadge.vue";

describe("ErrataBadge", () => {
  it("devrait s'afficher sur une carte erratée (index déjà chargé)", async () => {
    state.cacheReady = true;
    const w = mount(ErrataBadge, {
      props: { cardId: "opee-tissoin-incarnam" },
    });
    await flushPromises();
    expect(w.text()).toContain("Erraté");
  });

  it("devrait rester invisible sur une carte sans errata", async () => {
    state.cacheReady = true;
    const w = mount(ErrataBadge, { props: { cardId: "bouftou-incarnam" } });
    await flushPromises();
    expect(w.text()).toBe("");
  });

  it("devrait porter un title accessible", async () => {
    state.cacheReady = true;
    const w = mount(ErrataBadge, {
      props: { cardId: "opee-tissoin-incarnam" },
    });
    await flushPromises();
    expect(w.find("[title]").attributes("title")).toContain("errata");
  });

  it("devrait apparaître après coup si l'index se charge APRÈS le montage du badge (réactivité)", async () => {
    // Au montage, l'index n'est pas encore chargé (comme au premier rendu de
    // la grille, avant que la promesse de preloadErrata() ne se résolve).
    state.cacheReady = false;
    const w = mount(ErrataBadge, {
      props: { cardId: "opee-tissoin-incarnam" },
    });
    expect(w.text()).toBe("");

    // Le chargement se termine (onMounted attend preloadErrata()).
    await flushPromises();

    expect(w.text()).toContain("Erraté");
  });
});
