/**
 * Vague « RÉCENCE DE JEU PAR CATÉGORIE » (Volet B) — généralise le mécanisme
 * Fécaline (jeton de récence sur le Héros du joueur, ÉCRASÉ à chaque jeu,
 * purgé au changement de tour) à toutes les catégories de cartes jouées :
 * `recentPlay<Kind>` (action / sort / parchemin / equipement / allie), lu par
 * la restriction `playCondition { cond: "recentlyPlayedKind", kinds, who }` —
 * `who: "self"` (« vous venez de jouer … ») lit VOTRE Héros, `who: "other"`
 * (« un adversaire / un autre joueur vient de jouer … ») lit le Héros ADVERSE.
 * En 1v1, « un adversaire » = l'adversaire. Clause STRICTE : toute autre
 * récence (« vient de détruire », « vient de fabriquer »…) reste manuelle.
 */
import { describe, it, expect } from "vitest";
import { compileActionEffectText, compileTapEffectText } from "../dsl";

describe("récence par catégorie — DSL (clause « que lorsque … vient de jouer »)", () => {
  it("Bébé Crocodaille : pouvoir gated « un adversaire vient de jouer une Action »", () => {
    const c = compileTapEffectText(
      "Piochez une carte. N'utilisez ce pouvoir que lorsqu'un adversaire vient de jouer une Action.",
      "Bébé Crocodaille",
    );
    expect(c).toEqual({
      trigger: "onTap",
      playCondition: {
        cond: "recentlyPlayedKind",
        kinds: ["action"],
        who: "other",
      },
      ops: [{ op: "draw", n: 1 }],
    });
  });

  it("Buveur : « un autre joueur vient de jouer un Sort ou un Parchemin »", () => {
    const c = compileTapEffectText(
      "Piochez une carte. Ne jouez ce pouvoir que lorsqu'un autre joueur vient de jouer un Sort ou un Parchemin.",
      "Buveur",
    );
    expect(c).toEqual({
      trigger: "onTap",
      playCondition: {
        cond: "recentlyPlayedKind",
        kinds: ["sort", "parchemin"],
        who: "other",
      },
      ops: [{ op: "draw", n: 1 }],
    });
  });

  it("Tolot : « vous venez de jouer une carte Équipement » → who self", () => {
    const c = compileTapEffectText(
      "Piochez une carte. N'utilisez ce pouvoir que lorsque vous venez de jouer une carte Équipement.",
      "Tolot",
    );
    expect(c).toEqual({
      trigger: "onTap",
      playCondition: {
        cond: "recentlyPlayedKind",
        kinds: ["equipement"],
        who: "self",
      },
      ops: [{ op: "draw", n: 1 }],
    });
  });

  it("Sagesse de Silouate (Action) : tuteur Unique + récence adverse Sort/Parchemin", () => {
    const c = compileActionEffectText(
      "Cherchez une carte Unique dans votre Pioche, révélez-la et prenez-la en main, puis mélangez votre Pioche. Ne jouez ce pouvoir que lorsqu'un autre joueur vient de jouer un Sort ou un Parchemin.",
      "Sagesse de Silouate",
    );
    expect(c).toEqual({
      trigger: "onPlay",
      playCondition: {
        cond: "recentlyPlayedKind",
        kinds: ["sort", "parchemin"],
        who: "other",
      },
      ops: [
        { op: "searchDeck", sub: "unique", dest: "main" },
        { op: "shuffleDeck" },
      ],
    });
  });

  it("Démons et Merveilles : « Ne jouez <nom> que lorsque vous venez de jouer un Allié »", () => {
    // Le corps réel de la carte n'est pas dans le périmètre — on verrouille la
    // CLAUSE avec un corps simple.
    const c = compileActionEffectText(
      "Piochez une carte. Ne jouez Démons et Merveilles que lorsque vous venez de jouer un Allié .",
      "Démons et Merveilles",
    );
    expect(c).toEqual({
      trigger: "onPlay",
      playCondition: {
        cond: "recentlyPlayedKind",
        kinds: ["allie"],
        who: "self",
      },
      ops: [{ op: "draw", n: 1 }],
    });
  });

  it("Sagesse de Silouate (texte réel) : tuteur Unique + récence adverse « carte Unique »", () => {
    const c = compileActionEffectText(
      "Cherchez une carte Unique dans votre Pioche, révélez-la et prenez-la en main, puis mélangez votre Pioche. Ne jouez ce pouvoir que lorsqu'un autre joueur vient de jouer une carte Unique.",
      "Sagesse de Silouate",
    );
    expect(c).toEqual({
      trigger: "onPlay",
      playCondition: {
        cond: "recentlyPlayedKind",
        kinds: ["unique"],
        who: "other",
      },
      ops: [
        { op: "searchDeck", sub: "unique", dest: "main" },
        { op: "shuffleDeck" },
      ],
    });
  });

  it("Démons et Merveilles : effet RESTRICTION SEULE → compiled {playCondition, ops: []}", () => {
    // La restriction est un EFFET SÉPARÉ sur la carte (le corps vit dans un
    // autre effet, encore manuel) : la compiler gate RÉELLEMENT le jeu de la
    // carte (playConditionReason scanne tous les effets), sans rien résoudre.
    const c = compileActionEffectText(
      "Ne jouez Démons et Merveilles que lorsque vous venez de jouer un Allié .",
      "Démons et Merveilles",
    );
    expect(c).toEqual({
      trigger: "onPlay",
      playCondition: {
        cond: "recentlyPlayedKind",
        kinds: ["allie"],
        who: "self",
      },
      ops: [],
    });
  });

  it("récences NON « jouer » (détruire / fabriquer / gagner XP) → manuel", () => {
    expect(
      compileActionEffectText(
        "Piochez une carte. Ne jouez cette carte que lorsque vous venez de détruire un Allié Bandit.",
        "Avis de recherche",
      ),
    ).toBeNull();
    expect(
      compileTapEffectText(
        "Piochez une carte. N'utilisez ce pouvoir que lorsque vous venez de fabriquer un Équipement.",
        "Shak Shaka",
      ),
    ).toBeNull();
  });
});
