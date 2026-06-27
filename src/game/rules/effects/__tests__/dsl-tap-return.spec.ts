/**
 * DSL — phrasings « Inclinez / Redressez / Renvoyez … de votre choix » →
 * tapTarget / untapTarget / returnToHand. STRICT : seules les phrases dont la
 * TOTALITÉ correspond à l'op sont compilées ; toute condition résiduelle ou
 * forme « coût : effet » (avec deux-points) reste non couverte.
 */
import { describe, it, expect } from "vitest";
import { compileActionEffectText } from "../dsl.ts";

function ops(text: string) {
  return compileActionEffectText(text, "Test")?.ops ?? null;
}

describe("DSL — tapTarget / untapTarget / returnToHand", () => {
  it("« Inclinez l'Allié de votre choix » → tapTarget (Monde, tout contrôleur)", () => {
    expect(ops("Inclinez l'Allié de votre choix.")).toEqual([
      { op: "tapTarget", zones: ["monde"] },
    ]);
  });

  it("« Inclinez l'Allié ou Héros de votre choix » → tapTarget heroes", () => {
    expect(ops("Inclinez l'Allié ou Héros de votre choix.")).toEqual([
      { op: "tapTarget", heroes: true, zones: ["monde"] },
    ]);
  });

  it("« Inclinez l'Allié ou Héros adverse de votre choix » → tapTarget heroes+opponent", () => {
    expect(ops("Inclinez l'Allié ou Héros adverse de votre choix.")).toEqual([
      {
        op: "tapTarget",
        heroes: true,
        controller: "opponent",
        zones: ["monde"],
      },
    ]);
  });

  it("« Inclinez l'Allié adverse de votre choix » → tapTarget opponent", () => {
    expect(ops("Inclinez l'Allié adverse de votre choix.")).toEqual([
      { op: "tapTarget", controller: "opponent", zones: ["monde"] },
    ]);
  });

  it("« Inclinez un de vos Alliés ou Héros » → tapTarget self+heroes", () => {
    expect(ops("Inclinez un de vos Alliés ou Héros.")).toEqual([
      { op: "tapTarget", heroes: true, controller: "self", zones: ["monde"] },
    ]);
  });

  it("« Redressez l'Allié de votre choix » → untapTarget", () => {
    expect(ops("Redressez l'Allié de votre choix.")).toEqual([
      { op: "untapTarget", zones: ["monde"] },
    ]);
  });

  it("« Redressez l'Allié ou Héros de votre choix » → untapTarget heroes", () => {
    expect(ops("Redressez l'Allié ou Héros de votre choix.")).toEqual([
      { op: "untapTarget", heroes: true, zones: ["monde"] },
    ]);
  });

  it("« Redressez l'Allié adverse de votre choix » → untapTarget opponent", () => {
    expect(ops("Redressez l'Allié adverse de votre choix.")).toEqual([
      { op: "untapTarget", controller: "opponent", zones: ["monde"] },
    ]);
  });

  it("clause Havre-Sac → zones [monde, havreSac]", () => {
    expect(
      ops(
        "Inclinez l'Allié de votre choix dans le Monde ou dans un Havre-Sac.",
      ),
    ).toEqual([{ op: "tapTarget", zones: ["monde", "havreSac"] }]);
  });

  it("« Renvoyez l'Allié adverse de votre choix dans la main de son propriétaire » → returnToHand opponent", () => {
    expect(
      ops(
        "Renvoyez l'Allié adverse de votre choix dans la main de son propriétaire.",
      ),
    ).toEqual([
      {
        op: "returnToHand",
        controller: "opponent",
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("« Renvoyez l'Allié de votre choix dans la main de son propriétaire » → returnToHand (tout contrôleur)", () => {
    expect(
      ops("Renvoyez l'Allié de votre choix dans la main de son propriétaire."),
    ).toEqual([{ op: "returnToHand", zones: ["monde", "havreSac"] }]);
  });

  // ── NÉGATIFS : conditions résiduelles et forme coût « : effet » ──────────
  it("NE compile PAS la forme coût « Inclinez un de vos Alliés : effet » (deux-points)", () => {
    expect(
      ops(
        "Inclinez un de vos Alliés : Cherchez un Allié dans votre Pioche, révélez-le et prenez-le en main.",
      ),
    ).toBeNull();
  });

  it("NE compile PAS « Inclinez l'Allié de Force inférieure ou égale à 3 de votre choix » (condition)", () => {
    expect(
      ops("Inclinez l'Allié de Force inférieure ou égale à 3 de votre choix."),
    ).toBeNull();
  });

  it("NE compile PAS « Inclinez l'Allié de votre choix qui vient d'apparaître » (condition)", () => {
    expect(
      ops("Inclinez l'Allié de votre choix qui vient d'apparaître."),
    ).toBeNull();
  });

  // W11 : le filtre combatRole rend cette formulation FIDÈLEMENT compilable
  //   (l'état du combat détermine les attaquants/bloqueurs). Ce qui était une
  //   condition non automatisable (W9) est désormais une op à filtre.
  it("compile « Inclinez l'Allié attaquant ou bloqueur de votre choix » → tapTarget combatRole inCombat", () => {
    expect(
      ops("Inclinez l'Allié attaquant ou bloqueur de votre choix."),
    ).toEqual([{ op: "tapTarget", combatRole: "inCombat", zones: ["monde"] }]);
  });

  it("NE compile PAS « Inclinez un de vos Forgemages » (famille, hors champ)", () => {
    expect(ops("Inclinez un de vos Forgemages.")).toBeNull();
  });

  it("NE compile PAS le renvoi non-Allié « Renvoyez l'Équipement ou la Salle … »", () => {
    expect(
      ops(
        "Renvoyez l'Équipement ou la Salle de votre choix dans la main de son propriétaire.",
      ),
    ).toBeNull();
  });
});
