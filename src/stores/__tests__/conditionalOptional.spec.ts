/**
 * Intégration store (W47) — op `conditional` avec `optional` : quand la condition
 * est VRAIE, le corps est PROPOSÉ (effectChoice Oui/Non), pas exécuté d'office ;
 * accepter exécute le corps, décliner le saute. Quand la condition est FAUSSE,
 * AUCUNE proposition n'apparaît (la condition garde l'offre — pas de prompt inutile).
 */
import { describe, it, expect } from "vitest";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

const condOptDraw = (zone: "monde" | "havreSac") => [
  {
    op: "conditional" as const,
    cond: { cond: "selfInZone" as const, zone },
    optional: true,
    ops: [{ op: "draw" as const, n: 1 }],
  },
];

describe("conditional optionnel — la condition garde l'offre", () => {
  it("condition VRAIE + accepter → le corps s'exécute (pioche)", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    const id = placeInZone(store, "A", { zone: "monde" });
    store.enqueueEffect({
      seat: "A",
      cardName: "Dollarawan",
      sourceId: id,
      ops: condOptDraw("monde"), // self EST dans le Monde → condition vraie
    });
    // proposition affichée (pas d'exécution d'office)
    expect(store.effectChoice).not.toBeNull();
    const before = store.state.seats.A.main.length;
    store.effectChoiceResolve(true);
    expect(store.state.seats.A.main.length).toBe(before + 1);
    expect(store.effectChoice).toBeNull();
  });

  it("condition VRAIE + décliner → le corps est sauté (pas de pioche)", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    const id = placeInZone(store, "A", { zone: "monde" });
    store.enqueueEffect({
      seat: "A",
      cardName: "Dollarawan",
      sourceId: id,
      ops: condOptDraw("monde"),
    });
    expect(store.effectChoice).not.toBeNull();
    const before = store.state.seats.A.main.length;
    store.effectChoiceResolve(false);
    expect(store.state.seats.A.main.length).toBe(before);
  });

  it("condition FAUSSE → AUCUNE proposition (pas de prompt inutile), rien ne se passe", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    const id = placeInZone(store, "A", { zone: "monde" });
    const before = store.state.seats.A.main.length;
    store.enqueueEffect({
      seat: "A",
      cardName: "Dollarawan",
      sourceId: id,
      ops: condOptDraw("havreSac"), // self est dans le Monde, PAS dans le Havre-Sac
    });
    // la condition est fausse → pas de proposition, pas de pioche
    expect(store.effectChoice).toBeNull();
    expect(store.state.seats.A.main.length).toBe(before);
  });
});
