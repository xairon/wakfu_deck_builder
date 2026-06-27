/**
 * DSL — ops de MASSE (tapAll / untapAll / damageAll) et cible MULTI-TYPE
 * (returnToHand whatAny). STRICT : seules les phrases dont la TOTALITÉ
 * correspond sont compilées ; toute clause résiduelle / Famille hors allowlist
 * reste non couverte.
 */
import { describe, it, expect } from "vitest";
import { compileActionEffectText, compileEffectText } from "../dsl.ts";

/** Corps d'Action (onPlay) → ops. */
function actionOps(text: string) {
  return compileActionEffectText(text, "Test", "Feu")?.ops ?? null;
}
/** Corps d'apparition « Quand <nom> apparaît, … » → ops. */
function arriveOps(text: string, name = "Bouftou Royal") {
  return (
    compileEffectText(`Quand ${name} apparaît, ${text}`, name, "Feu")?.ops ??
    null
  );
}

describe("DSL — tapAll / untapAll (ops de masse)", () => {
  it("« Inclinez tous les Alliés et Héros de Force inférieure ou égale à 3 dans le Monde » → tapAll any+heroes+maxForce", () => {
    expect(
      actionOps(
        "Inclinez tous les Alliés et Héros de Force inférieure ou égale à 3 dans le Monde.",
      ),
    ).toEqual([
      {
        op: "tapAll",
        controller: "any",
        heroes: true,
        maxForce: 3,
        zones: ["monde"],
      },
    ]);
  });

  it("« Inclinez tous les Alliés et Héros adverses de Force inférieure ou égale à 5 » → tapAll opponent+heroes (zones tout le jeu)", () => {
    expect(
      arriveOps(
        "inclinez tous les Alliés et Héros adverses de Force inférieure ou égale à 5.",
        "Démone XX",
      ),
    ).toEqual([
      {
        op: "tapAll",
        controller: "opponent",
        heroes: true,
        maxForce: 5,
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("« redressez tous vos Alliés Bouftous dans le Monde » → untapAll self+sub", () => {
    expect(
      arriveOps("redressez tous vos Alliés Bouftous dans le Monde."),
    ).toEqual([
      { op: "untapAll", controller: "self", sub: "bouftou", zones: ["monde"] },
    ]);
  });

  it("« redressez tous vos Bouftous dans le Monde » (Famille nue) → untapAll self+sub", () => {
    expect(arriveOps("redressez tous vos Bouftous dans le Monde.")).toEqual([
      { op: "untapAll", controller: "self", sub: "bouftou", zones: ["monde"] },
    ]);
  });

  it("« Redressez tous vos Alliés dans le Monde » → untapAll self (sans Famille)", () => {
    expect(actionOps("Redressez tous vos Alliés dans le Monde.")).toEqual([
      { op: "untapAll", controller: "self", zones: ["monde"] },
    ]);
  });

  it("NÉGATIF — Famille hors allowlist (« tous vos Sram ») → non compilé", () => {
    expect(arriveOps("redressez tous vos Sram dans le Monde.")).toBeNull();
  });

  it("NÉGATIF — clause résiduelle (« … qui ont attaqué ») → non compilé", () => {
    expect(
      actionOps("Redressez tous vos Alliés qui ont attaqué ce tour."),
    ).toBeNull();
  });
});

describe("DSL — damageAll (ops de masse)", () => {
  it("« Infligez 2 Dommages à tous les Alliés adverses » → damageAll opponent (Élément source)", () => {
    expect(
      actionOps("Infligez 2 Dommages à tous les Alliés adverses."),
    ).toEqual([
      {
        op: "damageAll",
        n: 2,
        element: "Feu",
        controller: "opponent",
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("« Infligez 1 Dommage à tous les Alliés et Héros dans le Monde » → damageAll any+heroes", () => {
    expect(
      actionOps("Infligez 1 Dommage à tous les Alliés et Héros dans le Monde."),
    ).toEqual([
      {
        op: "damageAll",
        n: 1,
        element: "Feu",
        controller: "any",
        heroes: true,
        zones: ["monde"],
      },
    ]);
  });

  it("« Infligez 3 Dommages à tous vos Alliés Bouftous » → damageAll self+sub", () => {
    expect(
      actionOps("Infligez 3 Dommages à tous vos Alliés Bouftous."),
    ).toEqual([
      {
        op: "damageAll",
        n: 3,
        element: "Feu",
        controller: "self",
        sub: "bouftou",
        zones: ["monde", "havreSac"],
      },
    ]);
  });
});

describe("DSL — returnToHand multi-type (whatAny)", () => {
  it("« Renvoyez l'Allié, la Zone ou l'Équipement de votre choix … » → returnToHand whatAny (3 types)", () => {
    expect(
      actionOps(
        "Renvoyez l'Allié, la Zone ou l'Équipement de votre choix dans la main de son propriétaire.",
      ),
    ).toEqual([
      {
        op: "returnToHand",
        whatAny: ["Allié", "Zone", "Équipement"],
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("forme mono-type (« Renvoyez l'Allié … ») reste sans whatAny", () => {
    expect(
      actionOps(
        "Renvoyez l'Allié de votre choix dans la main de son propriétaire.",
      ),
    ).toEqual([{ op: "returnToHand", zones: ["monde", "havreSac"] }]);
  });

  it("NÉGATIF — type répété (« l'Allié, l'Allié ou la Zone ») → non compilé", () => {
    expect(
      actionOps(
        "Renvoyez l'Allié, l'Allié ou la Zone de votre choix dans la main de son propriétaire.",
      ),
    ).toBeNull();
  });
});
