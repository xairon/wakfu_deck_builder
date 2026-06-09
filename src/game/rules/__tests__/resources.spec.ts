import { describe, expect, it } from "vitest";
import type { Card } from "@/types/cards";
import { planCost, resourceProducers } from "../resources";
import {
  HERO_A,
  SAC_A,
  bringToMonde,
  ctxOf,
  dispatch,
  fixture,
  instId,
  makeAlly,
} from "./harness";
import { tap } from "@/game";

describe("rules/resources — producteurs et coûts", () => {
  it("compte les cartes en jeu redressées comme producteurs (héros Feu + sac Neutre)", () => {
    const f = fixture([]);
    const producers = resourceProducers(ctxOf(f), "A");
    expect(producers.map((p) => p.instanceId).sort()).toEqual([HERO_A, SAC_A]);
    const heroProd = producers.find((p) => p.instanceId === HERO_A);
    expect(heroProd?.element).toBe("feu"); // éléments normalisés en minuscules
  });

  it("exclut les cartes inclinées", () => {
    const f = fixture([]);
    dispatch(f, tap("A", HERO_A));
    const producers = resourceProducers(ctxOf(f), "A");
    expect(producers.map((p) => p.instanceId)).toEqual([SAC_A]);
  });

  it("exclut les Protecteurs (4261)", () => {
    const prot = {
      ...makeAlly("prot"),
      mainType: "Protecteur",
    } as unknown as Card;
    const f = fixture([prot]);
    bringToMonde(f, "A", instId("A", 0));
    const producers = resourceProducers(ctxOf(f), "A");
    expect(producers.map((p) => p.instanceId)).not.toContain(instId("A", 0));
  });

  it("paie un Allié Feu niveau 2 en réservant le producteur Feu requis", () => {
    const f = fixture([makeAlly("cible", { niveau: 2, element: "Feu" })]);
    const plan = planCost(ctxOf(f), "A", f.cards.get("cible")!);
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.producers).toHaveLength(2);
      expect(plan.producers).toContain(HERO_A); // seul producteur Feu
    }
  });

  it("refuse un Allié dont l'élément requis n'est pas disponible (4381)", () => {
    const f = fixture([makeAlly("cible", { niveau: 1, element: "Air" })]);
    const plan = planCost(ctxOf(f), "A", f.cards.get("cible")!);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toContain("Air");
  });

  it("refuse quand il n'y a pas assez de producteurs", () => {
    const f = fixture([makeAlly("cible", { niveau: 3, element: "Feu" })]);
    const plan = planCost(ctxOf(f), "A", f.cards.get("cible")!);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toContain("Pas assez");
  });

  it("une carte non-Allié se paie avec n'importe quels éléments (4398)", () => {
    const action = {
      ...makeAlly("act", { niveau: 2 }),
      mainType: "Action",
    } as unknown as Card;
    const f = fixture([action]);
    const plan = planCost(ctxOf(f), "A", f.cards.get("act")!);
    expect(plan.ok).toBe(true);
  });

  it("complète avec les producteurs Neutres d'abord (préserve l'élément requis)", () => {
    // En jeu : héros Feu, sac Neutre, allié Feu → jouer un Allié Feu niv 2
    // doit prendre UN producteur Feu + le Neutre, pas les deux Feu.
    const f = fixture([
      makeAlly("enjeu", { element: "Feu" }),
      makeAlly("cible", { niveau: 2, element: "Feu" }),
    ]);
    bringToMonde(f, "A", instId("A", 0));
    const plan = planCost(ctxOf(f), "A", f.cards.get("cible")!);
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.producers).toContain(SAC_A); // le Neutre est utilisé en complément
      const feuUsed = plan.producers.filter((id) => id !== SAC_A);
      expect(feuUsed).toHaveLength(1);
    }
  });
});
