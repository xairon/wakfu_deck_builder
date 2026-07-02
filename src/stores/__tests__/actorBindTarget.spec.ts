/**
 * Intégration store (W49) — actor-bind même-cible : « Redressez X. Il gagne +2 en
 * Force ». La créature CHOISIE par l'op de ciblage (untapTarget) devient le sujet
 * du corps lié (buffForceSelf) — le +2 Force va sur ELLE, pas ailleurs.
 */
import { describe, it, expect } from "vitest";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

const JEUNESSE_OPS = [
  {
    op: "untapTarget" as const,
    heroes: true,
    zones: ["monde", "havreSac"] as ("monde" | "havreSac")[],
  },
  { op: "buffForceSelf" as const, n: 2 },
];

describe("actor-bind même-cible — « Redressez X. Il gagne +2 »", () => {
  it("le +2 en Force s'applique à la créature CHOISIE (pas à une autre)", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    const t1 = placeInZone(store, "A", { zone: "monde" });
    const t2 = placeInZone(store, "A", { zone: "monde" });

    store.enqueueEffect({
      seat: "A",
      cardName: "Jeunesse d'Ogrest",
      ops: JEUNESSE_OPS,
      actorBind: "target",
    });

    // ciblage ouvert sur untapTarget
    expect(store.effectTargeting?.op.op).toBe("untapTarget");
    store.effectTargetChoose(t1);

    // le +2 Force (jeton forceMod turn-scoped) est allé sur t1 (choisi), pas t2
    expect(store.state.instances[t1].counters.tokens?.forceMod).toBe(2);
    expect(store.state.instances[t2].counters.tokens?.forceMod ?? 0).toBe(0);
    expect(store.effectTargeting).toBeNull();
  });

  it("le sujet du corps lié est bien la cible, même si la source (l'Action) n'est pas en jeu", () => {
    // Une Action n'est pas une instance en jeu : sans le rewrite actor:"target",
    // buffForceSelf n'aurait pas de sourceId valide. La liaison le fournit.
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    const t1 = placeInZone(store, "A", { zone: "monde" });
    store.enqueueEffect({
      seat: "A",
      cardName: "Jeunesse d'Ogrest",
      ops: JEUNESSE_OPS,
      actorBind: "target",
    });
    store.effectTargetChoose(t1);
    expect(store.state.instances[t1].counters.tokens?.forceMod).toBe(2);
  });

  it("cible LIÉE morte avant le corps → buffForceSelf est un no-op (garde inPlay, fidèle)", () => {
    // Cas Furie : si le premier op tue la cible liée, « Il gagne +N » ne
    // s'applique pas (une créature détruite ne gagne pas de Force). On
    // caractérise la garde avec une tête destructrice (le chemin le plus direct :
    // la cible choisie part en Défausse, puis le corps lié la lit morte).
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    const t1 = placeInZone(store, "A", { zone: "monde" });
    store.enqueueEffect({
      seat: "A",
      cardName: "Test",
      ops: [
        { op: "destroyTarget", what: "Allié", zones: ["monde"] },
        { op: "buffForceSelf", n: 2 },
      ],
      actorBind: "target",
    });
    store.effectTargetChoose(t1);
    // la cible est détruite (Défausse) et n'a PAS gagné le jeton de Force
    expect(store.state.instances[t1].location.zone).toBe("defausse");
    expect(store.state.instances[t1].counters.tokens?.forceMod ?? 0).toBe(0);
  });
});
