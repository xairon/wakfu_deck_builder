/**
 * Vague W76 — Fouet (astrub) : « Détruisez le Monstre non Unique de votre
 * choix qui vient d'apparaître dans le Monde ou dans un Havre Sac. Vous ne
 * gagnez pas d'XP. » → destroyTarget + nonUnique (exclut le subType Unique) +
 * recentlyAppeared (jeton justAppeared W74) + noXp (la clause résiduelle
 * « Vous ne gagnez pas d'XP » se lie désormais aussi à destroyTarget — elle
 * ne supprimait jusqu'ici que l'XP d'un damageAll).
 */
import { describe, it, expect } from "vitest";
import { compileActionEffectText } from "../dsl";

describe("Fouet — destroyTarget non-Unique + récence + noXp (DSL)", () => {
  it("compile la carte entière (2 phrases, clause XP liée à la destruction)", () => {
    const c = compileActionEffectText(
      "Détruisez le Monstre non Unique de votre choix qui vient d'apparaître dans le Monde ou dans un Havre Sac. Vous ne gagnez pas d'XP.",
      "Fouet",
    );
    expect(c).toEqual({
      trigger: "onPlay",
      ops: [
        {
          op: "destroyTarget",
          what: "Allié",
          sub: "monstre",
          nonUnique: true,
          recentlyAppeared: true,
          noXp: true,
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("famille hors allowlist → manuel", () => {
    expect(
      compileActionEffectText(
        "Détruisez le Machin non Unique de votre choix qui vient d'apparaître dans le Monde ou dans un Havre Sac.",
        "X de Test",
      ),
    ).toBeNull();
  });

  it("non-régression : « Vous ne gagnez pas d'XP » sans destruction ni damageAll précédent → manuel", () => {
    expect(
      compileActionEffectText(
        "Piochez une carte. Vous ne gagnez pas d'XP.",
        "X de Test",
      ),
    ).toBeNull();
  });
});
