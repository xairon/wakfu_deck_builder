import { describe, it, expect } from "vitest";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

describe("revealAndDeckMenu", () => {
  it("permets d'alterner entre montrer sa main et cacher sa main", () => {
    const { store } = makeEffectSandbox({ allAllies: true, first: "A" });
    placeInZone(store, "A", { zone: "main", owner: "A" });

    expect(store.isMyHandRevealed).toBe(false);

    // Révéler la main
    store.revealMyHand();
    expect(store.isMyHandRevealed).toBe(true);

    // Cacher la main
    store.hideMyHand();
    expect(store.isMyHandRevealed).toBe(false);
  });
});
