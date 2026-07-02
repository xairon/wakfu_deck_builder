/**
 * Intégration store (W41) — tapMultiTarget à compte lié : « Défaussez jusqu'à N :
 * Inclinez le même nombre d'Alliés ou Héros de votre choix ». La défausse
 * (costDiscard{max}) fixe boundCount ; le ciblage répété incline autant de
 * créatures distinctes. Test par l'API publique du store.
 */
import { describe, it, expect } from "vitest";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

const TAP_MULTI = {
  op: "tapMultiTarget" as const,
  heroes: true,
  fromCount: true,
  zones: ["monde", "havreSac"] as ("monde" | "havreSac")[],
};

describe("tapMultiTarget — Inclinez le même nombre (compte lié)", () => {
  it("défausse 2 → incline 2 cibles distinctes", () => {
    const { store } = makeEffectSandbox({ allAllies: true, first: "A" });
    // Deux cibles (Alliés de B, dressées) et deux cartes en main pour A.
    const t1 = placeInZone(store, "B", { zone: "monde" });
    const t2 = placeInZone(store, "B", { zone: "monde" });
    store.draw("A", 2);
    const handBefore = [...store.state.seats.A.main];
    expect(handBefore.length).toBeGreaterThanOrEqual(2);

    store.enqueueEffect({
      seat: "A",
      cardName: "Choc Temporel",
      ops: [{ op: "costDiscard", n: 3, max: true }, TAP_MULTI],
    });

    // Coût : défausser 2 cartes (le max s'arrête faute d'en vouloir plus → on
    // en défausse exactement 2 via deux picks puis skip).
    expect(store.effectPicking?.zone).toBe("main");
    store.effectPick(handBefore[0]);
    store.effectPick(handBefore[1]);
    store.effectPickSkip(); // s'arrêter à 2 (jusqu'à 3)

    // boundCount = 2 → tapMultiTarget ouvre le ciblage.
    expect(store.effectTargeting).not.toBeNull();
    store.effectTargetChoose(t1);
    store.effectTargetChoose(t2);

    expect(store.state.instances[t1].orientation).toBe("tapped");
    expect(store.state.instances[t2].orientation).toBe("tapped");
    // Ciblage clos (2/2), file vidée.
    expect(store.effectTargeting).toBeNull();
  });

  it("défausse 0 (main vide) → boundCount 0 → aucune inclinaison", () => {
    const { store } = makeEffectSandbox({ allAllies: true, first: "A" });
    const t1 = placeInZone(store, "B", { zone: "monde" });
    // Vider la main de A.
    store.state.seats.A.main.splice(0, store.state.seats.A.main.length);

    store.enqueueEffect({
      seat: "A",
      cardName: "Choc Temporel",
      ops: [{ op: "costDiscard", n: 3, max: true }, TAP_MULTI],
    });
    // Aucun ciblage ouvert (compte 0), cible non inclinée.
    expect(store.effectTargeting).toBeNull();
    expect(store.state.instances[t1].orientation).toBe("upright");
  });
});
