/**
 * Intégration store (W56) — chooseOne N-AIRE (choix d'Élément) : l'overlay
 * expose N branches (effectChoice.options) ; effectChoiceSelect(i) enfile la
 * branche choisie. CRITIQUE : l'Élément CHOISI (explicitElement) n'est PAS
 * écrasé par l'Élément de la source vivante à la résolution (latent W50 fermé)
 * — observé via la Résistance de la cible (élément-dépendante).
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import { createMockAllyCard } from "tests/factories/card";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

/** Cible avec Résistance 1 (terre) et Force 9 (survit à tout). */
const TANK: Card = createMockAllyCard({
  id: "tank-w56",
  name: "Tank",
  stats: {
    niveau: { value: 4, element: "Eau" },
    force: { value: 9, element: "Eau" },
  },
  keywords: [{ name: "Résistance", description: "1", elements: ["Terre"] }],
});

const CHOICE_OPS = [
  {
    op: "chooseOne" as const,
    prompt: "Dommages : quel Élément ?",
    options: ["Air", "Terre", "Feu"].map((el) => ({
      label: el,
      ops: [
        {
          op: "damageTarget" as const,
          n: 3,
          element: el,
          explicitElement: true,
          heroes: false,
          zones: ["monde", "havreSac"] as ("monde" | "havreSac")[],
        },
      ],
    })),
  },
];

function setup() {
  const { store } = makeEffectSandbox({
    first: "A",
    allAllies: true,
    extraCards: [TANK],
  });
  // source VIVANTE d'Élément Feu (l'Élément choisi doit primer sur elle)
  const srcId = placeInZone(store, "A", { zone: "monde" });
  const targetId = placeInZone(store, "B", { zone: "monde" });
  store.state.instances[targetId].cardId = "tank-w56";
  return { store, srcId, targetId };
}

describe("chooseOne N-aire — choix d'Élément", () => {
  it("l'overlay expose les 3 branches ; la sélection ouvre le ciblage", () => {
    const { store, srcId } = setup();
    store.enqueueEffect({
      seat: "A",
      cardName: "Tirlangue Test",
      sourceId: srcId,
      ops: CHOICE_OPS,
    });
    expect(store.effectChoice?.options?.map((o) => o.label)).toEqual([
      "Air",
      "Terre",
      "Feu",
    ]);
    store.effectChoiceSelect(0); // Air
    expect(store.effectChoice).toBeNull();
    expect(store.effectTargeting?.op.op).toBe("damageTarget");
  });

  it("l'Élément CHOISI prime sur la source vivante : Terre → la Résistance (terre) réduit", () => {
    const { store, srcId, targetId } = setup();
    store.enqueueEffect({
      seat: "A",
      cardName: "Tirlangue Test",
      sourceId: srcId,
      ops: CHOICE_OPS,
    });
    store.effectChoiceSelect(1); // Terre — la cible a Résistance 1 (terre)
    store.effectTargetChoose(targetId);
    // 3 (Terre) − 1 (Rés terre) = 2. Si l'Élément de la SOURCE vivante avait
    // écrasé le choix, la Résistance (terre) n'aurait rien réduit → 3.
    expect(store.state.instances[targetId].counters.damage).toBe(2);
  });

  it("branche SANS la Résistance correspondante : dommages pleins", () => {
    const { store, srcId, targetId } = setup();
    store.enqueueEffect({
      seat: "A",
      cardName: "Tirlangue Test",
      sourceId: srcId,
      ops: CHOICE_OPS,
    });
    store.effectChoiceSelect(2); // Feu — pas de Résistance (feu) sur la cible
    store.effectTargetChoose(targetId);
    expect(store.state.instances[targetId].counters.damage).toBe(3);
  });
});
