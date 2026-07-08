import { describe, it, expect } from "vitest";
import { glossaryHints } from "../glossaryHints";

describe("glossaryHints — surfacer les définitions de glossaire utiles", () => {
  it("surfacer « Métier » quand il est cité dans l'effet (cas Amar Casto)", () => {
    const hints = glossaryHints({
      effectsText:
        "Amar Casto gagne le Métier de votre choix jusqu'à la fin du tour.",
    });
    expect(hints.map((g) => g.term)).toContain("Métier");
    expect(hints.find((g) => g.term === "Métier")?.definition).toMatch(
      /Armurier|Forgeron|Bricoleur|Bijoutier/,
    );
  });

  it("gère les accents dans l'effet (Agilité)", () => {
    expect(
      glossaryHints({ effectsText: "Cet Allié possède Agilité." }).map(
        (g) => g.term,
      ),
    ).toContain("Agilité");
  });

  it("NE surfacer PAS les termes ubiquitaires (Force, Niveau…)", () => {
    expect(
      glossaryHints({ effectsText: "Cet Allié gagne 2 Force et un Niveau." }),
    ).toHaveLength(0);
  });

  it("évite le doublon avec un mot-clef déjà structuré (Agilité en keyword)", () => {
    // La puce du mot-clef Agilité montre déjà sa définition → pas de doublon.
    const hints = glossaryHints({
      effectsText: "Cet Allié possède Agilité.",
      keywordNames: ["Agilité"],
    });
    expect(hints.map((g) => g.term)).not.toContain("Agilité");
  });

  it("explique le mot-clef « Recette » (dont la puce ne montre que le coût)", () => {
    const hints = glossaryHints({
      keywordNames: ["Recette"],
      keywordDescriptions: [": Bijoutier 3"],
    });
    expect(hints.map((g) => g.term)).toContain("Recette");
    // « Bijoutier » (cité dans le coût de Recette) → définition de « Métier ».
    expect(hints.map((g) => g.term)).toContain("Métier");
  });

  it("explique le Métier d'un Allié Artisan (card.metier = Bijoutier)", () => {
    const hints = glossaryHints({ metier: ["Bijoutier"] });
    expect(hints.map((g) => g.term)).toContain("Métier");
  });

  it("match MOT ENTIER seulement (pas de sous-chaîne)", () => {
    expect(
      glossaryHints({ effectsText: "Capturez la Dragodinde adverse." }).map(
        (g) => g.term,
      ),
    ).not.toContain("Capture");
  });

  it("entrée vide → aucune aide", () => {
    expect(glossaryHints({})).toHaveLength(0);
    expect(glossaryHints({ effectsText: "" })).toHaveLength(0);
  });
});
