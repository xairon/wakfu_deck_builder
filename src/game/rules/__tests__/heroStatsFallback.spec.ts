import { describe, it, expect } from "vitest";
import { createMockHeroCard } from "tests/factories/card";
import type { HeroCard } from "@/types/cards";
import { forceValue, heroStats } from "@/game/rules/cardAttrs";

describe("#8 — lecture DÉFENSIVE des stats Héros (repli top-level)", () => {
  it("Héros standard (recto.stats.force) : Force lue normalement", () => {
    const hero = {
      ...createMockHeroCard(),
      recto: {
        stats: { pv: 20, force: { value: 4, element: "Air" } },
        effects: [],
        keywords: [],
      },
    } as unknown as HeroCard;
    expect(forceValue(hero)).toBe(4);
  });

  it("Héros aux stats SEULEMENT au top-level (recto absent) : Force via repli, plus 0", () => {
    const hero = {
      ...createMockHeroCard(),
      recto: undefined,
      verso: undefined,
      stats: { force: { value: 5, element: "Air" } },
    } as unknown as HeroCard;
    // Avant le repli : heroStats renvoyait undefined → Force 0 (attaque inoffensive).
    expect(heroStats(hero, "recto")).toEqual({
      force: { value: 5, element: "Air" },
    });
    expect(forceValue(hero)).toBe(5);
  });

  it("Héros sans aucune stat de Force : reste 0 (pas de plantage)", () => {
    const hero = {
      ...createMockHeroCard(),
      recto: undefined,
      verso: undefined,
      stats: undefined,
    } as unknown as HeroCard;
    expect(forceValue(hero)).toBe(0);
  });
});
