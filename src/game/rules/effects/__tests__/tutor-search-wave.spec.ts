/**
 * Vague « TUTEUR D'APPARITION » (Volet B) — étend la recherche-Pioche
 * (searchDeck) aux formes réelles du corpus (9 effets mesurés) :
 *  - corps INFINITIF après « vous pouvez » (« chercher …, la révéler et la
 *    prendre en main ») ;
 *  - catégories de carte NON-créature par subType SEUL (Quête, Parchemin,
 *    Potion, Arme, Monture, Donjon — `what` devient optionnel : « un
 *    Parchemin » = toute carte au subType Parchemin, quel que soit le type) ;
 *  - filtre par NOM (« une Gelée Menthe » = la carte NOMMÉE ainsi — Menthe
 *    n'est pas un subType ; l'ancien chemin famille+mot IGNORAIT le 2e mot →
 *    sur-large, corrigé) ;
 *  - « de Niveau 1 ou 2 » → levelIn (déjà porté par matchesPickFilter) ;
 *  - queue « . Si vous le faites, mélangez [ensuite] vot(t)re Pioche » absorbée
 *    par le corps de TUTEUR uniquement (le mélange est intrinsèque à la
 *    recherche — PAS une levée du garde multi-phrases W47).
 */
import { describe, it, expect } from "vitest";
import { compileEffectText } from "../dsl";
import { matchesPickFilter } from "../engine";
import type { Card } from "@/types/cards";

const arrive = (body: string, name: string) =>
  compileEffectText(`Quand ${name} apparaît, ${body}`, name);

describe("tuteur — corps infinitif + catégories subType (DSL)", () => {
  it("Ganymède : « chercher une Quête …, la révéler et la prendre en main, puis mélanger »", () => {
    const c = arrive(
      "vous pouvez chercher une Quête dans votre Pioche, la révéler et la prendre en main, puis mélanger votre Pioche.",
      "Ganymède",
    );
    expect(c).toEqual({
      trigger: "onArrive",
      optional: true,
      ops: [
        { op: "searchDeck", sub: "quete", dest: "main" },
        { op: "shuffleDeck" },
      ],
    });
  });

  it("Crail : queue « Si vous le faites, mélangez votre Pioche » absorbée (Dofus)", () => {
    const c = arrive(
      "vous pouvez chercher un Dofus dans votre Pioche, le révéler et le prendre en main. Si vous le faites, mélangez votre Pioche.",
      "Crail",
    );
    expect(c).toEqual({
      trigger: "onArrive",
      optional: true,
      ops: [
        { op: "searchDeck", what: "Dofus", dest: "main" },
        { op: "shuffleDeck" },
      ],
    });
  });

  it("Festino : « une Arme » (catégorie subType) + « mélangez ensuite »", () => {
    const c = arrive(
      "vous pouvez chercher une Arme dans votre pioche, la révéler et la prendre en main. Si vous le faites, mélangez ensuite votre Pioche.",
      "Festino",
    );
    expect(c).toEqual({
      trigger: "onArrive",
      optional: true,
      ops: [
        { op: "searchDeck", sub: "arme", dest: "main" },
        { op: "shuffleDeck" },
      ],
    });
  });

  it("Jékïde : « un Équipement de Niveau 1 ou 2 » → levelIn [1, 2]", () => {
    const c = arrive(
      "vous pouvez chercher un Équipement de Niveau 1 ou 2 dans votre Pioche, le révéler et le prendre en main. Si vous le faites, mélangez votre Pioche.",
      "Jékïde",
    );
    expect(c).toEqual({
      trigger: "onArrive",
      optional: true,
      ops: [
        { op: "searchDeck", what: "Équipement", levelIn: [1, 2], dest: "main" },
        { op: "shuffleDeck" },
      ],
    });
  });

  it("Gelée Royale Menthe : « une Gelée Menthe » = filtre par NOM (pas la famille entière)", () => {
    const c = arrive(
      "vous pouvez chercher une Gelée Menthe dans votre Pioche, la révéler et la prendre en main. Si vous le faites, mélangez votre Pioche.",
      "Gelée Royale Menthe",
    );
    expect(c).toEqual({
      trigger: "onArrive",
      optional: true,
      ops: [
        { op: "searchDeck", what: "Allié", name: "gelee menthe", dest: "main" },
        { op: "shuffleDeck" },
      ],
    });
  });

  it("Gelée Royale Citron : tolère la typo de scrape « vottre Pioche »", () => {
    const c = arrive(
      "vous pouvez chercher une Gelée Citron dans votre Pioche, la révéler et la prendre en main. Si vous le faites, mélangez vottre Pioche.",
      "Gelée Royale Citron",
    );
    expect(c).toMatchObject({
      trigger: "onArrive",
      optional: true,
      ops: [
        { op: "searchDeck", what: "Allié", name: "gelee citron", dest: "main" },
        { op: "shuffleDeck" },
      ],
    });
  });

  it("la queue « Si vous le faites, mélangez » n'est PAS absorbée hors tuteur (garde W47)", () => {
    // « vous pouvez piocher une carte. Si vous le faites, mélangez votre
    // Pioche. » : la conséquence ne se rattache pas à une recherche → manuel.
    expect(
      arrive(
        "vous pouvez piocher une carte. Si vous le faites, mélangez votre Pioche.",
        "Veilleur",
      ),
    ).toBeNull();
  });
});

describe("tuteur — matchesPickFilter par NOM (moteur)", () => {
  const gelee = (name: string): Card =>
    ({
      id: name,
      name,
      mainType: "Allié",
      subTypes: ["Monstre", "Gelée"],
    }) as unknown as Card;

  it("le filtre name ne retient que la carte du nom exact (accents/casse ignorés)", () => {
    expect(
      matchesPickFilter(gelee("Gelée Menthe"), {
        mainType: "Allié",
        name: "gelee menthe",
      }),
    ).toBe(true);
    expect(
      matchesPickFilter(gelee("Gelée Royale Menthe"), {
        mainType: "Allié",
        name: "gelee menthe",
      }),
    ).toBe(false);
    expect(
      matchesPickFilter(gelee("Gelée Bleue"), {
        mainType: "Allié",
        name: "gelee menthe",
      }),
    ).toBe(false);
  });

  it("filtre sub SEUL (sans mainType) : « un Parchemin » matche Action ET Équipement", () => {
    const act = {
      id: "p1",
      name: "Parchemin de Sagesse",
      mainType: "Action",
      subTypes: ["Parchemin"],
    } as unknown as Card;
    const eq = {
      id: "p2",
      name: "Parchemin Cadre",
      mainType: "Équipement",
      subTypes: ["Parchemin"],
    } as unknown as Card;
    expect(matchesPickFilter(act, { sub: "parchemin" })).toBe(true);
    expect(matchesPickFilter(eq, { sub: "parchemin" })).toBe(true);
  });
});
