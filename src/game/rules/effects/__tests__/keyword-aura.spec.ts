/**
 * AURA DE MOT-CLÉ (805.2) — « Tant que <self> est dans le Monde, vos [autres]
 * Alliés [Famille] [et Héros] gagnent <Mot-clé>. ».
 *
 * Pouvoir CONTINU (StaticAbility kind `keywordAura`) miroir EXACT de `forceAura`,
 * mais octroyant un mot-clé de COMBAT FONCTIONNEL (Géant/Agilité/Agressivité/
 * Tacle) au lieu de Force. Tant que la SOURCE est en jeu, les créatures du même
 * contrôleur correspondant au scope (sub / heroes — mêmes règles de sélection que
 * forceAura) gagnent le mot-clé, lu par `effectiveKeywords` → légalité / résolution
 * de combat.
 *
 * STRICT (« an approximation of gameplay is worse than a manual effect ») : seuls
 * les mots-clés CÂBLÉS sont compilés ; octroyer un mot-clé inerte (Fantôme,
 * Défense, Renfort…) serait un no-op → manuel.
 */
import { describe, it, expect } from "vitest";
import type { AllyCard, CardElement } from "@/types/cards";
import { compileStaticEffectText } from "../dsl";
import { effectiveKeywords } from "../keywords";
import { eligibleBlockers } from "../../legality";
import {
  bringToMonde,
  ctxOf,
  fixture,
  instId,
  makeAlly,
  HERO_A,
} from "../../__tests__/harness";

/** Allié-source d'aura de mot-clé (texte « Tant que … gagnent <kw> »). */
function auraCard(
  id: string,
  name: string,
  text: string,
  opts: { element?: CardElement; subTypes?: string[] } = {},
): AllyCard {
  return {
    ...makeAlly(id, { niveau: 1, element: opts.element ?? "Feu" }),
    name,
    ...(opts.subTypes ? { subTypes: opts.subTypes } : {}),
    effects: [{ description: text }],
  };
}

/** Allié bénéficiaire d'une Famille donnée. */
function familyAlly(id: string, subTypes: string[]): AllyCard {
  return { ...makeAlly(id, { niveau: 1, element: "Feu" }), subTypes };
}

// ── Volet 1 : DSL (compileStaticEffectText) ──────────────────────────────────

describe("DSL — keywordAura (« Tant que <self> est dans le Monde, vos … gagnent <kw> »)", () => {
  it("« … tous vos Pirates gagnent Agilité » → keywordAura{Agilité, sub:pirate} (Bash Skwal)", () => {
    const c = compileStaticEffectText(
      "Tant que Bash Skwal est dans le Monde, tous vos Pirates gagnent Agilité.",
      "Bash Skwal",
    );
    expect(c).toEqual({
      trigger: "static",
      static: { kind: "keywordAura", keyword: "Agilité", sub: "pirate" },
      ops: [],
    });
  });

  it("« … toutes vos Gelées gagnent Agilité » → keywordAura{Agilité, sub:gelee} (Gelée Royale Citron)", () => {
    const c = compileStaticEffectText(
      "Tant que la Gelée Royale Citron est dans le Monde, toutes vos Gelées gagnent Agilité.",
      "Gelée Royale Citron",
    );
    expect(c?.static).toEqual({
      kind: "keywordAura",
      keyword: "Agilité",
      sub: "gelee",
    });
  });

  it("« … tous vos Pirates gagnent Tacle » → keywordAura{Tacle, sub:pirate} (Boomba)", () => {
    const c = compileStaticEffectText(
      "Tant que le Boomba est dans le Monde, tous vos Pirates gagnent Tacle.",
      "Boomba",
    );
    expect(c?.static).toEqual({
      kind: "keywordAura",
      keyword: "Tacle",
      sub: "pirate",
    });
  });

  it("« vos autres Alliés gagnent Géant » → keywordAura{Géant, excludeSource} (forme spec, sans Famille)", () => {
    const c = compileStaticEffectText(
      "Tant que Truc est dans le Monde, vos autres Alliés gagnent Géant.",
      "Truc",
    );
    expect(c?.static).toEqual({
      kind: "keywordAura",
      keyword: "Géant",
      excludeSource: true,
    });
  });

  it("« vos autres Alliés Bouftous et Héros gagnent Agressivité » → keywordAura{Agressivité, sub, heroes, excludeSource}", () => {
    const c = compileStaticEffectText(
      "Tant que Truc est dans le Monde, vos autres Alliés Bouftous et Héros gagnent Agressivité.",
      "Truc",
    );
    expect(c?.static).toEqual({
      kind: "keywordAura",
      keyword: "Agressivité",
      sub: "bouftou",
      heroes: true,
      excludeSource: true,
    });
  });
});

describe("DSL — keywordAura négatifs (fidélité)", () => {
  it("ne compile PAS un mot-clé INERTE (« … gagnent Fantôme »)", () => {
    expect(
      compileStaticEffectText(
        "Tant que Truc est dans le Monde, vos Alliés gagnent Fantôme.",
        "Truc",
      ),
    ).toBeNull();
  });

  it("ne compile PAS « … gagnent Défense / Renfort » (mots-clés non câblés)", () => {
    expect(
      compileStaticEffectText(
        "Tant que Truc est dans le Monde, tous vos Alliés gagnent Défense.",
        "Truc",
      ),
    ).toBeNull();
    expect(
      compileStaticEffectText(
        "Tant que Truc est dans le Monde, vos Alliés gagnent Renfort.",
        "Truc",
      ),
    ).toBeNull();
  });

  it("ne compile PAS une Famille ambiguë en remplacement (« vos Iops gagnent Agilité »)", () => {
    expect(
      compileStaticEffectText(
        "Tant que Truc est dans le Monde, tous vos Iops gagnent Agilité.",
        "Truc",
      ),
    ).toBeNull();
  });

  it("ne compile PAS si le sujet n'est pas la carte elle-même", () => {
    expect(
      compileStaticEffectText(
        "Tant que le Porteur de Truc est dans le Monde, vos Alliés gagnent Géant.",
        "Truc",
      ),
    ).toBeNull();
  });

  it("ne capture PAS forceAura (« gagnent +2 en Force ») comme keywordAura", () => {
    const c = compileStaticEffectText(
      "Tant que Truc est dans le Monde, vos autres Alliés gagnent +2 en Force.",
      "Truc",
    );
    expect(c?.static?.kind).toBe("forceAura");
  });
});

// ── Volet 2 : moteur (effectiveKeywords) — octroi fonctionnel ─────────────────

describe("rules/keywords — keywordAura confère le mot-clé câblé aux bénéficiaires", () => {
  it("octroie Agilité aux Alliés de la Famille (source en jeu) — et la retire quand la source part", () => {
    const aura = auraCard(
      "src",
      "Bash Skwal",
      "Tant que Bash Skwal est dans le Monde, tous vos Pirates gagnent Agilité.",
    );
    const pirate = familyAlly("pir", ["Pirate"]);
    const f = fixture([aura, pirate]);
    // source PAS en jeu → pas d'Agilité
    bringToMonde(f, "A", instId("A", 1)); // pirate en jeu
    expect(effectiveKeywords(ctxOf(f), instId("A", 1)).agilite).toBe(false);
    // source en jeu → Agilité conférée
    bringToMonde(f, "A", instId("A", 0)); // aura en jeu
    expect(effectiveKeywords(ctxOf(f), instId("A", 1)).agilite).toBe(true);
  });

  it("Agilité conférée par l'aura → le bénéficiaire (attaquant) ne peut être bloqué que par Agilité (704)", () => {
    const aura = auraCard(
      "src",
      "Bash Skwal",
      "Tant que Bash Skwal est dans le Monde, tous vos Pirates gagnent Agilité.",
    );
    const pirate = familyAlly("pir", ["Pirate"]); // attaquant (A)
    const blocker = familyAlly("blk", ["Bouftou"]); // bloqueur sans Agilité (B)
    const f = fixture([aura, pirate], [blocker]);
    bringToMonde(f, "A", instId("A", 0)); // aura
    bringToMonde(f, "A", instId("A", 1)); // pirate attaquant
    bringToMonde(f, "B", instId("B", 0)); // bloqueur adverse
    const ctx = ctxOf(f);
    // attaquant possède Agilité (par aura) → un bloqueur sans Agilité est exclu.
    const blockers = eligibleBlockers(
      ctx,
      "B",
      { kind: "ally", instanceId: instId("A", 1) },
      instId("A", 1),
    );
    expect(blockers).not.toContain(instId("B", 0));
  });

  it("ne confère PAS le mot-clé à un Allié d'une autre Famille", () => {
    const aura = auraCard(
      "src",
      "Boomba",
      "Tant que le Boomba est dans le Monde, tous vos Pirates gagnent Tacle.",
    );
    const other = familyAlly("oth", ["Bouftou"]);
    const f = fixture([aura, other]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "A", instId("A", 1));
    expect(effectiveKeywords(ctxOf(f), instId("A", 1)).tacle).toBe(false);
  });

  it("ne confère PAS le mot-clé à l'adversaire (« vos … »)", () => {
    const aura = auraCard(
      "src",
      "Bash Skwal",
      "Tant que Bash Skwal est dans le Monde, tous vos Pirates gagnent Agilité.",
    );
    const oppPirate = familyAlly("opir", ["Pirate"]);
    const f = fixture([aura], [oppPirate]);
    bringToMonde(f, "A", instId("A", 0)); // aura contrôlée par A
    bringToMonde(f, "B", instId("B", 0)); // pirate adverse (B)
    expect(effectiveKeywords(ctxOf(f), instId("B", 0)).agilite).toBe(false);
  });

  it("« vos AUTRES Alliés » (excludeSource) : la source ne se confère pas l'aura", () => {
    const aura = auraCard(
      "src",
      "Truc",
      "Tant que Truc est dans le Monde, vos autres Alliés gagnent Géant.",
    );
    const other = familyAlly("oth", []);
    const f = fixture([aura, other]);
    bringToMonde(f, "A", instId("A", 0)); // source
    bringToMonde(f, "A", instId("A", 1)); // autre Allié
    const ctx = ctxOf(f);
    // la source elle-même ne gagne PAS Géant…
    expect(effectiveKeywords(ctx, instId("A", 0)).geant).toBe(false);
    // …mais l'autre Allié, oui.
    expect(effectiveKeywords(ctx, instId("A", 1)).geant).toBe(true);
  });

  it("aura « … et Héros » : votre Héros bénéficie aussi (pas si l'aura est mono-Allié)", () => {
    const withHero = auraCard(
      "s1",
      "Truc",
      "Tant que Truc est dans le Monde, vos autres Alliés et Héros gagnent Géant.",
    );
    const f = fixture([withHero]);
    bringToMonde(f, "A", instId("A", 0));
    expect(effectiveKeywords(ctxOf(f), HERO_A).geant).toBe(true);

    const noHero = auraCard(
      "s2",
      "Bidule",
      "Tant que Bidule est dans le Monde, vos autres Alliés gagnent Géant.",
    );
    const g = fixture([noHero]);
    bringToMonde(g, "A", instId("A", 0));
    expect(effectiveKeywords(ctxOf(g), HERO_A).geant).toBe(false);
  });
});
