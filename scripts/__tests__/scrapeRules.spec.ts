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
