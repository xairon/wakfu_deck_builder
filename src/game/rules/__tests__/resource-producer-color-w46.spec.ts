/**
 * Vague W46 (deck-driven, starters Incarnam) — PRODUCTION DE RESSOURCE COLORÉE.
 * Les Pious (« Produisez une Ressource [Eau/Air/Feu/Terre] ») sont Neutre en
 * Niveau ET Force, mais produisent une Ressource COLORÉE (color-fixing). Le champ
 * dérivé `card.producesElement` (peuplé par compileEffects) est lu par
 * `resourceElement`, utilisé par `resourceProducers`/`planCost` — SANS toucher
 * `producedElement` (Élément de Dommages de combat / filtres de pile, qui reste
 * l'Élément IMPRIMÉ = Neutre).
 */
import { describe, it, expect } from "vitest";
import type { AllyCard } from "@/types/cards";
import { producedElement, resourceElement } from "../cardAttrs";
import { planCost, resourceProducers } from "../resources";
import { ctxOf, fixture, bringToMonde, instId, makeAlly } from "./harness";

/** Un Piou Bleu : Allié Neutre (Niveau/Force) qui produit de l'Eau. */
function pkiou(id: string, element: AllyCard["producesElement"]): AllyCard {
  return { ...makeAlly(id, { element: "Neutre" }), producesElement: element };
}

describe("resourceElement — override coloré des producteurs", () => {
  it("carte avec producesElement → cet Élément (normalisé), pas l'Élément imprimé", () => {
    const piou = pkiou("piou-bleu", "Eau");
    expect(resourceElement(piou)).toBe("eau");
    // producedElement (combat / pile) reste l'Élément IMPRIMÉ = neutre
    expect(producedElement(piou)).toBe("neutre");
  });

  it("carte sans producesElement → producteur générique (Élément imprimé)", () => {
    const ally = makeAlly("banal", { element: "Feu" });
    expect(resourceElement(ally)).toBe("feu");
    expect(producedElement(ally)).toBe("feu");
  });
});

describe("resourceProducers — le Piou produit sa couleur", () => {
  it("un Piou Bleu en jeu est un producteur d'EAU (pas de Neutre)", () => {
    const f = fixture([pkiou("piou-bleu", "Eau")]);
    bringToMonde(f, "A", instId("A", 0));
    const prod = resourceProducers(ctxOf(f), "A").find(
      (p) => p.instanceId === instId("A", 0),
    );
    expect(prod?.element).toBe("eau");
  });
});

describe("planCost — le Piou fixe la couleur (color-fixing)", () => {
  it("un Piou Bleu satisfait l'exigence Eau d'un Allié Eau Niveau 2", () => {
    // En jeu : Héros A (Feu), Havre-Sac A (Neutre), Piou Bleu (produit Eau).
    // Jouer un Allié Eau Niveau 2 : exige ≥1 Ressource Eau — SEUL le Piou la fournit.
    const f = fixture([
      pkiou("piou-bleu", "Eau"),
      makeAlly("cible-eau", { niveau: 2, element: "Eau" }),
    ]);
    bringToMonde(f, "A", instId("A", 0)); // le Piou Bleu en jeu, dressé
    const plan = planCost(ctxOf(f), "A", f.cards.get("cible-eau")!);
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.producers).toContain(instId("A", 0)); // le Piou paie l'Eau
  });

  it("SANS le Piou, l'exigence Eau n'est PAS satisfaite (régression négative)", () => {
    // Héros A (Feu) + Havre-Sac A (Neutre) seuls : aucune Ressource Eau.
    const f = fixture([makeAlly("cible-eau", { niveau: 1, element: "Eau" })]);
    const plan = planCost(ctxOf(f), "A", f.cards.get("cible-eau")!);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toContain("Eau");
    // sanity : le Héros reste un producteur Feu (producedElement inchangé)
    expect(resourceProducers(ctxOf(f), "A").map((p) => p.element)).toContain(
      "feu",
    );
  });
});
