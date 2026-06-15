import { describe, expect, it } from "vitest";
import { isTurnToken } from "@/game/rules";

describe("rules/limits — isTurnToken (purge de fin de tour)", () => {
  it("purge les modificateurs de tour nommés", () => {
    for (const t of [
      "forceMod",
      "paMod",
      "pmMod",
      "geantMod",
      "coupCritique",
      "teamForceMod",
    ])
      expect(isTurnToken(t)).toBe(true);
  });

  it("purge tout jeton *CombatMod et les préfixes datés", () => {
    expect(isTurnToken("forceCombatMod")).toBe(true);
    expect(isTurnToken("pmCombatMod")).toBe(true);
    expect(isTurnToken("geantCombatMod")).toBe(true);
    expect(isTurnToken("resMod_feu")).toBe(true);
    expect(isTurnToken("powerUses0")).toBe(true);
    expect(isTurnToken("metier_bucheron")).toBe(true);
  });

  it("conserve le mal d'invocation et les compteurs durables", () => {
    expect(isTurnToken("arrivedTurn")).toBe(false);
    expect(isTurnToken("inconnu")).toBe(false);
  });

  it("Trêve : expire seulement quand le prochain tour atteint la borne", () => {
    // posée au tour 4 → active « jusqu'au début de votre prochain tour » (6)
    expect(isTurnToken("treveUntilTurn", 6, 5)).toBe(false); // tour adverse
    expect(isTurnToken("treveUntilTurn", 6, 6)).toBe(true); // votre tour → expire
    expect(isTurnToken("treveUntilTurn")).toBe(false); // sans bornes → conservée
  });
});
