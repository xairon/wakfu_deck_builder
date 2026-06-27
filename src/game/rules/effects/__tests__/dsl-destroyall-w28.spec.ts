/**
 * DSL — op de MASSE destroyAll (board-wipe « Détruisez tous les Alliés … »).
 * STRICT : seules les phrases dont la TOTALITÉ correspond sont compilées ;
 * toute clause résiduelle / conditionnelle / Famille hors allowlist reste non
 * couverte (manuel).
 */
import { describe, it, expect } from "vitest";
import { compileActionEffectText, compileEffectText } from "../dsl.ts";

/** Corps d'Action (onPlay) → ops. */
function actionOps(text: string) {
  return compileActionEffectText(text, "Test", "Feu")?.ops ?? null;
}
/** Corps d'apparition « Quand <nom> apparaît, … » → ops. */
function arriveOps(text: string, name = "Cybwork") {
  return (
    compileEffectText(`Quand ${name} apparaît, ${text}`, name, "Feu")?.ops ??
    null
  );
}

describe("DSL — destroyAll (destruction de masse)", () => {
  it("« Détruisez tous les Alliés adverses » → destroyAll opponent", () => {
    expect(actionOps("Détruisez tous les Alliés adverses.")).toEqual([
      {
        op: "destroyAll",
        controller: "opponent",
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("« Détruisez tous les Alliés et Héros dans le Monde » → destroyAll any+heroes", () => {
    expect(
      actionOps("Détruisez tous les Alliés et Héros dans le Monde."),
    ).toEqual([
      {
        op: "destroyAll",
        controller: "any",
        heroes: true,
        zones: ["monde"],
      },
    ]);
  });

  it("« détruisez tous vos Alliés Bouftous » → destroyAll self+sub", () => {
    expect(actionOps("Détruisez tous vos Alliés Bouftous.")).toEqual([
      {
        op: "destroyAll",
        controller: "self",
        sub: "bouftou",
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("Cybwork (apparition) « tous les Alliés de Niveau 1 inclinés dans le Monde » → destroyAll any+exactLevel+orientation", () => {
    expect(
      arriveOps(
        "détruisez tous les Alliés de Niveau 1 inclinés dans le Monde.",
      ),
    ).toEqual([
      {
        op: "destroyAll",
        controller: "any",
        exactLevel: 1,
        orientation: "tapped",
        zones: ["monde"],
      },
    ]);
  });

  it("« Détruisez tous les Alliés de Niveau inférieur ou égal à 3 » → destroyAll maxLevel", () => {
    expect(
      actionOps("Détruisez tous les Alliés de Niveau inférieur ou égal à 3."),
    ).toEqual([
      {
        op: "destroyAll",
        controller: "any",
        maxLevel: 3,
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("« Détruisez tous les Alliés adverses dressés dans le Monde » → destroyAll opponent+orientation upright", () => {
    expect(
      actionOps("Détruisez tous les Alliés adverses dressés dans le Monde."),
    ).toEqual([
      {
        op: "destroyAll",
        controller: "opponent",
        orientation: "upright",
        zones: ["monde"],
      },
    ]);
  });

  it("NÉGATIF — clause conditionnelle résiduelle (« qui lui ont infligé… ») → non compilé", () => {
    expect(
      actionOps(
        "Détruisez tous les Alliés adverses qui lui ont infligé un ou plusieurs Dommages pendant ce tour.",
      ),
    ).toBeNull();
  });

  it("NÉGATIF — branches « ; ou détruisez… » (Ogrest au Zinit) → non compilé", () => {
    expect(
      actionOps(
        "Détruisez tous les Alliés de Niveau inférieur ou égal à 3 ; ou détruisez tous les Alliés de Niveau supérieur ou égal à 4.",
      ),
    ).toBeNull();
  });

  it("NÉGATIF — Famille hors allowlist (« tous vos Sram ») → non compilé", () => {
    expect(actionOps("Détruisez tous vos Sram.")).toBeNull();
  });

  it("NÉGATIF — clause résiduelle « Vous ne gagnez pas d'XP. » → non compilé", () => {
    expect(
      actionOps("Détruisez tous les Alliés adverses. Vous ne gagnez pas d'XP."),
    ).toBeNull();
  });
});
