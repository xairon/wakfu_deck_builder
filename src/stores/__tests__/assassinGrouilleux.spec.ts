/**
 * Intégration store (W79) — Assassin Grouilleux (bonta-brakmar, Allié,
 * pouvoir à inclinaison) : « L'Assassin Grouilleux inflige un nombre de
 * Dommages égal au Niveau d'un autre Allié Grouilleux qui vient d'apparaître
 * à l'Allié ou Héros de votre choix. »
 *
 * DOUBLE RÉFÉRENT : la magnitude = Niveau du Grouilleux marqué justAppeared
 * (≠ la source — « un AUTRE »), la cible = choix du joueur. Flag
 * `damageTarget.appearedLevel{sub}` (précédent W62 : flag dédié plutôt que
 * ValueExpr quand l'évaluation exige le contexte de résolution) + gate
 * d'activation playCondition `allyJustAppeared{sub}` (pouvoir refusé sans
 * référent — l'inclinaison n'est pas brûlée pour 0 Dommages).
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import { createMockAllyCard } from "tests/factories/card";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

const ASSASSIN: Card = createMockAllyCard({
  id: "assassin-test",
  name: "Assassin Grouilleux",
  subTypes: ["Monstre", "Grouilleux"],
  effects: [
    {
      description:
        "L'Assassin Grouilleux inflige un nombre de Dommages égal au Niveau d'un autre Allié Grouilleux qui vient d'apparaître à l'Allié ou Héros de votre choix.",
      requiresIncline: true,
      compiled: {
        trigger: "onTap",
        // `other` : « un AUTRE Allié Grouilleux » — la SOURCE du pouvoir est
        // exclue du référent (le gate reçoit l'instanceId de la source).
        playCondition: {
          cond: "allyJustAppeared",
          sub: "grouilleux",
          other: true,
        },
        ops: [
          {
            op: "damageTarget",
            n: 0,
            appearedLevel: { sub: "grouilleux" },
            element: "Neutre",
            heroes: true,
            zones: ["monde", "havreSac"],
          },
        ],
      },
    },
  ],
});

const GROUILLEUX_N4: Card = createMockAllyCard({
  id: "grouilleux-n4-test",
  name: "Grouilleux Costaud",
  subTypes: ["Monstre", "Grouilleux"],
  stats: { niveau: { value: 4, element: "Neutre" } },
});

function setup() {
  const { store } = makeEffectSandbox({
    first: "A",
    allAllies: true,
    extraCards: [ASSASSIN, GROUILLEUX_N4],
  });
  const aid = placeInZone(store, "A", { zone: "monde" });
  store.state.instances[aid].cardId = "assassin-test";
  return { store, aid };
}

describe("Assassin Grouilleux — Dommages = Niveau du Grouilleux apparu", () => {
  it("sans Grouilleux apparu : activation REFUSÉE (gate), l'Assassin reste dressé", () => {
    const { store, aid } = setup();
    // L'Assassin lui-même vient d'apparaître : « un AUTRE Allié Grouilleux »
    // exige un référent DISTINCT — le gate le refuse (le seul marqué = soi).
    expect(store.activateTapPower(aid)).toBe(false);
    expect(store.state.instances[aid].orientation).toBe("upright");
  });

  it("Grouilleux Niveau 4 apparu → active, cible un Allié adverse, 4 Dommages", () => {
    const { store, aid } = setup();
    // Cible : un Allié ADVERSE dans le Monde (le Héros embagué est
    // inciblable, 508.x — hors sujet ici). Placé AVANT le Grouilleux : le
    // marqueur justAppeared = DERNIÈRE apparition (doit rester sur le
    // Grouilleux, référent de la magnitude).
    const target = placeInZone(store, "B", { zone: "monde" });
    const gid = placeInZone(store, "A", { zone: "monde" });
    store.state.instances[gid].cardId = "grouilleux-n4-test";

    expect(store.activateTapPower(aid)).toBe(true);
    expect(store.state.instances[aid].orientation).toBe("tapped");
    expect(store.effectTargeting?.op.op).toBe("damageTarget");
    store.effectTargetChoose(target);

    // Magnitude = Niveau du Grouilleux apparu (4) — comptée en Dommages sur
    // la cible (Allié mock sans Force connue → jamais détruit d'office).
    expect(store.state.instances[target].counters.damage ?? 0).toBe(4);
    expect(store.effectTargeting).toBeNull();
  });
});
