/**
 * Intégration store — buffForceMultiTarget (Attaques Bontarienne/Brâkmarienne) :
 * « Choisissez jusqu'à trois de vos Alliés ou Héros <Sub> : Ils gagnent +1 en
 * Force et <Mot-clé> jusqu'à la fin du tour ». Ciblage répété distinct ;
 * « jusqu'à » = effectTargetSkip clôt la boucle sans annuler les buffs déjà
 * posés. Test par l'API publique du store.
 */
import { describe, it, expect } from "vitest";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

const BUFF_MULTI = {
  op: "buffForceMultiTarget" as const,
  n: 1,
  alsoKeyword: "Agilité" as const,
  count: 3,
  heroes: true,
  controller: "self" as const,
  zones: ["monde", "havreSac"] as ("monde" | "havreSac")[],
};

describe("buffForceMultiTarget — Choisissez jusqu'à trois (buff répété)", () => {
  it("buffe 2 cibles distinctes puis Passer → forceMod + agiliteTurnMod sur les 2 seulement", () => {
    const { store } = makeEffectSandbox({ allAllies: true, first: "A" });
    const t1 = placeInZone(store, "A", { zone: "monde" });
    const t2 = placeInZone(store, "A", { zone: "monde" });
    const t3 = placeInZone(store, "A", { zone: "monde" });

    store.enqueueEffect({
      seat: "A",
      cardName: "Attaque Bontarienne",
      ops: [BUFF_MULTI],
    });

    expect(store.effectTargeting).not.toBeNull();
    store.effectTargetChoose(t1);
    // Buff appliqué IMMÉDIATEMENT (pas à la clôture) ; ciblage ré-ouvert.
    expect(store.state.instances[t1].counters.tokens?.forceMod).toBe(1);
    expect(store.effectTargeting).not.toBeNull();
    store.effectTargetChoose(t2);
    // « Jusqu'à » : on s'arrête à 2/3 — les buffs posés restent.
    store.effectTargetSkip();

    expect(store.effectTargeting).toBeNull();
    expect(store.state.instances[t1].counters.tokens?.forceMod).toBe(1);
    expect(store.state.instances[t1].counters.tokens?.agiliteTurnMod).toBe(1);
    expect(store.state.instances[t2].counters.tokens?.forceMod).toBe(1);
    expect(store.state.instances[t2].counters.tokens?.agiliteTurnMod).toBe(1);
    expect(store.state.instances[t3].counters.tokens?.forceMod ?? 0).toBe(0);
    expect(store.state.instances[t3].counters.tokens?.agiliteTurnMod ?? 0).toBe(
      0,
    );
  });

  it("3 choix pleins → ciblage clos de lui-même (compte épuisé)", () => {
    const { store } = makeEffectSandbox({ allAllies: true, first: "A" });
    const t1 = placeInZone(store, "A", { zone: "monde" });
    const t2 = placeInZone(store, "A", { zone: "monde" });
    const t3 = placeInZone(store, "A", { zone: "monde" });

    store.enqueueEffect({
      seat: "A",
      cardName: "Attaque Bontarienne",
      ops: [BUFF_MULTI],
    });

    store.effectTargetChoose(t1);
    store.effectTargetChoose(t2);
    // Cibles DISTINCTES : re-cliquer t1 = no-op (exclue de l'éligibilité),
    // le ciblage reste ouvert et t1 ne cumule pas un 2e buff.
    store.effectTargetChoose(t1);
    expect(store.effectTargeting).not.toBeNull();
    expect(store.state.instances[t1].counters.tokens?.forceMod).toBe(1);
    store.effectTargetChoose(t3);

    expect(store.effectTargeting).toBeNull();
    for (const t of [t1, t2, t3]) {
      expect(store.state.instances[t].counters.tokens?.forceMod).toBe(1);
      expect(store.state.instances[t].counters.tokens?.agiliteTurnMod).toBe(1);
    }
  });
});
