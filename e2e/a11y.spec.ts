import { test, expect } from "@playwright/test";

// Audit d'accessibilité automatisé (P3.3) via @axe-core/playwright.
//
// La dépendance est OPTIONNELLE : si elle n'est pas installée, ces tests se
// SKIPPENT proprement (ils ne cassent jamais la suite ni la CI). Pour les
// activer :
//
//   npm install -D @axe-core/playwright
//
// L'import est résolu à l'exécution via un specifier construit dynamiquement
// pour qu'esbuild/Playwright ne tente pas de le résoudre au transform.
async function loadAxe(): Promise<any | null> {
  const spec = ["@axe-core", "playwright"].join("/");
  try {
    const mod: any = await import(/* @vite-ignore */ spec);
    return mod.default ?? mod.AxeBuilder ?? null;
  } catch {
    return null;
  }
}

// Jeu de règles ciblé, à fort impact et stable : on EXCLUT `color-contrast`
// (le thème néon sombre est un choix volontaire — cf. mémoire projet) et on se
// concentre sur des manquements concrets (noms accessibles, alternatives
// textuelles, labels, langue/titre du document, attributs ARIA valides).
const RULES = [
  "image-alt",
  "button-name",
  "link-name",
  "label",
  "document-title",
  "html-has-lang",
  "html-lang-valid",
  "aria-required-attr",
  "aria-valid-attr-value",
  "aria-roles",
  "duplicate-id-active",
  "meta-viewport",
];

// Pages publiques (aucune auth requise) couvrant l'accueil, le catalogue, la
// vitrine de decks et la table de jeu.
const PAGES = ["/", "/collection", "/decks/official", "/play/table"];

for (const path of PAGES) {
  test(`a11y (axe) : ${path}`, async ({ page }) => {
    const AxeBuilder = await loadAxe();
    test.skip(
      !AxeBuilder,
      "@axe-core/playwright non installé (npm install -D @axe-core/playwright)",
    );

    await page.goto(path);
    // Le contenu principal est rendu (pas l'overlay « Configuration requise »).
    await expect(page.locator("#main-content")).toBeVisible();

    const results = await new AxeBuilder({ page }).withRules(RULES).analyze();

    // Message lisible en cas d'échec : liste des règles violées.
    const summary = results.violations
      .map((v: any) => `${v.id} (${v.nodes.length})`)
      .join(", ");
    expect(results.violations, `Violations a11y : ${summary}`).toEqual([]);
  });
}
