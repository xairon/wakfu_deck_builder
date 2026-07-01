/**
 * Vague W35 — PRIMITIVE #3 : effets de REMPLACEMENT (prévention de Dommages).
 * Nouvelle StaticAbility `damagePreventionAura` : tant que la source est en jeu,
 * les Dommages ENTRANTS sur un bénéficiaire (relatif au contrôleur de la source)
 * sont réduits — lue au point de passage unique `reduceDamage`, HORS combat aussi.
 * Couvre le DSL (2 formes : préfixe « Tant que <self> dans le Monde » optionnel ;
 * « à 0 » → all vs « de N » → n ; « votre Héros » vs « vos <Famille> ») et la
 * résolution (`reduceDamage` : réduction ciblée, non-cibles épargnées, source hors
 * jeu inerte). Effets réels : Allister (bouclier Héros total), Donjon des
 * Craqueleurs (−1 aux Craqueleurs). « approximation … worse than manual ».
 */
import { describe, it, expect } from "vitest";
import { compileStaticEffectText, reduceDamage } from "@/game/rules";
import {
  HERO_A,
  HERO_B,
  bringToMonde,
  ctxOf,
  fixture,
  instId,
  makeAlly,
} from "../../__tests__/harness";

// ═══════════════════════════════ DSL ═══════════════════════════════
describe("DSL — damagePreventionAura", () => {
  it("Allister : « Tant que <self> … à votre Héros sont réduits à 0 » → all + controllerHero", () => {
    expect(
      compileStaticEffectText(
        "Tant qu'Allister est dans le Monde, tous les Dommages sur le point d'être infligés à votre Héros sont réduits à 0.",
        "Allister",
      ),
    ).toEqual({
      trigger: "static",
      static: {
        kind: "damagePreventionAura",
        all: true,
        to: { kind: "controllerHero" },
      },
      ops: [],
    });
  });

  it("Donjon (sans préfixe) : « … à vos Craqueleurs sont réduits de 1 » → n + famille", () => {
    expect(
      compileStaticEffectText(
        "Tous les Dommages sur le point d'être infligés à vos Craqueleurs sont réduits de 1.",
        "Donjon des Craqueleurs",
      ),
    ).toEqual({
      trigger: "static",
      static: {
        kind: "damagePreventionAura",
        n: 1,
        to: { kind: "controlledAllies", sub: "Craqueleur" },
      },
      ops: [],
    });
  });

  it("« vos Alliés » générique (sans Famille) → controlledAllies sans sub", () => {
    expect(
      compileStaticEffectText(
        "Tous les Dommages sur le point d'être infligés à vos Alliés sont réduits de 2.",
        "X",
      ),
    ).toEqual({
      trigger: "static",
      static: {
        kind: "damagePreventionAura",
        n: 2,
        to: { kind: "controlledAllies" },
      },
      ops: [],
    });
  });

  it("STRICT : préfixe « Tant que <autre carte> … » (sujet ≠ self) → non compilé", () => {
    expect(
      compileStaticEffectText(
        "Tant que Bidule est dans le Monde, tous les Dommages sur le point d'être infligés à votre Héros sont réduits à 0.",
        "Allister",
      ),
    ).toBeNull();
  });

  it("STRICT : Famille inconnue (« à vos Bidules ») → non compilé", () => {
    expect(
      compileStaticEffectText(
        "Tous les Dommages sur le point d'être infligés à vos Bidules sont réduits de 1.",
        "X",
      ),
    ).toBeNull();
  });

  it("STRICT : durée TOUR (« Jusqu'à la fin du tour, … ») → non compilé (aura continue seulement)", () => {
    expect(
      compileStaticEffectText(
        "Jusqu'à la fin du tour, tous les Dommages sur le point d'être infligés à votre Héros sont réduits à 0.",
        "Zorglub",
      ),
    ).toBeNull();
  });
});

// ═══════════════════════ Résolution (reduceDamage) ═══════════════════════
function auraCard(id: string, ability: unknown) {
  const c = makeAlly(id);
  c.effects = [
    {
      description: `[${id}]`,
      compiled: { trigger: "static", static: ability as never, ops: [] },
    },
  ];
  return c;
}

describe("reduceDamage — application des auras de prévention", () => {
  it("bouclier Héros total (all, controllerHero) : Dommages au Héros de l'acteur → 0, adverse épargné", () => {
    const allister = auraCard("allister", {
      kind: "damagePreventionAura",
      all: true,
      to: { kind: "controllerHero" },
    });
    const f = fixture([allister]);
    bringToMonde(f, "A", instId("A", 0));
    const hit = (targetId: string) => ({
      targetId,
      amount: 5,
      element: "feu",
      combat: false,
    });
    // Héros de A (contrôleur de l'aura) → prévenu à 0
    expect(reduceDamage(ctxOf(f), hit(HERO_A))).toBe(0);
    // Héros adverse → non concerné
    expect(reduceDamage(ctxOf(f), hit(HERO_B))).toBe(5);
  });

  it("réduction de Famille (n, controlledAllies sub) : −1 aux Craqueleurs de l'acteur uniquement", () => {
    const donjon = auraCard("donjon", {
      kind: "damagePreventionAura",
      n: 1,
      to: { kind: "controlledAllies", sub: "Craqueleur" },
    });
    const craqueleur = makeAlly("craq");
    craqueleur.subTypes = ["Craqueleur"];
    const autre = makeAlly("autre"); // Allié A non-Craqueleur
    const f = fixture([donjon, craqueleur, autre]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "A", instId("A", 1));
    bringToMonde(f, "A", instId("A", 2));
    const hit = (targetId: string) => ({
      targetId,
      amount: 3,
      element: "feu",
      combat: false,
    });
    expect(reduceDamage(ctxOf(f), hit(instId("A", 1)))).toBe(2); // Craqueleur → −1
    expect(reduceDamage(ctxOf(f), hit(instId("A", 2)))).toBe(3); // non-Craqueleur → inchangé
  });

  it("source HORS jeu (pas dans le Monde/Havre-Sac) : aucune prévention", () => {
    const allister = auraCard("allister", {
      kind: "damagePreventionAura",
      all: true,
      to: { kind: "controllerHero" },
    });
    const f = fixture([allister]); // laissée en Pioche (pas bringToMonde)
    const hit = { targetId: HERO_A, amount: 5, element: "feu", combat: false };
    expect(reduceDamage(ctxOf(f), hit)).toBe(5);
  });
});

// ═════════ Sens DEALER : Dommages imprévenables (incrément 2) ═════════
describe("DSL — damageUnpreventable", () => {
  it("« Les Dommages infligés par <self> ne peuvent pas être réduits » → damageUnpreventable", () => {
    expect(
      compileStaticEffectText(
        "Les Dommages infligés par le Chevalier Ténèbres ne peuvent pas être réduits.",
        "Chevalier Ténèbres",
      ),
    ).toEqual({
      trigger: "static",
      static: { kind: "damageUnpreventable" },
      ops: [],
    });
  });

  it("STRICT : forme PORTEUR (« infligés par le Porteur de … ») → non compilé", () => {
    expect(
      compileStaticEffectText(
        "Les Dommages infligés par le Porteur du Masque du Rat Noir ne peuvent pas être réduits.",
        "Masque du Rat Noir",
      ),
    ).toBeNull();
  });
});

describe("reduceDamage — sens dealer (source)", () => {
  it("damageUnpreventable : les Dommages de la source contournent la Résistance", () => {
    const src = auraCard("chevalier", { kind: "damageUnpreventable" });
    const dur = makeAlly("dur", { resist: ["Feu", 2] });
    const f = fixture([src], [dur]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "B", instId("B", 0));
    const hit = {
      targetId: instId("B", 0),
      amount: 5,
      element: "feu",
      combat: true,
      sourceId: instId("A", 0),
    };
    // Sans imprévenable : 5 − 2 (Résistance) = 3. Avec : 5 (bypass total).
    expect(reduceDamage(ctxOf(f), hit)).toBe(5);
  });
});
