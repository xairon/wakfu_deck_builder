/**
 * Lot B — pouvoirs continus (805 / 812.2) : `staticAbilitiesOf`,
 * `cannotBlock`, `heroLevel` et la composition de la Force effective
 * (base|taille de main + auras + « tant qu'il bloque » + jetons, clamp ≥ 0).
 */
import { describe, expect, it } from "vitest";
import type { AllyCard, StaticAbility } from "@/types/cards";
import {
  cannotAttackOrBlock,
  cannotBlock,
  cannotCarryEquipment,
  effectiveForce,
  heroLevel,
  resolveBuffForceTarget,
  staticAbilitiesOf,
} from "@/game/rules";
import { discard, flipLevel, move, setCounter } from "@/game";
import {
  HERO_A,
  HERO_B,
  bringToHand,
  bringToMonde,
  ctxOf,
  dispatch,
  fixture,
  instId,
  makeAlly,
  makeHero,
} from "./harness";

function withStatic(card: AllyCard, ability: StaticAbility): AllyCard {
  card.effects = [
    {
      description: "(pouvoir continu de test)",
      compiled: { trigger: "static", static: ability, ops: [] },
    },
  ];
  return card;
}

describe("rules/modifiers — lecture des pouvoirs continus", () => {
  it("devrait lire la forme compilée et retomber sur la grammaire texte", () => {
    const compiled = withStatic(makeAlly("c0"), { kind: "cannotBlock" });
    expect(staticAbilitiesOf(compiled)).toEqual([{ kind: "cannotBlock" }]);
    // repli runtime : texte réel non compilé, sujet = la carte
    const jice = makeAlly("j0");
    jice.name = "Jicé Aouaire";
    jice.effects = [{ description: "Jicé Aouaire ne peut pas bloquer." }];
    expect(staticAbilitiesOf(jice)).toEqual([{ kind: "cannotBlock" }]);
    // une note de règle (kind) n'est jamais un pouvoir continu
    const ruling = makeAlly("r0");
    ruling.name = "Jicé Aouaire";
    ruling.effects = [
      { description: "Jicé Aouaire ne peut pas bloquer.", kind: "ruling" },
    ];
    expect(staticAbilitiesOf(ruling)).toEqual([]);
  });

  it("devrait lire la face courante d'un Héros (recto n=1, verso n=2)", () => {
    const hero = makeHero("poum");
    hero.recto.effects = [
      {
        description: "réduction recto",
        compiled: {
          trigger: "static",
          static: { kind: "combatDamageReduction", n: 1 },
          ops: [],
        },
      },
    ];
    hero.verso!.effects = [
      {
        description: "réduction verso",
        compiled: {
          trigger: "static",
          static: { kind: "combatDamageReduction", n: 2 },
          ops: [],
        },
      },
    ];
    expect(staticAbilitiesOf(hero, "recto")).toEqual([
      { kind: "combatDamageReduction", n: 1 },
    ]);
    expect(staticAbilitiesOf(hero, "verso")).toEqual([
      { kind: "combatDamageReduction", n: 2 },
    ]);
  });

  it("cannotBlock : vrai seulement pour la carte au pouvoir continu", () => {
    const jice = withStatic(makeAlly("jice"), { kind: "cannotBlock" });
    const autre = makeAlly("autre");
    const f = fixture([jice, autre]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "A", instId("A", 1));
    expect(cannotBlock(ctxOf(f), instId("A", 0))).toBe(true);
    expect(cannotBlock(ctxOf(f), instId("A", 1))).toBe(false);
  });

  it("cannotAttackOrBlock implique aussi cannotBlock (volet blocage)", () => {
    const epou = withStatic(makeAlly("epou"), { kind: "cannotAttackOrBlock" });
    const autre = makeAlly("autre");
    const f = fixture([epou, autre]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "A", instId("A", 1));
    expect(cannotAttackOrBlock(ctxOf(f), instId("A", 0))).toBe(true);
    expect(cannotBlock(ctxOf(f), instId("A", 0))).toBe(true); // inclus
    expect(cannotAttackOrBlock(ctxOf(f), instId("A", 1))).toBe(false);
    expect(cannotBlock(ctxOf(f), instId("A", 1))).toBe(false);
  });

  it("cannotCarryEquipment : vrai seulement pour la carte au pouvoir continu", () => {
    const terra = withStatic(makeAlly("terra"), {
      kind: "cannotCarryEquipment",
    });
    const autre = makeAlly("autre2");
    const f = fixture([terra, autre]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "A", instId("A", 1));
    expect(cannotCarryEquipment(ctxOf(f), instId("A", 0))).toBe(true);
    expect(cannotCarryEquipment(ctxOf(f), instId("A", 1))).toBe(false);
    // n'affecte ni l'attaque ni le blocage
    expect(cannotAttackOrBlock(ctxOf(f), instId("A", 0))).toBe(false);
    expect(cannotBlock(ctxOf(f), instId("A", 0))).toBe(false);
  });

  it("heroLevel : 1 au recto, 2 au verso, 3 au compteur level", () => {
    const f = fixture([]);
    expect(heroLevel(ctxOf(f), "A")).toBe(1);
    dispatch(f, flipLevel("A", HERO_A, "verso", 2, 6));
    expect(heroLevel(ctxOf(f), "A")).toBe(2);
    dispatch(f, setCounter("A", HERO_A, "level", 3));
    expect(heroLevel(ctxOf(f), "A")).toBe(3);
  });
});

describe("rules/stats — Force effective composée (lot B)", () => {
  it("forceEqualsHandSize : la Force du Vrombyx suit la main de SON contrôleur", () => {
    const vrombyx = withStatic(makeAlly("vrombyx", { force: 0 }), {
      kind: "forceEqualsHandSize",
    });
    const f = fixture(
      [vrombyx, makeAlly("x1"), makeAlly("x2")],
      [makeAlly("y1")],
    );
    bringToMonde(f, "A", instId("A", 0));
    expect(effectiveForce(ctxOf(f), instId("A", 0))).toBe(0);
    bringToHand(f, "A", instId("A", 1));
    bringToHand(f, "A", instId("A", 2));
    expect(effectiveForce(ctxOf(f), instId("A", 0))).toBe(2);
    // la main ADVERSE ne compte pas
    bringToHand(f, "B", instId("B", 0));
    expect(effectiveForce(ctxOf(f), instId("A", 0))).toBe(2);
    // le jeton forceMod s'ajoute par-dessus la base définie
    dispatch(
      f,
      ...resolveBuffForceTarget(ctxOf(f), "A", instId("A", 0), 1).events,
    );
    expect(effectiveForce(ctxOf(f), instId("A", 0))).toBe(3);
  });

  it("forceAura : +1 à vos AUTRES Alliés Bouftous du Monde, et rien d'autre", () => {
    const chef = withStatic(makeAlly("chef", { force: 3 }), {
      kind: "forceAura",
      n: 1,
      sub: "bouftou",
    });
    chef.subTypes = ["Monstre", "Bouftou"];
    const bouftou = makeAlly("b1", { force: 2 });
    bouftou.subTypes = ["Bouftou"];
    const tofu = makeAlly("t1", { force: 2 });
    tofu.subTypes = ["Tofu"];
    const bouftouAdverse = makeAlly("badv", { force: 2 });
    bouftouAdverse.subTypes = ["Bouftou"];
    const bouftouSac = makeAlly("bsac", { force: 2 });
    bouftouSac.subTypes = ["Bouftou"];
    const f = fixture([chef, bouftou, tofu, bouftouSac], [bouftouAdverse]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "A", instId("A", 1));
    bringToMonde(f, "A", instId("A", 2));
    bringToMonde(f, "B", instId("B", 0));
    // un Bouftou au Havre-Sac n'est pas « dans le Monde »
    dispatch(
      f,
      move("A", {
        instanceId: instId("A", 3),
        from: { zone: "pioche", owner: "A" },
        to: { zone: "havreSac", owner: "A" },
        position: { at: "any" },
        visibility: { faceDown: false, visibleTo: "all" },
        preservesIdentity: false,
        orientationOnArrival: "upright",
      }),
    );
    expect(effectiveForce(ctxOf(f), instId("A", 1))).toBe(3); // Bouftou : +1
    expect(effectiveForce(ctxOf(f), instId("A", 2))).toBe(2); // Tofu : rien
    expect(effectiveForce(ctxOf(f), instId("A", 0))).toBe(3); // pas lui-même
    expect(effectiveForce(ctxOf(f), instId("B", 0))).toBe(2); // adversaire : rien
    expect(effectiveForce(ctxOf(f), instId("A", 3))).toBe(2); // Havre-Sac : rien
    // la sortie du Monde coupe l'aura immédiatement
    const chefLoc = ctxOf(f).state.instances[instId("A", 0)].location;
    dispatch(f, discard("A", instId("A", 0), chefLoc));
    expect(effectiveForce(ctxOf(f), instId("A", 1))).toBe(2);
  });

  it("forceAura SANS Famille : +N à TOUS vos autres Alliés du Monde, pas la source ni l'adversaire", () => {
    const totem = withStatic(makeAlly("totem", { force: 3 }), {
      kind: "forceAura",
      n: 2,
    });
    const bouftou = makeAlly("b1", { force: 2 });
    bouftou.subTypes = ["Bouftou"];
    const tofu = makeAlly("t1", { force: 2 });
    tofu.subTypes = ["Tofu"];
    const adverse = makeAlly("adv", { force: 2 });
    const f = fixture([totem, bouftou, tofu], [adverse]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "A", instId("A", 1));
    bringToMonde(f, "A", instId("A", 2));
    bringToMonde(f, "B", instId("B", 0));
    // sans Famille : tout Allié du Monde, quelle que soit sa Famille, +2
    expect(effectiveForce(ctxOf(f), instId("A", 1))).toBe(4); // Bouftou
    expect(effectiveForce(ctxOf(f), instId("A", 2))).toBe(4); // Tofu
    expect(effectiveForce(ctxOf(f), instId("A", 0))).toBe(3); // pas la source
    expect(effectiveForce(ctxOf(f), instId("B", 0))).toBe(2); // adversaire : rien
    // le Héros n'est PAS visé (pas de `heroes`)
    expect(effectiveForce(ctxOf(f), HERO_A)).toBe(2);
  });

  it("forceAura AVEC Héros : votre Héros (intérieur du Havre-Sac) gagne +N, pas le Héros adverse", () => {
    const totem = withStatic(makeAlly("totem", { force: 3 }), {
      kind: "forceAura",
      n: 1,
      heroes: true,
    });
    const ally = makeAlly("a1", { force: 2 });
    const f = fixture([totem, ally]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "A", instId("A", 1));
    // Allié bénéficiaire + Héros du même siège (base 2 dans le harnais recto)
    expect(effectiveForce(ctxOf(f), instId("A", 1))).toBe(3);
    expect(effectiveForce(ctxOf(f), HERO_A)).toBe(3);
    // le Héros ADVERSE ne profite jamais de votre aura
    expect(effectiveForce(ctxOf(f), HERO_B)).toBe(2);
    // un forceAura SANS `heroes` ne toucherait pas le Héros (cf. test précédent)
  });

  it("forceAura AVEC Famille + Héros : le Héros gagne même sans Famille (« Alliés Bouftous ou Héros »)", () => {
    const totem = withStatic(makeAlly("totem", { force: 3 }), {
      kind: "forceAura",
      n: 1,
      sub: "bouftou",
      heroes: true,
    });
    const bouftou = makeAlly("b1", { force: 2 });
    bouftou.subTypes = ["Bouftou"];
    const tofu = makeAlly("t1", { force: 2 });
    tofu.subTypes = ["Tofu"];
    const f = fixture([totem, bouftou, tofu]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "A", instId("A", 1));
    bringToMonde(f, "A", instId("A", 2));
    expect(effectiveForce(ctxOf(f), instId("A", 1))).toBe(3); // Bouftou : +1
    expect(effectiveForce(ctxOf(f), instId("A", 2))).toBe(2); // Tofu : rien
    expect(effectiveForce(ctxOf(f), HERO_A)).toBe(3); // Héros : +1 (pas de filtre Famille)
  });

  it("forceWhileBlocking : +2 via la posture seulement ; clamp à 0", () => {
    const bolet = withStatic(makeAlly("bolet", { force: 3 }), {
      kind: "forceWhileBlocking",
      n: 2,
    });
    const f = fixture([bolet]);
    bringToMonde(f, "A", instId("A", 0));
    expect(effectiveForce(ctxOf(f), instId("A", 0))).toBe(3);
    expect(
      effectiveForce(ctxOf(f), instId("A", 0), {
        blockers: [instId("A", 0)],
      }),
    ).toBe(5);
    // jeton négatif : la Force effective ne descend jamais sous 0
    dispatch(
      f,
      ...resolveBuffForceTarget(ctxOf(f), "A", instId("A", 0), -10).events,
    );
    expect(effectiveForce(ctxOf(f), instId("A", 0))).toBe(0);
  });
});
