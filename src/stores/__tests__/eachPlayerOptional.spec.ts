/**
 * Intégration store (W44) — eachPlayerOptional : deux confirmations (une par
 * siège), chacune exécutant le corps du point de vue du joueur. API du store.
 */
import { describe, it, expect } from "vitest";
import { makeEffectSandbox } from "./effectPipeline.harness";

describe("eachPlayerOptional — chaque joueur peut piocher", () => {
  it("2 confirmations (A puis B) : chacun pioche s'il accepte", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    const aBefore = store.state.seats.A.main.length;
    const bBefore = store.state.seats.B.main.length;

    store.enqueueEffect({
      seat: "A",
      cardName: "Coffre Malveillant",
      ops: [{ op: "eachPlayerOptional", ops: [{ op: "draw", n: 1 }] }],
    });

    // 1re confirmation = joueur actif (A).
    expect(store.effectChoice?.seat).toBe("A");
    store.effectChoiceResolve(true);
    // 2e confirmation = adversaire (B).
    expect(store.effectChoice?.seat).toBe("B");
    store.effectChoiceResolve(true);

    expect(store.state.seats.A.main.length).toBe(aBefore + 1);
    expect(store.state.seats.B.main.length).toBe(bBefore + 1);
    expect(store.effectChoice).toBeNull();
  });

  it("un joueur peut DÉCLINER (le « peut » est réel)", () => {
    const { store } = makeEffectSandbox({ first: "A", allAllies: true });
    const aBefore = store.state.seats.A.main.length;
    const bBefore = store.state.seats.B.main.length;

    store.enqueueEffect({
      seat: "A",
      cardName: "Coffre Malveillant",
      ops: [{ op: "eachPlayerOptional", ops: [{ op: "draw", n: 1 }] }],
    });
    store.effectChoiceResolve(true); // A pioche
    store.effectChoiceResolve(false); // B décline

    expect(store.state.seats.A.main.length).toBe(aBefore + 1);
    expect(store.state.seats.B.main.length).toBe(bBefore); // B n'a pas pioché
  });
});
