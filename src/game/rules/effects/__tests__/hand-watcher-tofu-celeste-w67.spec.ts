/**
 * Vague W67 (deck-driven, starter Incarnam Tofu Céleste) — DÉCLENCHÉ DEPUIS LA
 * MAIN (hand-watcher).
 *
 * Tofu Céleste : « Réaction. Quand un de vos Tofus est détruit, vous pouvez payer
 * [Air][Air] pour mettre en jeu le Tofu Céleste de votre main. Il apparaît
 * incliné. » Le WATCHER est EN MAIN : handWatcherFrames scanne la main du
 * contrôleur sur l'événement `destroyed` (bus 804.7) et émet une frame OPTIONNELLE
 * (sourceId = la carte en main) quand un Tofu contrôlé est détruit.
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import type { GameState } from "@/game";
import type { RuleEvent, RulesCtx } from "@/game/rules/types";
import { collectTriggeredEffects } from "../triggers";

const TOFU: Card = {
  id: "tofu",
  name: "Tofu",
  mainType: "Allié",
  subTypes: ["Monstre", "Tofu"],
  effects: [],
} as unknown as Card;

const CRA_MONSTER: Card = {
  id: "cra",
  name: "Larve",
  mainType: "Allié",
  subTypes: ["Monstre"],
  effects: [],
} as unknown as Card;

const CELESTE: Card = {
  id: "tofu-celeste",
  name: "Tofu Céleste",
  mainType: "Allié",
  subTypes: ["Monstre", "Tofu"],
  effects: [
    { description: "Géant", compiled: undefined },
    {
      description: "Réaction. Quand un de vos Tofus est détruit, …",
      compiled: {
        trigger: "onControlledDestroyedFromHand",
        watchSub: "tofu",
        optional: true,
        cost: "paidOps",
        ops: [
          { op: "costTapResource", element: "Air" },
          { op: "costTapResource", element: "Air" },
          { op: "putSelfInPlay", tapped: true },
        ],
      },
    },
  ],
} as unknown as Card;

const CARDS: Record<string, Card> = {
  tofu: TOFU,
  cra: CRA_MONSTER,
  "tofu-celeste": CELESTE,
};

/** ctx : `deadId` détruit (Monde), `celeste` en MAIN de A (sauf celesteInPlay). */
function ctxWith(deadCardId: string, celesteInPlay = false): RulesCtx {
  const state = {
    turn: { active: "A", number: 3 },
    monde: ["dead"],
    seats: {
      A: { main: celesteInPlay ? [] : ["celeste"] },
      B: { main: [] },
    },
    instances: {
      dead: {
        instanceId: "dead",
        cardId: deadCardId,
        owner: "A",
        controller: "A",
        location: { zone: "defausse" },
      },
      celeste: {
        instanceId: "celeste",
        cardId: "tofu-celeste",
        owner: "A",
        controller: "A",
        location: { zone: celesteInPlay ? "monde" : "main" },
      },
    },
  } as unknown as GameState;
  return {
    state,
    getCard: (id) => (id ? (CARDS[id] ?? null) : null),
  } as RulesCtx;
}

const destroyed = (): RuleEvent[] => [
  { kind: "destroyed", instanceId: "dead", controller: "A" },
];

describe("handWatcherFrames — Tofu Céleste (déclenché depuis la main)", () => {
  it("un Tofu contrôlé détruit + Tofu Céleste en main → frame OPTIONNELLE (2 Air + putSelfInPlay)", () => {
    const frames = collectTriggeredEffects(ctxWith("tofu"), destroyed());
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({
      seat: "A",
      sourceId: "celeste",
      cardName: "Tofu Céleste",
      optional: true,
      ops: [
        { op: "costTapResource", element: "Air" },
        { op: "costTapResource", element: "Air" },
        { op: "putSelfInPlay", tapped: true },
      ],
    });
  });

  it("une créature détruite qui N'EST PAS un Tofu → aucune frame (watchSub non matché)", () => {
    expect(collectTriggeredEffects(ctxWith("cra"), destroyed())).toEqual([]);
  });

  it("Tofu Céleste EN JEU (pas en main) → aucune frame (watcher scanne la main)", () => {
    expect(collectTriggeredEffects(ctxWith("tofu", true), destroyed())).toEqual(
      [],
    );
  });
});
