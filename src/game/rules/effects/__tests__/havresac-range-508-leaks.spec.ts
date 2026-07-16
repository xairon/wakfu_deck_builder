/**
 * Portée 508.1b/c — colmatage des fuites (P0-3). Deux chemins contournaient la
 * protection du Havre-Sac adverse que `effectTargetIds` applique déjà :
 *  1. Défi (`duelChooseChallenged`) : désignait un Héros/Allié adverse EMBAGUÉ.
 *  2. Ops de masse (`damageAll`/`destroyAll`/`tapAll`) : atteignaient l'intérieur
 *     du Havre-Sac adverse (zones par défaut [monde, havreSac]).
 */
import { describe, it, expect } from "vitest";
import { effectTargetIds } from "../targeting";
import type { TargetingOp } from "../targeting";
import {
  fixture,
  ctxOf,
  moveHeroTo,
  HERO_B,
  setTurn,
} from "@/game/rules/__tests__/harness";

const DUEL_OP = { op: "duelChooseChallenged" } as unknown as TargetingOp;

describe("targeting — Défi ne perce pas le Havre-Sac adverse (P0-3)", () => {
  it("un Héros adverse EMBAGUÉ n'est pas un duelliste désignable, mais l'est exposé", () => {
    const f = fixture([]);
    setTurn(f, "A", 3);
    // Héros B protégé dans son Havre-Sac : Défi de A ne peut le désigner.
    expect(effectTargetIds(ctxOf(f), DUEL_OP, "A")).not.toContain(HERO_B);
    // Héros B exposé dans le Monde : désignable.
    moveHeroTo(f, "B", "monde");
    expect(effectTargetIds(ctxOf(f), DUEL_OP, "A")).toContain(HERO_B);
  });
});
