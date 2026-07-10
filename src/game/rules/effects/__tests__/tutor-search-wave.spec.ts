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
import {
  compileAppearanceTriggerText,
  compileEffectText,
  compileTurnStartEffectText,
} from "../dsl";
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

describe("tuteur vague 2 — début-de-tour conditionnel + multi-types OU (DSL)", () => {
  it("Uk'Not'Allag : « Au début de votre tour, si … dans le Monde, vous pouvez chercher … »", () => {
    const c = compileTurnStartEffectText(
      "Au début de votre tour, si Uk'Not'Allag est dans le Monde, vous pouvez chercher un Allié Démon dans votre Pioche et le prendre en main. Si vous le faites, mélangez votre Pioche.",
      "Uk'Not'Allag",
    );
    expect(c).toEqual({
      trigger: "onTurnStart",
      ops: [
        {
          op: "conditional",
          cond: { cond: "selfInZone", zone: "monde" },
          optional: true,
          ops: [
            { op: "searchDeck", what: "Allié", sub: "demon", dest: "main" },
            { op: "shuffleDeck" },
          ],
        },
      ],
    });
  });

  it("« une carte Équipement ou Zone » → whatIn (union de types racines)", () => {
    const c = compileEffectText(
      "Quand le Veilleur apparaît, cherchez une carte Équipement ou Zone dans votre Pioche, révélez-la et prenez-la en main, puis mélangez votre Pioche.",
      "Veilleur",
    );
    expect(c).toEqual({
      trigger: "onArrive",
      ops: [
        { op: "searchDeck", whatIn: ["Équipement", "Zone"], dest: "main" },
        { op: "shuffleDeck" },
      ],
    });
  });

  it("Caravane Marchande : « sous votre contrôle » → watch controller self + subIn", () => {
    const c = compileAppearanceTriggerText(
      "Quand un Allié Marchand apparaît sous votre contrôle, cherchez une carte Potion ou Parchemin dans votre Pioche, révélez-la et prenez-la en main, puis mélangez votre Pioche.",
      "Caravane Marchande",
    );
    expect(c).toEqual({
      trigger: "onOtherAppears",
      watch: { mainType: "Allié", sub: "marchand", controller: "self" },
      ops: [
        { op: "searchDeck", subIn: ["potion", "parchemin"], dest: "main" },
        { op: "shuffleDeck" },
      ],
    });
  });

  it("OU mixte (racine + catégorie) → manuel (pas de devinette)", () => {
    expect(
      compileEffectText(
        "Quand le Veilleur apparaît, cherchez une carte Allié ou Potion dans votre Pioche, révélez-la et prenez-la en main, puis mélangez votre Pioche.",
        "Veilleur",
      ),
    ).toBeNull();
  });
});

describe("tuteur vague 2 — matchesPickFilter whatIn/subIn (moteur)", () => {
  const mk = (mainType: string, subs: string[]): Card =>
    ({ id: "x", name: "X", mainType, subTypes: subs }) as unknown as Card;

  it("whatIn : matche l'UN des types racines", () => {
    expect(
      matchesPickFilter(mk("Zone", []), { whatIn: ["Équipement", "Zone"] }),
    ).toBe(true);
    expect(
      matchesPickFilter(mk("Action", []), { whatIn: ["Équipement", "Zone"] }),
    ).toBe(false);
  });

  it("subIn : matche l'UN des subTypes", () => {
    expect(
      matchesPickFilter(mk("Action", ["Potion"]), {
        subIn: ["potion", "parchemin"],
      }),
    ).toBe(true);
    expect(
      matchesPickFilter(mk("Équipement", ["Parchemin"]), {
        subIn: ["potion", "parchemin"],
      }),
    ).toBe(true);
    expect(
      matchesPickFilter(mk("Action", ["Quête"]), {
        subIn: ["potion", "parchemin"],
      }),
    ).toBe(false);
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
