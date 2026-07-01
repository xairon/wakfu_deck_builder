/**
 * Vague W37 (deck-driven, starters Incarnam) — filtre « qui ne porte aucun
 * Équipement » (noEquipment) sur destroyTarget (Noob ×3) et tapTarget (Boon
 * Attitude). Prédicat d'INSTANCE : la cible ne doit avoir aucun attachement de
 * mainType Équipement (les Dofus attachés ne comptent pas). Couvre le DSL et
 * l'éligibilité (effectTargetIds).
 */
import { describe, it, expect } from "vitest";
import type { Card } from "@/types/cards";
import type { GameState } from "@/game";
import type { RulesCtx } from "@/game/rules";
import { compileActionEffectText, effectTargetIds } from "@/game/rules";

const ops = (t: string) =>
  compileActionEffectText(t, "Test", "Feu")?.ops ?? null;

describe("DSL — filtre noEquipment", () => {
  it("« Détruisez l'Allié de votre choix qui ne porte aucun Équipement » (Noob)", () => {
    expect(
      ops("Détruisez l'Allié de votre choix qui ne porte aucun Équipement."),
    ).toEqual([
      {
        op: "destroyTarget",
        what: "Allié",
        noEquipment: true,
        zones: ["monde"],
      },
    ]);
  });

  it("« Inclinez l'Allié ou Héros qui ne porte aucun Équipement de votre choix » (Boon Attitude)", () => {
    expect(
      ops(
        "Inclinez l'Allié ou Héros qui ne porte aucun Équipement de votre choix.",
      ),
    ).toEqual([
      { op: "tapTarget", heroes: true, noEquipment: true, zones: ["monde"] },
    ]);
  });
});

// ctx minimal (contrôle des attachements)
const CARDS: Record<string, Partial<Card>> = {
  ally: { mainType: "Allié", subTypes: [] },
  equip: { mainType: "Équipement" },
};
function ctxWith(): RulesCtx {
  const state = {
    turn: { active: "A", number: 1 },
    combat: null,
    instances: {
      porte: {
        instanceId: "porte",
        controller: "A",
        location: { zone: "monde" },
        orientation: "upright",
        attachments: ["e1"], // porte un Équipement → exclu
        cardId: "ally",
      },
      nu: {
        instanceId: "nu",
        controller: "A",
        location: { zone: "monde" },
        orientation: "upright",
        attachments: [], // aucun Équipement → éligible
        cardId: "ally",
      },
      e1: {
        instanceId: "e1",
        controller: "A",
        location: { zone: "monde" },
        cardId: "equip",
      },
    },
    seats: { A: { heroInstanceId: "hA" }, B: { heroInstanceId: "hB" } },
  } as unknown as GameState;
  return {
    state,
    getCard: (id) => (id ? ((CARDS[id] as Card) ?? null) : null),
  };
}

describe("effectTargetIds — noEquipment (destroyTarget)", () => {
  it("n'éligibilise que les créatures SANS attachement Équipement", () => {
    const op = {
      op: "destroyTarget" as const,
      what: "Allié" as const,
      noEquipment: true,
      zones: ["monde"] as ("monde" | "havreSac")[],
    };
    const eligible = effectTargetIds(ctxWith(), op, "A");
    expect(eligible).toContain("nu");
    expect(eligible).not.toContain("porte");
  });
});
