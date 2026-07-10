/**
 * Vague W75 — drawTargetXp étendu : « Piochez un nombre de cartes égal à la
 * valeur d'XP de l'Allié <Famille> qui vient d'apparaître » (Anneau
 * Cérémonial : Famille = Unique) → sub (filtre subTypes) + recentlyAppeared
 * (jeton justAppeared W74). Pas de « de votre choix » : le référent est
 * l'unique apparu récent — les filtres d'éligibilité le désignent.
 */
import { describe, it, expect } from "vitest";
import { compileTapEffectText } from "../dsl";

describe("drawTargetXp — Famille + récence d'apparition (DSL)", () => {
  it("Anneau Cérémonial : « … de l'Allié Unique qui vient d'apparaître » (pouvoir)", () => {
    const c = compileTapEffectText(
      "Piochez un nombre de cartes égal à la valeur d'XP de l'Allié Unique qui vient d'apparaître.",
      "Anneau Cérémonial",
      undefined,
      false,
      true,
    );
    expect(c).toEqual({
      trigger: "onTap",
      ops: [
        {
          op: "drawTargetXp",
          sub: "unique",
          recentlyAppeared: true,
          zones: ["monde"],
        },
      ],
    });
  });

  it("mot de liaison en position Famille → manuel (garde anti-faux-positif)", () => {
    expect(
      compileTapEffectText(
        "Piochez un nombre de cartes égal à la valeur d'XP de l'Allié de qui vient d'apparaître.",
        "X de Test",
        undefined,
        false,
        true,
      ),
    ).toBeNull();
  });

  it("non-régression W42 : la forme « de votre choix » sans Famille compile toujours", () => {
    const c = compileTapEffectText(
      "Piochez un nombre de cartes égal à la valeur d'XP de l'Allié de votre choix.",
      "Prospection",
      undefined,
      false,
      true,
    );
    expect(c).toEqual({
      trigger: "onTap",
      ops: [{ op: "drawTargetXp", zones: ["monde"] }],
    });
  });
});
