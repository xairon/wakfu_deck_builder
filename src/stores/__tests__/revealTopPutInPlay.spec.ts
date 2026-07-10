/**
 * Intégration store (W80) — revealTopPutInPlay (les 4 Blops) : révèle les 3
 * premières cartes de la Pioche, pick OPTIONNEL d'un Allié Niveau 1 parmi
 * elles (entre en jeu gratuitement, INCLINÉ), le reste recyclé SOUS la
 * Pioche — même si le joueur PASSE (les cartes sont révélées, le recyclage
 * du reste est dû).
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import { createMockAllyCard } from "tests/factories/card";
import { makeEffectSandbox } from "./effectPipeline.harness";

const LVL1: Card = createMockAllyCard({
  id: "blop-lvl1-test",
  name: "Bloplette",
  stats: { niveau: { value: 1, element: "Neutre" } },
});
const LVL3: Card = createMockAllyCard({
  id: "blop-lvl3-test",
  name: "Gros Blop",
  stats: { niveau: { value: 3, element: "Neutre" } },
});

const OP = {
  op: "revealTopPutInPlay" as const,
  n: 3,
  what: "Allié" as const,
  exactLevel: 1,
  tapped: true,
};

function setup() {
  const { store } = makeEffectSandbox({
    first: "A",
    allAllies: true,
    extraCards: [LVL1, LVL3],
  });
  // Top 3 de la Pioche : [Niveau 1, Niveau 3, Niveau 3].
  const pioche = store.state.seats.A.pioche;
  const [t0, t1, t2] = [pioche[0], pioche[1], pioche[2]];
  store.state.instances[t0].cardId = "blop-lvl1-test";
  store.state.instances[t1].cardId = "blop-lvl3-test";
  store.state.instances[t2].cardId = "blop-lvl3-test";
  return { store, t0, t1, t2 };
}

describe("revealTopPutInPlay — révèle 3, met en jeu un Niveau 1 incliné", () => {
  it("pick du Niveau 1 → en jeu incliné gratuitement, les 2 autres recyclées sous la Pioche", () => {
    const { store, t0, t1, t2 } = setup();
    store.enqueueEffect({ seat: "A", cardName: "Blop Coco", ops: [OP] });

    // Pick ouvert sur les candidats révélés ; seul le Niveau 1 est éligible.
    expect(store.effectPicking).not.toBeNull();
    expect([...store.effectPickIds]).toEqual([t0]);
    store.effectPick(t0);

    expect(store.state.instances[t0].location.zone).toBe("monde");
    expect(store.state.instances[t0].orientation).toBe("tapped");
    // Les 2 autres révélées sont recyclées SOUS la Pioche.
    const pioche = store.state.seats.A.pioche;
    expect(pioche.slice(-2)).toEqual([t1, t2]);
    expect(store.effectPicking).toBeNull();
  });

  it("PASSER (aucune mise en jeu) → les 3 révélées sont recyclées sous la Pioche", () => {
    const { store, t0, t1, t2 } = setup();
    store.enqueueEffect({ seat: "A", cardName: "Blop Coco", ops: [OP] });

    expect(store.effectPicking).not.toBeNull();
    store.effectPickSkip();

    const pioche = store.state.seats.A.pioche;
    expect(pioche.slice(-3)).toEqual([t0, t1, t2]);
    expect(store.state.instances[t0].location.zone).toBe("pioche");
    expect(store.effectPicking).toBeNull();
  });

  it("aucun Niveau 1 révélé → rien à prendre, les 3 recyclées (pick passable d'office)", () => {
    const { store, t0, t1, t2 } = setup();
    store.state.instances[t0].cardId = "blop-lvl3-test";
    store.enqueueEffect({ seat: "A", cardName: "Blop Coco", ops: [OP] });

    // Aucun candidat éligible : le pick s'ouvre (cartes révélées) mais rien
    // n'est prenable — passer recycle tout.
    if (store.effectPicking) {
      expect([...store.effectPickIds]).toEqual([]);
      store.effectPickSkip();
    }
    const pioche = store.state.seats.A.pioche;
    expect(pioche.slice(-3)).toEqual([t0, t1, t2]);
  });
});
