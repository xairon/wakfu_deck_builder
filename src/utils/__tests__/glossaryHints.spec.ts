import { describe, it, expect } from "vitest";
import { glossaryHints } from "../glossaryHints";

describe("glossaryHints — surfacer les définitions de glossaire utiles", () => {
  it("surfacer « Métier » quand il est cité (cas Amar Casto)", () => {
    const hints = glossaryHints(
      "Amar Casto gagne le Métier de votre choix jusqu'à la fin du tour.",
    );
    expect(hints.map((g) => g.term)).toContain("Métier");
    expect(hints.find((g) => g.term === "Métier")?.definition).toMatch(
      /Armurier|Forgeron|Bricoleur|Bijoutier/,
    );
  });

  it("gère les accents (Agilité)", () => {
    expect(
      glossaryHints("Cet Allié possède Agilité.").map((g) => g.term),
    ).toContain("Agilité");
  });

  it("NE surfacer PAS les termes ubiquitaires (Force, Niveau…)", () => {
    expect(glossaryHints("Cet Allié gagne 2 Force et un Niveau.")).toHaveLength(
      0,
    );
  });

  it("exclut les mots-clefs déjà structurés (pas de doublon)", () => {
    const text = "Cet Allié possède Tacle.";
    expect(glossaryHints(text).map((g) => g.term)).toContain("Tacle");
    expect(glossaryHints(text, ["Tacle"]).map((g) => g.term)).not.toContain(
      "Tacle",
    );
  });

  it("match MOT ENTIER seulement (pas de sous-chaîne)", () => {
    // « Capturez » ne doit PAS déclencher « Capture » (bornes de mot exigées).
    expect(
      glossaryHints("Capturez la Dragodinde adverse.").map((g) => g.term),
    ).not.toContain("Capture");
  });

  it("texte vide → aucune aide", () => {
    expect(glossaryHints("")).toHaveLength(0);
  });
});
