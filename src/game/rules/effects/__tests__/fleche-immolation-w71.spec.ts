/**
 * Vague W71 (deck-driven, starter Incarnam Flèche d'Immolation) — CIBLAGE
 * « qui vient de s'incliner » (filtre recentlyInclined).
 *
 * Flèche : « Réaction. … inflige 2 Dommages [Feu] à l'Allié ou Héros qui vient de
 * s'incliner. » Le filtre `recentlyInclined` de damageTarget restreint la cible
 * aux créatures portant le jeton `justInclined` (posé sur les attaquants qui
 * s'inclinent à la déclaration).
 */
import { describe, it, expect } from "vitest";
import type { GameState } from "@/game";
import type { RulesCtx } from "@/game/rules/types";
import { effectTargetIds } from "../targeting";

const OP = {
  op: "damageTarget" as const,
  n: 2,
  element: "Feu",
  explicitElement: true,
  recentlyInclined: true,
  heroes: true,
  zones: ["monde", "havreSac"] as ("monde" | "havreSac")[],
};

function ctx(): RulesCtx {
  const mk = (id: string, ctrl: string, justInclined?: number) => ({
    instanceId: id,
    cardId: "ally",
    owner: ctrl,
    controller: ctrl,
    orientation: "tapped",
    location: { zone: "monde" },
    counters: justInclined ? { tokens: { justInclined } } : {},
  });
  const state = {
    turn: { active: "A", number: 3 },
    instances: {
      atkNew: mk("atkNew", "A", 1), // vient de s'incliner
      atkOld: mk("atkOld", "A", 0), // incliné mais PAS marqué
      other: mk("other", "B"), // pas marqué
    },
  } as unknown as GameState;
  return {
    state,
    getCard: () => ({ mainType: "Allié", subTypes: [] }) as never,
  } as RulesCtx;
}

describe("Flèche d'Immolation — filtre recentlyInclined", () => {
  it("seuls les créatures marquées `justInclined` sont ciblables", () => {
    expect(effectTargetIds(ctx(), OP, "A")).toEqual(["atkNew"]);
  });

  it("sans le flag recentlyInclined : toutes les créatures redeviennent ciblables", () => {
    const { recentlyInclined: _omit, ...noFilter } = OP;
    const ids = effectTargetIds(ctx(), noFilter, "A");
    expect(ids).toContain("atkNew");
    expect(ids).toContain("atkOld");
    expect(ids).toContain("other");
  });
});
