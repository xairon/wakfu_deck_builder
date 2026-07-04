/**
 * Vague W70 (store) — jouer Glyphe Incandescent pose le marqueur flottant
 * `glypheDamage` sur le Héros (onPlay → incHeroTurnToken).
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import { createMockActionCard } from "tests/factories/card";
import { makeEffectSandbox, placeInZone } from "./effectPipeline.harness";

const GLYPHE: Card = createMockActionCard({
  id: "glyphe-test",
  name: "Glyphe Incandescent",
  effects: [
    {
      description: "Jusqu'à la fin de la phase d'action, …",
      compiled: {
        trigger: "onPlay",
        ops: [{ op: "incHeroTurnToken", token: "glypheDamage", n: 1 }],
      },
    },
  ],
});

describe("Glyphe Incandescent — marqueur flottant à la mise en jeu", () => {
  it("jouer Glyphe pose glypheDamage=1 sur le Héros ; le rejouer cumule à 2", () => {
    const { store } = makeEffectSandbox({
      first: "A",
      allAllies: true,
      extraCards: [GLYPHE],
    });
    store.state.turn.number = 3;
    const heroA = store.state.seats.A.heroInstanceId!;
    const g1 = placeInZone(store, "A", { zone: "main", owner: "A" });
    store.state.instances[g1].cardId = "glyphe-test";
    store.playFromHand(g1);
    expect(store.state.instances[heroA].counters.tokens?.glypheDamage).toBe(1);
    const g2 = placeInZone(store, "A", { zone: "main", owner: "A" });
    store.state.instances[g2].cardId = "glyphe-test";
    store.playFromHand(g2);
    expect(store.state.instances[heroA].counters.tokens?.glypheDamage).toBe(2);
  });
});
