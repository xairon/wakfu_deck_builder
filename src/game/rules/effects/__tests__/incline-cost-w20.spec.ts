/**
 * Vague W20 — routage des POUVOIRS À COÛT D'INCLINAISON DE SOI et nouvelles
 * formes de grammaire (putInPlay variante d'ordre, destruction par Famille nue).
 *
 * Trois volets :
 *  1) COÛT D'INCLINAISON DE SOI « Inclinez [cette carte] : CORPS » — la phrase
 *     de coût explicite l'inclinaison de la SOURCE (le coût par défaut d'un
 *     pouvoir à inclinaison) ; elle ne produit AUCUNE op (pas de cost field),
 *     seul le CORPS est compilé. `isInclineCostText` route vers le parseur tap
 *     même sans `requiresIncline`. NÉGATIFS : le coût PAYÉ « Inclinez un de
 *     vos … » (actor/costTap) et l'actor-binding « … : il/elle … » NE sont PAS
 *     mis-routés sur cette voie.
 *  2) putInPlay — la clause de Niveau est admise AVANT « de votre choix »
 *     (variante d'ordre « l'Allié de Niveau 1 de votre choix … »).
 *  3) destroyTarget — Famille nue « Détruisez le Démon de votre choix » →
 *     destroyTarget Allié + sub ; un mot hors ALLIED_FAMILIES reste manuel.
 */
import { describe, it, expect } from "vitest";
import type { CompiledEffect } from "@/types/cards";
import {
  compileTapEffectText,
  compileActionEffectText,
  compileTurnStartEffectText,
  isInclineCostText,
  isPaidCostText,
} from "../dsl";

// ── Volet 1 : coût d'inclinaison de soi ──────────────────────────────────────
describe("DSL — coût d'inclinaison de soi (compileTapEffectText)", () => {
  it("« Inclinez cette carte : Piochez une carte. » → onTap, draw, AUCUN cost", () => {
    const c = compileTapEffectText(
      "Inclinez cette carte : Piochez une carte.",
      "Carte X",
    );
    expect(c).toEqual<CompiledEffect>({
      trigger: "onTap",
      ops: [{ op: "draw", n: 1 }],
    });
    // l'inclinaison de la source EST le coût par défaut → pas de cost field.
    expect(c?.cost).toBeUndefined();
  });

  it("« Inclinez <nom de la carte> : CORPS » (sujet = soi) compile le corps", () => {
    const c = compileTapEffectText(
      "Inclinez le Tambour Magique : Votre Héros gagne 2 PV.",
      "Tambour Magique",
    );
    expect(c).toEqual<CompiledEffect>({
      trigger: "onTap",
      ops: [{ op: "heroGainPv", n: 2 }],
    });
  });

  it("« Inclinez ce Tambour : CORPS » (ce <type>) compile le corps", () => {
    const c = compileTapEffectText(
      "Inclinez ce Tambour : Piochez une carte.",
      "Tambour Magique",
    );
    expect(c?.ops).toEqual([{ op: "draw", n: 1 }]);
    expect(c?.cost).toBeUndefined();
  });

  it("REJET : corps non mappé (« Ajoutez un Ether … ») reste manuel", () => {
    const c = compileTapEffectText(
      "Inclinez cette carte : Ajoutez un Ether sur la Coiffe.",
      "Coiffe",
    );
    expect(c).toBeNull();
  });

  it("REJET : coût d'inclinaison de soi avec corps actor-binding « : il … »", () => {
    // « Inclinez cette carte : il inflige … » n'a pas de sens (le sujet du corps
    // EST la source, pas une créature payée) → manuel.
    const c = compileTapEffectText(
      "Inclinez cette carte : Il inflige 1 Dommage à l'Allié de votre choix.",
      "Carte X",
    );
    expect(c).toBeNull();
  });

  it("NON mis-routé : coût PAYÉ « Inclinez un de vos Alliés : … » reste sur la voie costTap", () => {
    // La forme paid-cost garde son op de coût (costTapControlled) — elle n'est
    // PAS aplatie en simple inclinaison de soi.
    const c = compileTapEffectText(
      "Inclinez un de vos Alliés : Piochez une carte.",
      "Carte X",
    );
    expect(c).toEqual<CompiledEffect>({
      trigger: "onTap",
      cost: "paidOps",
      ops: [
        { op: "costTapControlled", zones: ["monde", "havreSac"] },
        { op: "draw", n: 1 },
      ],
    });
  });

  it("NON mis-routé : coût PAYÉ actor-binding « Inclinez un de vos … : il … » garde actor:costTarget", () => {
    const c = compileTapEffectText(
      "Inclinez un de vos Alliés ou Héros : Il inflige sa Force en Dommages à l'Allié de votre choix.",
      "Agression",
    );
    expect(c).toMatchObject({
      trigger: "onTap",
      cost: "paidOps",
      actor: "costTarget",
    });
  });

  it("isInclineCostText : vrai sur « Inclinez <soi> : … », faux sur paid-cost et cible nue", () => {
    expect(isInclineCostText("Inclinez cette carte : Piochez une carte.")).toBe(
      true,
    );
    // paid-cost « un de vos Alliés » → routé ailleurs (isPaidCostText)
    expect(
      isInclineCostText("Inclinez un de vos Alliés : Piochez une carte."),
    ).toBe(false);
    expect(
      isPaidCostText("Inclinez un de vos Alliés : Piochez une carte."),
    ).toBe(true);
    // « Inclinez l'Allié … de votre choix » (sans « : ») = cible, pas un coût
    expect(isInclineCostText("Inclinez l'Allié de votre choix.")).toBe(false);
  });
});

// ── Volet 2 : putInPlay — variante d'ordre du Niveau ─────────────────────────
describe("DSL — putInPlay, Niveau avant « de votre choix »", () => {
  it("« mettre en jeu l'Allié de Niveau 1 de votre choix depuis votre Défausse » → exactLevel", () => {
    const c = compileTurnStartEffectText(
      "Au début de votre tour, vous pouvez mettre en jeu l'Allié de Niveau 1 de votre choix depuis votre Défausse.",
      "Bom d'Utygr",
    );
    expect(c).toEqual<CompiledEffect>({
      trigger: "onTurnStart",
      optional: true,
      ops: [
        { op: "putInPlay", from: "defausse", what: "Allié", exactLevel: 1 },
      ],
    });
  });

  it("« … l'Allié de Niveau inférieur ou égal à 3 de votre choix depuis votre Défausse » → maxLevel", () => {
    const c = compileTurnStartEffectText(
      "Au début de votre tour, vous pouvez mettre en jeu l'Allié de Niveau inférieur ou égal à 3 de votre choix depuis votre Défausse.",
      "Bom d'Utygr",
    );
    expect(c?.ops).toEqual([
      { op: "putInPlay", from: "defausse", what: "Allié", maxLevel: 3 },
    ]);
  });

  it("RÉGRESSION : la clause de Niveau APRÈS « de votre choix » fonctionne toujours", () => {
    const c = compileActionEffectText(
      "Mettez en jeu un Allié de votre choix de Niveau inférieur ou égal à 3 de votre main.",
      "X",
    );
    expect(c?.ops).toEqual([
      { op: "putInPlay", from: "main", what: "Allié", maxLevel: 3 },
    ]);
  });

  it("RÉGRESSION : forme nue par Famille (« un Monstre de votre main ») inchangée", () => {
    const c = compileActionEffectText(
      "Mettez en jeu un Monstre de votre main.",
      "X",
    );
    expect(c?.ops).toEqual([
      { op: "putInPlay", from: "main", what: "Allié", sub: "monstre" },
    ]);
  });
});

// ── Volet 3 : destroyTarget par Famille nue ──────────────────────────────────
describe("DSL — destruction par Famille nue", () => {
  it("« Détruisez le Démon de votre choix. » → destroyTarget Allié sub:demon", () => {
    const c = compileActionEffectText(
      "Détruisez le Démon de votre choix.",
      "X",
    );
    expect(c?.ops).toEqual([
      { op: "destroyTarget", what: "Allié", sub: "demon", zones: ["monde"] },
    ]);
  });

  it("« Détruisez la Gelée de votre choix dans le Monde ou dans un Havre-Sac » → zones étendues", () => {
    const c = compileActionEffectText(
      "Détruisez la Gelée de votre choix dans le Monde ou dans un Havre-Sac.",
      "X",
    );
    expect(c?.ops).toEqual([
      {
        op: "destroyTarget",
        what: "Allié",
        sub: "gelee",
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("REJET : un mot hors ALLIED_FAMILIES (« le Roi ») reste manuel", () => {
    expect(
      compileActionEffectText("Détruisez le Roi de votre choix.", "X"),
    ).toBeNull();
  });

  it("RÉGRESSION : « Détruisez la Zone de votre choix » (type racine) inchangé", () => {
    const c = compileActionEffectText("Détruisez la Zone de votre choix.", "X");
    expect(c?.ops).toEqual([
      { op: "destroyTarget", what: "Zone", zones: ["monde"] },
    ]);
  });
});

// ── Volet 4 : returnToHand, variante sujet-en-tête « … retourne dans la main » ─
describe("DSL — returnToHand (« L'Allié … retourne dans la main de son propriétaire »)", () => {
  it("forme nue → returnToHand (jumeau de « Renvoyez … »)", () => {
    const c = compileActionEffectText(
      "L'Allié de votre choix retourne dans la main de son propriétaire.",
      "X",
    );
    expect(c?.ops).toEqual([
      { op: "returnToHand", zones: ["monde", "havreSac"] },
    ]);
  });

  it("« ou Héros » → heroes ; « adverse » → controller opponent", () => {
    const c = compileActionEffectText(
      "L'Allié ou Héros adverse de votre choix retourne dans la main de son propriétaire.",
      "X",
    );
    expect(c?.ops).toEqual([
      {
        op: "returnToHand",
        heroes: true,
        controller: "opponent",
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("sous coût de sacrifice « Détruisez [soi] : … retourne … » → sacrificeSelf + returnToHand", () => {
    const c = compileTapEffectText(
      "Détruisez Deyko Nexion : L'Allié de votre choix retourne dans la main de son propriétaire.",
      "Deyko Nexion",
    );
    expect(c).toEqual<CompiledEffect>({
      trigger: "onTap",
      cost: "sacrificeSelf",
      ops: [{ op: "returnToHand", zones: ["monde", "havreSac"] }],
    });
  });

  it("REJET : clause résiduelle (« … attaquant … dans le Monde … ») reste manuelle", () => {
    expect(
      compileActionEffectText(
        "L'Allié attaquant de votre choix dans le Monde retourne dans la main de son propriétaire.",
        "X",
      ),
    ).toBeNull();
  });
});
