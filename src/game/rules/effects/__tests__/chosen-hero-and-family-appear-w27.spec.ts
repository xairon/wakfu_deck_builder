/**
 * Tranche W27 — vague de progrès FIDÈLE :
 *
 *  (1) DOMMAGES / SOIN au HÉROS « DU JOUEUR » DE VOTRE CHOIX. Certaines cartes
 *      visent le Héros d'un JOUEUR choisi, formulé « au Héros DU JOUEUR de votre
 *      choix » / « Le Héros DU JOUEUR de votre choix perd N PV » / « … regagne N
 *      PV ». C'est sémantiquement identique à « de votre choix » (éligibilité =
 *      tous les Héros en jeu, les deux contrôleurs) :
 *        - dommages → damageTarget { targetHeroOnly } ;
 *        - soin     → healHeroTarget.
 *      STRICT : toute clause résiduelle (« … qui vient de … », « N'utilisez ce
 *      pouvoir que si … ») laisse l'effet entier MANUEL.
 *
 *  (2) DÉCLENCHEUR D'APPARITION à SUJET FAMILLE NU « Quand/Chaque fois qu'un
 *      <Famille> apparaît, il/elle … » (« un Bwork apparaît »). Une Famille de
 *      créature non ambiguë (ALLIED_FAMILIES) désigne un Allié de cette Famille
 *      (même convention que pickType : « un Monstre » = Allié + sub) → watch
 *      { mainType:"Allié", sub:<famille> }. Les formes existantes « un Allié
 *      [Famille] [adverse] » restent inchangées.
 *
 * Couvre le DSL (positifs / négatifs) + un échantillon de harvest réel.
 */
import { describe, it, expect } from "vitest";
import {
  compileTapEffectText,
  compileActionEffectText,
  compileAppearanceTriggerText,
} from "../dsl";

const tapOps = (t: string, n = "Test", e = "Feu") =>
  compileTapEffectText(t, n, e)?.ops ?? null;
const actOps = (t: string, n = "Test", e = "Feu") =>
  compileActionEffectText(t, n, e)?.ops ?? null;

describe("W27 — Héros « du joueur » de votre choix : dommages (damageTarget targetHeroOnly)", () => {
  it("« Infligez 2 Dommages au Héros du joueur de votre choix. » → damageTarget heroes-only", () => {
    expect(
      actOps("Infligez 2 Dommages au Héros du joueur de votre choix."),
    ).toEqual([
      {
        op: "damageTarget",
        n: 2,
        element: "Feu",
        heroes: true,
        targetHeroOnly: true,
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("« Le Héros du joueur de votre choix perd 1 PV. » → damageTarget heroes-only n=1", () => {
    expect(actOps("Le Héros du joueur de votre choix perd 1 PV.")).toEqual([
      {
        op: "damageTarget",
        n: 1,
        element: "Feu",
        heroes: true,
        targetHeroOnly: true,
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("la forme « au Héros de votre choix » (sans « du joueur ») reste couverte (non-régression)", () => {
    expect(actOps("Infligez 3 Dommages au Héros de votre choix.")).toEqual([
      {
        op: "damageTarget",
        n: 3,
        element: "Feu",
        heroes: true,
        targetHeroOnly: true,
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("« au Héros adverse » reste damageOppHero (déterministe, non interactif)", () => {
    expect(actOps("Infligez 2 Dommages au Héros adverse.")).toEqual([
      { op: "damageOppHero", n: 2 },
    ]);
  });

  it("NÉGATIF : clause résiduelle « … qui vient de … » NE compile PAS (manuel)", () => {
    expect(
      actOps(
        "Infligez 1 Dommage au Héros du joueur de votre choix qui vient de perdre un ou plusieurs PA.",
      ),
    ).toBeNull();
  });

  it("NÉGATIF : restriction « N'utilisez ce pouvoir que si … » (phrase suivante) → manuel", () => {
    expect(
      actOps(
        "Le Héros du joueur de votre choix perd 1 PV. N'utilisez ce pouvoir que si le Porteur a payé.",
      ),
    ).toBeNull();
  });
});

describe("W27 — Héros « du joueur » de votre choix : soin (healHeroTarget)", () => {
  it("« Le Héros du joueur de votre choix regagne 3 PV. » → healHeroTarget", () => {
    expect(actOps("Le Héros du joueur de votre choix regagne 3 PV.")).toEqual([
      { op: "healHeroTarget", n: 3 },
    ]);
  });

  it("« Le Héros de votre choix regagne 2 PV. » (sans « du joueur ») reste couvert", () => {
    expect(actOps("Le Héros de votre choix regagne 2 PV.")).toEqual([
      { op: "healHeroTarget", n: 2 },
    ]);
  });

  it("NÉGATIF : « Votre Héros regagne 2 PV » reste heroGainPv (self, pas de choix)", () => {
    expect(actOps("Votre Héros regagne 2 PV.")).toEqual([
      { op: "heroGainPv", n: 2 },
    ]);
  });
});

describe("W27 — déclencheur d'apparition à sujet FAMILLE nu", () => {
  it("« Chaque fois qu'un Bwork apparaît, il inflige 1 Dommage à l'Allié ou Héros de votre choix. » → watch sub=bwork, actor=appeared", () => {
    expect(
      compileAppearanceTriggerText(
        "Chaque fois qu'un Bwork apparaît, il inflige 1 Dommage à l'Allié ou Héros de votre choix.",
        "Donjon des Bworks",
        "Neutre",
      ),
    ).toEqual({
      trigger: "onOtherAppears",
      watch: { mainType: "Allié", sub: "bwork" },
      actor: "appeared",
      ops: [
        {
          op: "damageTarget",
          n: 1,
          element: "Neutre",
          heroes: true,
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("« Quand un Tofu apparaît, piochez une carte. » (corps générique) → watch sub=tofu", () => {
    expect(
      compileAppearanceTriggerText(
        "Quand un Tofu apparaît, piochez une carte.",
        "Z",
      ),
    ).toEqual({
      trigger: "onOtherAppears",
      watch: { mainType: "Allié", sub: "tofu" },
      ops: [{ op: "draw", n: 1 }],
    });
  });

  it("non-régression : « un Allié [Famille] [adverse] » inchangé", () => {
    expect(
      compileAppearanceTriggerText(
        "Quand un Allié adverse apparaît, votre Héros gagne 1 PV.",
        "Z",
      ),
    ).toEqual({
      trigger: "onOtherAppears",
      watch: { mainType: "Allié", controller: "opponent" },
      ops: [{ op: "heroGainPv", n: 1 }],
    });
    expect(
      compileAppearanceTriggerText(
        "Quand un Allié Bouftou apparaît, il inflige sa Force en Dommages à l'Allié de votre choix.",
        "Z",
        "Feu",
      ),
    ).toEqual({
      trigger: "onOtherAppears",
      watch: { mainType: "Allié", sub: "bouftou" },
      actor: "appeared",
      ops: [
        {
          op: "damageTargetByForce",
          element: "Feu",
          zones: ["monde", "havreSac"],
        },
      ],
    });
  });

  it("NÉGATIF : « Quand un Héros apparaît … » NON modélisé (Héros non veillés) → null", () => {
    expect(
      compileAppearanceTriggerText(
        "Quand un Héros apparaît, piochez une carte.",
        "Z",
      ),
    ).toBeNull();
  });

  it("NÉGATIF : « Quand un Bwork adverse apparaît … » (qualificatif inattendu sur famille nue) → null", () => {
    expect(
      compileAppearanceTriggerText(
        "Quand un Bwork adverse apparaît, piochez une carte.",
        "Z",
      ),
    ).toBeNull();
  });

  it("NÉGATIF : mot inconnu (ni « Allié » ni Famille) → null", () => {
    expect(
      compileAppearanceTriggerText(
        "Quand un Truc apparaît, piochez une carte.",
        "Z",
      ),
    ).toBeNull();
  });
});

describe("W27 — harvest (échantillon de données réelles)", () => {
  it("Cya Nhûr (coût de recyclage de soi + Héros choisi perd 1 PV) se compile", () => {
    const c = compileTapEffectText(
      "Recyclez Cya Nhûr depuis le Monde : Le Héros du joueur de votre choix perd 1 PV.",
      "Cya Nhûr",
      "Eau",
    );
    expect(c?.cost).toBe("paidOps");
    expect(c?.ops).toEqual([
      { op: "costRecycle", from: "self" },
      {
        op: "damageTarget",
        n: 1,
        element: "Eau",
        heroes: true,
        targetHeroOnly: true,
        zones: ["monde", "havreSac"],
      },
    ]);
  });

  it("Donjon des Bworks (apparition famille nue, sujet acteur apparu) se compile", () => {
    const c = compileAppearanceTriggerText(
      "Chaque fois qu'un Bwork apparaît, il inflige 1 Dommage à l'Allié ou Héros de votre choix.",
      "Donjon des Bworks",
      "Neutre",
    );
    expect(c?.trigger).toBe("onOtherAppears");
    expect(c?.watch).toEqual({ mainType: "Allié", sub: "bwork" });
    expect(c?.actor).toBe("appeared");
  });
});
