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

  it("permets de révéler et masquer son deck à l'adversaire sans altérer l'ordre", async () => {
    const { store } = makeEffectSandbox({ allAllies: true, first: "A" });
    const deckOrderBefore = [...store.state.seats.A!.pioche];
    expect(deckOrderBefore.length).toBeGreaterThan(0);

    expect(store.isMyDeckRevealed).toBe(false);

    // 1. Révéler le deck
    store.toggleRevealMyDeck();
    expect(store.isMyDeckRevealed).toBe(true);

    // L'ordre des cartes dans le deck ne doit pas être altéré
    expect(store.state.seats.A!.pioche).toEqual(deckOrderBefore);

    // Vérifier la projection redactStateFor pour l'adversaire (B)
    const { redactStateFor } = await import("@/game/engine/redact");
    const redactedForB = redactStateFor(store.state, "B");
    const piocheZoneB = redactedForB.seats.A!.pioche;

    // La pioche doit être en "full" car révélée
    expect(piocheZoneB.kind).toBe("full");
    if (piocheZoneB.kind === "full") {
      expect(piocheZoneB.instances.length).toBe(deckOrderBefore.length);
      // Les cardId doivent être visibles et non null
      expect(piocheZoneB.instances.every((inst) => inst.cardId !== null)).toBe(true);
      // L'ordre des instanceIds doit être identique
      expect(piocheZoneB.instances.map((i) => i.instanceId)).toEqual(deckOrderBefore);
    }

    // 2. Masquer le deck
    store.toggleRevealMyDeck();
    expect(store.isMyDeckRevealed).toBe(false);

    // L'ordre est toujours intact
    expect(store.state.seats.A!.pioche).toEqual(deckOrderBefore);

    // Re-vérifier la projection : la pioche redevient opaque ("count")
    const redactedForBHidden = redactStateFor(store.state, "B");
    expect(redactedForBHidden.seats.A!.pioche.kind).toBe("count");
  });
});
