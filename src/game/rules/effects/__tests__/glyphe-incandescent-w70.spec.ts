/**
 * Vague W70 (deck-driven, starter Incarnam Glyphe Incandescent) — MARQUEUR
 * FLOTTANT + Dommages sur inclinaison d'attaquant.
 *
 * Glyphe : « Jusqu'à la fin de la phase d'action, chaque fois qu'un Allié ou Héros
 * attaquant ou bloqueur s'incline dans ce combat, le Glyphe Incandescent lui
 * inflige 2 Dommages [Feu]. » Les attaquants s'inclinent à la DÉCLARATION
 * (attackerDeclared) → glypheFrames émet un paquet de 2 Feu par Glyphe actif à
 * l'attaquant (riposteTargetId). Marqueur flottant = jeton `glypheDamage` du Héros.
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import type { GameState } from "@/game";
import type { RuleEvent, RulesCtx } from "@/game/rules/types";
import { collectTriggeredEffects } from "../triggers";

const ATK: Card = {
  id: "atk",
  name: "Attaquant",
  mainType: "Allié",
  subTypes: [],
  effects: [],
} as unknown as Card;

/** ctx : attaquant "atk" (A), Héros A avec `glypheDamage` = nGlyphes. */
function ctxWith(nGlyphes: number): RulesCtx {
  const state = {
    turn: { active: "A", number: 3 },
    seats: {
      A: { heroInstanceId: "heroA" },
      B: { heroInstanceId: "heroB" },
    },
    instances: {
      atk: {
        instanceId: "atk",
        cardId: "atk",
        owner: "A",
        controller: "A",
        location: { zone: "monde" },
        counters: {},
      },
      heroA: {
        instanceId: "heroA",
        cardId: "hero",
        owner: "A",
        controller: "A",
        location: { zone: "havreSac" },
        counters: { tokens: { glypheDamage: nGlyphes } },
      },
      heroB: {
        instanceId: "heroB",
        cardId: "hero",
        owner: "B",
        controller: "B",
        location: { zone: "havreSac" },
        counters: {},
      },
    },
  } as unknown as GameState;
  return {
    state,
    getCard: (id) => (id === "atk" ? ATK : null),
  } as RulesCtx;
}

const declared = (): RuleEvent[] => [
  { kind: "attackerDeclared", seat: "A", instanceId: "atk" },
];

describe("glypheFrames — Glyphe Incandescent (Dommages sur inclinaison d'attaquant)", () => {
  it("1 Glyphe actif : un paquet de 2 Feu à l'attaquant qui se déclare/incline", () => {
    const frames = collectTriggeredEffects(ctxWith(1), declared());
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({
      cardName: "Glyphe Incandescent",
      riposteTargetId: "atk",
      ops: [{ op: "damageRiposteSource", n: 2, element: "Feu" }],
    });
  });

  it("aucun Glyphe actif : aucune frame", () => {
    expect(collectTriggeredEffects(ctxWith(0), declared())).toEqual([]);
  });

  it("attaquant DÉJÀ incliné (inclined:false) : aucune frame (« attaque » ≠ « s'incline »)", () => {
    const evt: RuleEvent[] = [
      {
        kind: "attackerDeclared",
        seat: "A",
        instanceId: "atk",
        inclined: false,
      },
    ];
    expect(collectTriggeredEffects(ctxWith(1), evt)).toEqual([]);
  });

  it("2 Glyphes actifs : DEUX paquets de 2 (Résistance par paquet)", () => {
    const frames = collectTriggeredEffects(ctxWith(2), declared());
    expect(frames).toHaveLength(2);
    for (const f of frames)
      expect(f.ops).toEqual([
        { op: "damageRiposteSource", n: 2, element: "Feu" },
      ]);
  });
});
