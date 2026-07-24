import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";

const ROWS = [
  {
    number: "4",
    kind: "chapter",
    chapter: 4,
    title: "Concepts de Jeu",
    body: null,
    sort_order: 1,
  },
  {
    number: "418",
    kind: "section",
    chapter: 4,
    title: "Ressources et Coûts",
    body: null,
    sort_order: 2,
  },
  {
    number: "418.5b",
    kind: "rule",
    chapter: 4,
    title: null,
    body: "Pour payer le coût d'un Allié.",
    sort_order: 3,
  },
];

vi.mock("@/services/rulesService", () => ({
  loadRules: () => Promise.resolve(ROWS),
  getRules: () => ROWS,
}));

import RulesOfficialView from "@/views/RulesOfficialView.vue";

describe("RulesOfficialView", () => {
  it("devrait afficher les chapitres, sections et règles", async () => {
    const w = mount(RulesOfficialView);
    await w.vm.$nextTick();
    expect(w.text()).toContain("Concepts de Jeu");
    expect(w.text()).toContain("Ressources et Coûts");
    expect(w.text()).toContain("Pour payer le coût d'un Allié.");
  });

  it("devrait ancrer chaque règle par son numéro (deep-link)", async () => {
    const w = mount(RulesOfficialView);
    await w.vm.$nextTick();
    // Sélecteur d'ATTRIBUT plutôt que sélecteur d'ID : un sélecteur d'ID CSS
    // n'accepte pas un point non échappé ("#418.5b" est invalide), et sous
    // jsdom/nwsapi un id commençant par un chiffre doit AUSSI être échappé en
    // hexadécimal ("#\34 18\.5b") pour être un sélecteur d'ID valide — un
    // simple `#418\.5b` lève encore une SyntaxError ici. `[id="…"]` évite
    // tout ce piège et cible directement et sans ambiguïté l'ancre exacte.
    expect(w.find('[id="418.5b"]').exists()).toBe(true);
    // Preuve que l'ancre est bien PORTÉE PAR CE numéro précis (et pas par un
    // id générique) : les deux autres numéros ont aussi leur propre ancre.
    expect(w.find('[id="4"]').exists()).toBe(true);
    expect(w.find('[id="418"]').exists()).toBe(true);
  });

  it("devrait filtrer par recherche plein-texte", async () => {
    const w = mount(RulesOfficialView);
    await w.vm.$nextTick();
    await w.find('input[type="search"]').setValue("Ressources");
    expect(w.text()).toContain("Ressources et Coûts");
    expect(w.text()).not.toContain("Pour payer le coût d'un Allié.");
    // La recherche ne doit pas non plus laisser passer un chapitre non
    // pertinent : preuve que le filtrage retire réellement des lignes, et pas
    // seulement qu'il conserve la ligne attendue.
    expect(w.text()).not.toContain("Concepts de Jeu");
  });

  it("devrait afficher l'attribution de la source", async () => {
    const w = mount(RulesOfficialView);
    await w.vm.$nextTick();
    expect(w.text()).toContain("wtcg-return.fr");
    const link = w.find(
      'a[href="https://www.wtcg-return.fr/regles/completes"]',
    );
    expect(link.exists()).toBe(true);
  });

  it("devrait afficher un sommaire des chapitres avec ancres", async () => {
    const w = mount(RulesOfficialView);
    await w.vm.$nextTick();
    const nav = w.find('nav[aria-label="Sommaire"]');
    expect(nav.exists()).toBe(true);
    expect(nav.find('a[href="#4"]').exists()).toBe(true);
  });

  it("devrait masquer le sommaire pendant une recherche", async () => {
    const w = mount(RulesOfficialView);
    await w.vm.$nextTick();
    await w.find('input[type="search"]').setValue("Ressources");
    expect(w.find('nav[aria-label="Sommaire"]').exists()).toBe(false);
  });
});
