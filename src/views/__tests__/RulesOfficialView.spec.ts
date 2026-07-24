import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

// vi.fn() (et non de simples fonctions fléchées) : le comportement par
// défaut reste IDENTIQUE pour tous les tests existants (getRules/loadRules
// renvoient tous deux ROWS), mais ça permet au test de scroll async
// ci-dessous de surcharger `getRules` pour UN seul appel via
// `mockReturnValueOnce`, sans toucher au comportement des autres tests.
vi.mock("@/services/rulesService", () => ({
  loadRules: vi.fn(() => Promise.resolve(ROWS)),
  getRules: vi.fn(() => ROWS),
}));

import RulesOfficialView from "@/views/RulesOfficialView.vue";
import { getRules } from "@/services/rulesService";

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

  it("devrait rendre chapitre/section/règle à des niveaux de titre distincts (h2/h3/p)", async () => {
    const w = mount(RulesOfficialView);
    await w.vm.$nextTick();

    // Ligne "chapter" (numéro "4") : doit être un <h2>, ni <h3> ni <p>.
    const chapterRow = w.find('[id="4"]');
    expect(chapterRow.find("h2").exists()).toBe(true);
    expect(chapterRow.find("h3").exists()).toBe(false);
    expect(chapterRow.find("p").exists()).toBe(false);

    // Ligne "section" (numéro "418") : doit être un <h3>, ni <h2> ni <p>.
    const sectionRow = w.find('[id="418"]');
    expect(sectionRow.find("h3").exists()).toBe(true);
    expect(sectionRow.find("h2").exists()).toBe(false);
    expect(sectionRow.find("p").exists()).toBe(false);

    // Ligne "rule" (numéro "418.5b") : ni <h2> ni <h3>, doit être un <p>.
    const ruleRow = w.find('[id="418.5b"]');
    expect(ruleRow.find("h2").exists()).toBe(false);
    expect(ruleRow.find("h3").exists()).toBe(false);
    expect(ruleRow.find("p").exists()).toBe(true);
  });
});

describe("RulesOfficialView — deep-link scroll (chargement async)", () => {
  const originalHash = window.location.hash;

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    window.location.hash = originalHash;
    // @ts-expect-error -- nettoyage du stub posé sur le prototype (jsdom ne
    // fournit pas scrollIntoView nativement, cf. finding).
    delete Element.prototype.scrollIntoView;
  });

  it("devrait scroller vers l'ancre du hash une fois les règles chargées (async)", async () => {
    window.location.hash = "418.5b";
    // Cache synchrone VIDE pour CE seul appel : reproduit le cas réel visé
    // par le deep-link (premier chargement, rien encore en cache) — seul
    // `loadRules()` (async, toujours mocké sur ROWS) apporte l'ancre ciblée
    // par le hash. Si `getRules()` renvoyait déjà ROWS ici (comme pour les
    // autres tests de ce fichier), l'ancre existerait dès le montage, avant
    // même que `loadRules()` ne résolve, et ce test n'aurait plus aucune
    // prise sur l'ordonnancement async qu'il est censé vérifier.
    vi.mocked(getRules).mockReturnValueOnce([]);

    // attachTo: document.body est INDISPENSABLE ici — le composant appelle
    // `document.getElementById(hash)` sur le VRAI document ; un mount() par
    // défaut (détaché) rend les lignes dans un fragment hors du document, et
    // getElementById ne les trouve jamais (vérifié : sans attachTo, le test
    // échoue avec 0 appel car document.getElementById renvoie null).
    const w = mount(RulesOfficialView, { attachTo: document.body });
    // 1) laisse `rows.value = await loadRules()` se résoudre (comme les
    //    autres tests de ce fichier qui affichent déjà le contenu après un
    //    seul nextTick).
    await w.vm.$nextTick();
    // 2) le composant place ensuite son propre `setTimeout(..., 0)` avant de
    //    scroller : il faut laisser la macro-tâche s'exécuter (un nextTick,
    //    micro-tâche, ne suffit pas à traverser la frontière macro-tâche).
    await new Promise((resolve) => setTimeout(resolve, 0));
    await w.vm.$nextTick();

    const scrollMock = Element.prototype.scrollIntoView as ReturnType<
      typeof vi.fn
    >;
    expect(scrollMock).toHaveBeenCalledTimes(1);
    // Preuve que le scroll cible bien l'ANCRE DE CE numéro précis (et pas un
    // élément quelconque) : l'élément sur lequel scrollIntoView a été appelé
    // est celui dont l'id est "418.5b".
    const scrolledElement = scrollMock.mock.instances[0] as unknown as Element;
    expect(scrolledElement.id).toBe("418.5b");
  });
});
