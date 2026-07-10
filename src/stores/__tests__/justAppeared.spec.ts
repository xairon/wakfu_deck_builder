/**
 * Intégration store (W74) — marqueur `justAppeared` : posé sur un permanent qui
 * ENTRE EN JEU (Monde/Havre-Sac), RÉINITIALISÉ à chaque nouvelle apparition
 * (seule la plus récente le porte — « l'Allié qui VIENT d'apparaître »), purgé
 * en fin de tour (jeton turn-scoped). Le filtre `recentlyAppeared` (Homar
 * Chérif) restreint l'éligibilité aux instances marquées.
 */
import { describe, it, expect } from "vitest";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

describe("justAppeared — marqueur d'apparition + filtre recentlyAppeared", () => {
  it("l'entrée en jeu pose le marqueur ; la suivante le déplace (récence stricte)", () => {
    const { store } = makeEffectSandbox({ allAllies: true, first: "A" });
    const a1 = placeInZone(store, "A", { zone: "monde" });
    expect(store.state.instances[a1].counters.tokens?.justAppeared).toBe(1);

    const a2 = placeInZone(store, "B", { zone: "monde" });
    // a2 est la DERNIÈRE apparition : le marqueur d'a1 est réinitialisé.
    expect(store.state.instances[a2].counters.tokens?.justAppeared).toBe(1);
    expect(store.state.instances[a1].counters.tokens?.justAppeared ?? 0).toBe(
      0,
    );
  });

  it("filtre recentlyAppeared : seule l'instance marquée est ciblable, et s'incline", () => {
    const { store } = makeEffectSandbox({ allAllies: true, first: "A" });
    const old = placeInZone(store, "B", { zone: "monde" });
    const fresh = placeInZone(store, "B", { zone: "monde" });

    store.enqueueEffect({
      seat: "A",
      cardName: "Homar Chérif",
      ops: [
        {
          op: "tapTarget",
          recentlyAppeared: true,
          zones: ["monde"],
        },
      ],
    });

    expect(store.effectTargeting).not.toBeNull();
    expect([...store.effectTargetIdsList]).toContain(fresh);
    expect([...store.effectTargetIdsList]).not.toContain(old);
    store.effectTargetChoose(fresh);
    expect(store.state.instances[fresh].orientation).toBe("tapped");
    expect(store.state.instances[old].orientation).toBe("upright");
  });

  it("le marqueur est purgé en fin de tour (jeton turn-scoped)", () => {
    const { store } = makeEffectSandbox({ allAllies: true, first: "A" });
    const a1 = placeInZone(store, "A", { zone: "monde" });
    expect(store.state.instances[a1].counters.tokens?.justAppeared).toBe(1);
    store.endTurn();
    expect(store.state.instances[a1].counters.tokens?.justAppeared ?? 0).toBe(
      0,
    );
  });
});
