import { describe, it, expect } from "vitest";
import { parseRules } from "../scrapeRules";

const HTML = `
<h2>4. Concepts de Jeu</h2>
<h3>418. Ressources et Coûts</h3>
<p>418.1 Une ressource est une unité d'énergie magique.</p>
<p>418.5 Pour payer un coût en ressources, le joueur doit dépenser.</p>
<p>418.5a Un coût en ressources d'Elément Neutre peut être payé.</p>
<p>418.5b Pour payer le coût de lancement d'un Allié, le joueur doit.</p>
`;

describe("parseRules", () => {
  it("devrait extraire le chapitre, la section et les règles numérotées", () => {
    const rows = parseRules(HTML);
    const numbers = rows.map((r) => r.number);
    expect(numbers).toEqual(["4", "418", "418.1", "418.5", "418.5a", "418.5b"]);
  });

  it("devrait typer chaque ligne (chapter / section / rule)", () => {
    const rows = parseRules(HTML);
    expect(rows.find((r) => r.number === "4")?.kind).toBe("chapter");
    expect(rows.find((r) => r.number === "418")?.kind).toBe("section");
    expect(rows.find((r) => r.number === "418.5b")?.kind).toBe("rule");
  });

  it("devrait rattacher chaque ligne à son chapitre", () => {
    const rows = parseRules(HTML);
    expect(rows.every((r) => r.chapter === 4)).toBe(true);
  });

  it("devrait conserver le titre des sections et le corps des règles", () => {
    const rows = parseRules(HTML);
    expect(rows.find((r) => r.number === "418")?.title).toBe(
      "Ressources et Coûts",
    );
    expect(rows.find((r) => r.number === "418.1")?.body).toContain(
      "unité d'énergie",
    );
  });

  it("devrait numéroter sort_order dans l'ordre de lecture", () => {
    const rows = parseRules(HTML);
    const orders = rows.map((r) => r.sort_order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(new Set(orders).size).toBe(orders.length);
  });
});

// Markup structurel réel (wtcg-return.fr) : les règles lettrées sont des
// `div.regle-target[id]` IMBRIQUÉES dans le `div.regle-target[id]` de leur
// parent (pas des soeurs). Reproduit ici le fragment réel de la règle 418.5
// (id="418.5" contenant id="418.5a" et id="418.5b" en enfants), avec le
// bloc numéro (.flex-shrink-regle) et un bloc "Exemple :" (.ps-5) sur 418.5b
// pour vérifier qu'ils restent bien exclus du corps.
const NESTED_HTML = `
<h2>4. Concepts de Jeu</h2>
<h3>418. Ressources et Coûts</h3>
<div id="418.5" class="regle-target">
  <div class="d-md-flex">
    <div class="flex-shrink-regle"><strong class="text-muted">418.5.</strong></div>
    <div class="flex-fill ms-2">
      <p>Pour payer un coût en ressources, le joueur doit dépenser un nombre de ressources égal au coût, en respectant les procédures suivantes :</p>
    </div>
  </div>
  <div id="418.5a" class="regle-target ps-4">
    <div class="d-md-flex">
      <div class="flex-shrink-regle"><strong class="text-muted">418.5a.</strong></div>
      <div class="flex-fill ms-2">
        <p>Un coût en ressources d'Elément Neutre peut être payé avec des ressources de n'importe quel Elément.</p>
      </div>
    </div>
  </div>
  <div id="418.5b" class="regle-target ps-4">
    <div class="d-md-flex">
      <div class="flex-shrink-regle"><strong class="text-muted">418.5b.</strong></div>
      <div class="flex-fill ms-2">
        <p>Pour payer le coût de lancement d'un Allié, le joueur doit obligatoirement dépenser au moins une ressource de l'Élément de la carte Allié en train d'être jouée.</p>
      </div>
    </div>
    <div class="ps-5">
      <div><strong class="text-muted">Exemple :</strong></div>
      <div><p class="ps-3">Pour jouer un Corailleur, Allié de Niveau 4 Eau, on doit incliner quatre cartes dont au moins une d'Élément Eau.</p></div>
    </div>
  </div>
</div>
`;

describe("parseRules — markup imbriqué (règles lettrées en enfants DOM)", () => {
  it("ne doit PAS absorber le texte des sous-règles imbriquées dans le corps du parent", () => {
    const rows = parseRules(NESTED_HTML);
    const parent = rows.find((r) => r.number === "418.5");
    expect(parent).toBeDefined();
    expect(parent?.body).toContain("Pour payer un coût en ressources");
    // Le bug : le clone du parent contenait aussi le texte de 418.5a/418.5b.
    expect(parent?.body).not.toContain("Elément Neutre peut être payé");
    expect(parent?.body).not.toContain("coût de lancement d'un Allié");
    expect(parent?.body).not.toContain("Exemple");
    expect(parent?.body).not.toContain("Corailleur");
  });

  it("doit conserver chaque sous-règle imbriquée comme sa propre ligne, avec son propre corps", () => {
    const rows = parseRules(NESTED_HTML);
    const a = rows.find((r) => r.number === "418.5a");
    const b = rows.find((r) => r.number === "418.5b");
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a?.body).toContain("Elément Neutre peut être payé");
    expect(b?.body).toContain("coût de lancement d'un Allié");
    // 418.5b ne doit pas non plus absorber son propre bloc "Exemple :".
    expect(b?.body).not.toContain("Exemple");
    expect(b?.body).not.toContain("Corailleur");
  });

  it("ne doit produire que 3 lignes de type rule pour 418.5/418.5a/418.5b (pas de doublon)", () => {
    const rows = parseRules(NESTED_HTML);
    const numbers = rows.filter((r) => r.kind === "rule").map((r) => r.number);
    expect(numbers).toEqual(["418.5", "418.5a", "418.5b"]);
  });
});
