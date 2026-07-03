/**
 * Intégration store (W53) — Guy Yomtella, pouvoir à COÛT COMPOSÉ scripté
 * (CARD_SCRIPTS) : « [Incliner], [Air] : Guy Yomtella inflige 1 Dommage [Air]
 * à l'Allié de votre choix. » = inclinaison de soi (tapsSource) + paiement
 * d'1 Ressource AIR (costTapResource{element} — 1ʳᵉ utilisation du filtre
 * d'Élément W45, produit par un producteur coloré W46).
 *
 * Verrouille : (1) la GARDE coût-ressource-impayable — sans producteur Air,
 * l'activation est refusée AVANT de consommer l'inclinaison ; (2) le flux
 * complet — Guy s'incline, le producteur Air paie, la cible subit 1 Dommage ;
 * (3) le filtre d'Élément — le Héros (Feu) et Guy (inclinée) ne peuvent pas
 * payer.
 */
import { describe, it, expect } from "vitest";
import type { Card, AllyCard } from "@/types/cards";
import { createMockAllyCard } from "tests/factories/card";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

const GUY: Card = createMockAllyCard({
  id: "guy-test",
  name: "Guy Yomtella",
  stats: {
    niveau: { value: 3, element: "Air" },
    force: { value: 3, element: "Air" },
  },
  effects: [
    {
      description:
        "[Incliner], [Air] : Guy Yomtella inflige 1 Dommage [Air] à l'Allié de votre choix.",
      requiresIncline: true,
      compiled: {
        trigger: "onTap",
        cost: "paidOps",
        tapsSource: true,
        ops: [
          { op: "costTapResource", element: "Air" },
          {
            op: "damageTarget",
            n: 1,
            element: "Air",
            heroes: false,
            zones: ["monde", "havreSac"],
          },
        ],
      },
    },
  ],
});

/** Producteur AIR (Piou Jaune — production colorée W46). */
const PIOU: AllyCard = {
  ...createMockAllyCard({
    id: "piou-test",
    name: "Piou Jaune",
    stats: {
      niveau: { value: 1, element: "Neutre" },
      force: { value: 1, element: "Neutre" },
    },
    effects: [],
  }),
  producesElement: "Air",
};

function setup(withPiou: boolean) {
  const { store } = makeEffectSandbox({
    first: "A",
    allAllies: true,
    extraCards: [GUY, PIOU],
  });
  const guyId = placeInZone(store, "A", { zone: "monde" });
  store.state.instances[guyId].cardId = "guy-test";
  let piouId: string | null = null;
  if (withPiou) {
    piouId = placeInZone(store, "A", { zone: "monde" });
    store.state.instances[piouId].cardId = "piou-test";
  }
  const targetId = placeInZone(store, "B", { zone: "monde" });
  return { store, guyId, piouId, targetId };
}

describe("Guy Yomtella — coût composé Incliner + 1 Ressource Air", () => {
  it("GARDE : sans producteur Air, refusé AVANT de consommer l'inclinaison", () => {
    // En jeu côté A : Guy (Air, mais c'est la source → exclue par tapsSource),
    // Héros (Feu), Havre-Sac (Neutre) → aucun payeur Air.
    const { store, guyId } = setup(false);
    expect(store.activateTapPower(guyId)).toBe(false);
    expect(store.ruleError).toContain("Air");
    expect(store.state.instances[guyId].orientation).toBe("upright");
  });

  it("flux complet : Guy s'incline, le Piou (Air) paie, la cible subit 1 Dommage", () => {
    const { store, guyId, piouId, targetId } = setup(true);
    expect(store.activateTapPower(guyId)).toBe(true);
    // tapsSource : Guy inclinée par l'activation
    expect(store.state.instances[guyId].orientation).toBe("tapped");
    // paiement : ciblage costTapResource — seuls les producteurs AIR éligibles
    expect(store.effectTargeting?.op.op).toBe("costTapResource");
    const eligible = [...store.effectTargetIdsList];
    expect(eligible).toContain(piouId!);
    expect(eligible).not.toContain(guyId); // inclinée → ne produit plus
    expect(eligible).not.toContain(store.state.seats.A.heroInstanceId!); // Feu
    store.effectTargetChoose(piouId!);
    expect(store.state.instances[piouId!].orientation).toBe("tapped");
    // corps : damageTarget (Allié seul) — la cible adverse subit 1 Dommage Air
    expect(store.effectTargeting?.op.op).toBe("damageTarget");
    store.effectTargetChoose(targetId);
    expect(store.state.instances[targetId].counters.damage).toBe(1);
    expect(store.effectTargeting).toBeNull();
  });

  it("décliner le paiement APRÈS activation : pouvoir annulé, aucun Dommage", () => {
    // L'inclinaison est consommée (le joueur a choisi d'activer puis renonce —
    // même comportement que le coût de défausse d'Amulette Akwadala).
    const { store, guyId, targetId } = setup(true);
    expect(store.activateTapPower(guyId)).toBe(true);
    store.effectTargetSkip();
    expect(store.effectTargeting).toBeNull();
    expect(store.state.instances[targetId].counters.damage ?? 0).toBe(0);
  });
});
