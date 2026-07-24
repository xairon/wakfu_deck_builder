import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";

// Fichier séparé du spec principal : ce scénario a besoin d'un mock DISTINCT
// (loadRules/getRules renvoyant []) — vi.mock est figé par fichier de test,
// donc un seul et même vi.mock ne peut pas servir les deux jeux de données.
vi.mock("@/services/rulesService", () => ({
  loadRules: () => Promise.resolve([]),
  getRules: () => [],
}));

import RulesOfficialView from "@/views/RulesOfficialView.vue";

describe("RulesOfficialView (dégradé)", () => {
  it("devrait afficher un message de dégradation quand aucune règle n'est chargée", async () => {
    const w = mount(RulesOfficialView);
    await w.vm.$nextTick();
    await w.vm.$nextTick();
    expect(w.text()).toContain(
      "Règles indisponibles — vérifiez votre connexion.",
    );
  });

  it("ne devrait pas afficher le sommaire quand il n'y a aucun chapitre", async () => {
    const w = mount(RulesOfficialView);
    await w.vm.$nextTick();
    await w.vm.$nextTick();
    expect(w.find('nav[aria-label="Sommaire"]').exists()).toBe(false);
  });
});
