/**
 * Vague W54 (deck-driven, starter Incarnam Guma Bobeule) — BONUS DE POUVOIR
 * D'ALLIÉ : « Les Dommages infligés par les pouvoirs de vos Alliés sont
 * augmentés de 1 jusqu'à la fin du tour. »
 *
 * Modèle : jeton de tour `teamPowerDmgMod` sur le Héros (cumulatif, purgé en
 * fin de tour) + provenance `powerSourceId` sur les frames de POUVOIR (jamais
 * réécrite — ≠ sourceId/actor-binding) lue par `allyPowerDamageBonus` au point
 * de résolution : bonus PAR PAQUET, AVANT Résistance, seulement si paquet > 0
 * et provenance = un ALLIÉ (glossaire « Pouvoir » — Actions/Héros/Équipements
 * exclus ; Dommages de combat exclus ; pertes directes de PV exclues, 410.3).
 */
import { describe, it, expect } from "vitest";
import {
  allyPowerDamageBonus,
  compileActionEffectText,
  compileTapEffectText,
  resolveDamageTarget,
} from "@/game/rules";
import {
  HERO_A,
  bringToMonde,
  ctxOf,
  dispatch,
  fixture,
  instId,
  makeAlly,
} from "../../__tests__/harness";
import { setCounter } from "@/game";

// ── Volet 1 : DSL ────────────────────────────────────────────────────────────
describe("DSL — buffTeamPowerDamageTurn (Guma Bobeule)", () => {
  it("Guma : pouvoir-tap → buffTeamPowerDamageTurn{1}", () => {
    const c = compileTapEffectText(
      "Les Dommages infligés par les pouvoirs de vos Alliés sont augmentés de 1 jusqu'à la fin du tour.",
      "Guma Bobeule",
      "Terre",
      false,
      true, // requiresIncline (donnée réelle)
    );
    expect(c).toEqual({
      trigger: "onTap",
      ops: [{ op: "buffTeamPowerDamageTurn", n: 1 }],
    });
  });

  it("STRICT : la variante continue (Dragodinde Ivoire) ne matche pas", () => {
    expect(
      compileTapEffectText(
        "Tant que le Porteur de la Dragodinde Ivoire est attaquant, les Dommages sur le point d'être infligés par les pouvoirs de vos Alliés ou Héros attaquants sont augmentés de 1.",
        "Dragodinde Ivoire",
        "Neutre",
        false,
        true,
      ),
    ).toBeNull();
  });
});

describe("DSL — discriminants Dommages vs perte de PV", () => {
  it("« Infligez N Dommages au Héros adverse » → damageOppHero{isDamage} ; « perd N PV » → sans flag", () => {
    expect(
      compileActionEffectText("Infligez 2 Dommages au Héros adverse.", "X")
        ?.ops,
    ).toEqual([{ op: "damageOppHero", n: 2, isDamage: true }]);
    expect(
      compileActionEffectText("Le Héros adverse perd 2 PV.", "X")?.ops,
    ).toEqual([{ op: "damageOppHero", n: 2 }]);
  });

  it("« le Héros de votre choix perd N PV » → damageTarget{pvLoss}", () => {
    expect(
      compileActionEffectText("Le Héros de votre choix perd 2 PV.", "X")
        ?.ops?.[0],
    ).toMatchObject({ op: "damageTarget", n: 2, pvLoss: true });
  });
});

// ── Volet 2 : allyPowerDamageBonus ───────────────────────────────────────────
describe("allyPowerDamageBonus — provenance + jeton", () => {
  it("provenance ALLIÉ + jeton sur son Héros → n ; sans jeton → 0", () => {
    const f = fixture([makeAlly("src")]);
    bringToMonde(f, "A", instId("A", 0));
    expect(allyPowerDamageBonus(ctxOf(f), instId("A", 0))).toBe(0);
    dispatch(f, setCounter("A", HERO_A, "teamPowerDmgMod", 1, true));
    expect(allyPowerDamageBonus(ctxOf(f), instId("A", 0))).toBe(1);
  });

  it("provenance HÉROS (pas un Allié) → 0, même avec jeton", () => {
    const f = fixture([]);
    dispatch(f, setCounter("A", HERO_A, "teamPowerDmgMod", 1, true));
    expect(allyPowerDamageBonus(ctxOf(f), HERO_A)).toBe(0);
  });

  it("provenance Allié ADVERSE → lit le Héros adverse (sans jeton → 0)", () => {
    const f = fixture([], [makeAlly("sien")]);
    bringToMonde(f, "B", instId("B", 0));
    dispatch(f, setCounter("A", HERO_A, "teamPowerDmgMod", 1, true));
    // le pouvoir vient d'un Allié de B → jeton lu sur le Héros de B (absent)
    expect(allyPowerDamageBonus(ctxOf(f), instId("B", 0))).toBe(0);
  });

  it("provenance absente (Action) → 0", () => {
    const f = fixture([]);
    dispatch(f, setCounter("A", HERO_A, "teamPowerDmgMod", 1, true));
    expect(allyPowerDamageBonus(ctxOf(f), undefined)).toBe(0);
  });
});

// ── Volet 3 : resolveDamageTarget — application du bonus ────────────────────
describe("resolveDamageTarget — bonus par paquet, avant Résistance", () => {
  it("pouvoir d'Allié avec jeton : 1 Dommage devient 2", () => {
    const f = fixture(
      [makeAlly("src")],
      [makeAlly("cible", { force: 4 })], // force 4 : survit à 2 Dommages
    );
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "B", instId("B", 0));
    dispatch(f, setCounter("A", HERO_A, "teamPowerDmgMod", 1, true));
    const res = resolveDamageTarget(ctxOf(f), "A", instId("B", 0), 1, "Feu", {
      powerSourceId: instId("A", 0),
    });
    const dmg = res.events.find(
      (e) =>
        e.type === "INC_COUNTER" &&
        (e.payload as { counter?: string }).counter === "damage",
    );
    expect((dmg?.payload as { delta?: number })?.delta).toBe(2);
    expect(res.log.join(" ")).toContain("augmentés de 1");
  });

  it("AVANT Résistance : base 1+1=2, Résistance 1 → 1 Dommage infligé", () => {
    const f = fixture(
      [makeAlly("src")],
      [makeAlly("cible", { force: 4, resist: ["Feu", 1] })],
    );
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "B", instId("B", 0));
    dispatch(f, setCounter("A", HERO_A, "teamPowerDmgMod", 1, true));
    const res = resolveDamageTarget(ctxOf(f), "A", instId("B", 0), 1, "Feu", {
      powerSourceId: instId("A", 0),
    });
    const dmg = res.events.find(
      (e) =>
        e.type === "INC_COUNTER" &&
        (e.payload as { counter?: string }).counter === "damage",
    );
    // sans bonus : 1 − 1 (Rés) = 0 ; avec bonus AVANT Rés : (1+1) − 1 = 1.
    expect((dmg?.payload as { delta?: number })?.delta).toBe(1);
  });

  it("paquet de base 0 : jamais augmenté (0 reste 0)", () => {
    const f = fixture([makeAlly("src")], [makeAlly("cible", { force: 4 })]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "B", instId("B", 0));
    dispatch(f, setCounter("A", HERO_A, "teamPowerDmgMod", 1, true));
    const res = resolveDamageTarget(ctxOf(f), "A", instId("B", 0), 0, "Feu", {
      powerSourceId: instId("A", 0),
    });
    expect(
      res.events.some(
        (e) =>
          e.type === "INC_COUNTER" &&
          (e.payload as { counter?: string }).counter === "damage",
      ),
    ).toBe(false);
  });

  it("SANS provenance (Action) : pas de bonus", () => {
    const f = fixture([], [makeAlly("cible", { force: 4 })]);
    bringToMonde(f, "B", instId("B", 0));
    dispatch(f, setCounter("A", HERO_A, "teamPowerDmgMod", 1, true));
    const res = resolveDamageTarget(
      ctxOf(f),
      "A",
      instId("B", 0),
      1,
      "Feu",
      {},
    );
    const dmg = res.events.find(
      (e) =>
        e.type === "INC_COUNTER" &&
        (e.payload as { counter?: string }).counter === "damage",
    );
    expect((dmg?.payload as { delta?: number })?.delta).toBe(1);
  });
});
