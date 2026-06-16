/**
 * Lot B — destructions d'état (1414 / 3019) : `stateBasedDestroyEvents`
 * (une passe pure) + point fixe (cascade d'auras), XP à l'adversaire du
 * contrôleur (415.1), et garde « Force inconnue » des données scrapées.
 */
import { describe, expect, it } from "vitest";
import type { AllyCard, StaticAbility } from "@/types/cards";
import { havreSacBanishEvents, stateBasedDestroyEvents } from "@/game/rules";
import { incCounter, move, setCounter } from "@/game";
import { createMockAllyCard } from "tests/factories/card";
import type { Fixture } from "./harness";
import {
  HERO_A,
  HERO_B,
  SAC_A,
  bringToHand,
  bringToMonde,
  ctxOf,
  dispatch,
  fixture,
  instId,
  makeAlly,
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

/** Boucle en point fixe comme le store ; retourne le nombre de passes utiles. */
function fixedPoint(f: Fixture, max = 32): number {
  let passes = 0;
  for (let i = 0; i < max; i++) {
    const sbd = stateBasedDestroyEvents(ctxOf(f));
    if (!sbd.destroyed.length) break;
    dispatch(f, ...sbd.events);
    passes++;
  }
  return passes;
}

describe("rules/destruction — destructions d'état (1414 / 3019)", () => {
  it("le Vrombyx meurt main vide (1414) et son XP va à l'adversaire (415.1)", () => {
    const vrombyx = withStatic(makeAlly("vrombyx", { force: 0, xp: 2 }), {
      kind: "forceEqualsHandSize",
    });
    const f = fixture([vrombyx, makeAlly("filler")]);
    bringToMonde(f, "A", instId("A", 0));
    bringToHand(f, "A", instId("A", 1));
    // une carte en main → Force 1 : rien à détruire
    expect(stateBasedDestroyEvents(ctxOf(f)).destroyed).toEqual([]);
    // main vidée → Force effective 0 : détruit, XP au Héros adverse
    dispatch(
      f,
      move("A", {
        instanceId: instId("A", 1),
        from: { zone: "main", owner: "A" },
        to: { zone: "defausse", owner: "A" },
        position: { at: "top" },
        visibility: { faceDown: false, visibleTo: "all" },
        preservesIdentity: false,
      }),
    );
    const sbd = stateBasedDestroyEvents(ctxOf(f));
    expect(sbd.destroyed).toEqual([instId("A", 0)]);
    expect(sbd.log.join(" ")).toContain("1414");
    dispatch(f, ...sbd.events);
    expect(ctxOf(f).state.seats.A.defausse).toContain(instId("A", 0));
    expect(ctxOf(f).state.instances[HERO_B].counters.xp).toBe(2);
    expect(ctxOf(f).state.instances[HERO_A].counters.xp ?? 0).toBe(0);
  });

  it("la perte de l'aura rend létal un dommage déjà posé — cascade 3019 en point fixe", () => {
    const chef = withStatic(makeAlly("chef", { force: 3, xp: 2 }), {
      kind: "forceAura",
      n: 1,
      sub: "bouftou",
    });
    chef.subTypes = ["Monstre", "Bouftou"];
    const bouftou = makeAlly("b1", { force: 2, xp: 1 });
    bouftou.subTypes = ["Bouftou"];
    const f = fixture([chef, bouftou]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "A", instId("A", 1));
    // 2 Dommages sur le Bouftou : non létal (Force 2 + 1 d'aura = 3)
    dispatch(f, incCounter("A", instId("A", 1), "damage", 2));
    expect(stateBasedDestroyEvents(ctxOf(f)).destroyed).toEqual([]);
    // 3 Dommages sur le Chef : létal pour LUI seulement à la 1re passe
    dispatch(f, incCounter("A", instId("A", 0), "damage", 3));
    const pass1 = stateBasedDestroyEvents(ctxOf(f));
    expect(pass1.destroyed).toEqual([instId("A", 0)]);
    dispatch(f, ...pass1.events);
    // l'aura est tombée : les 2 Dommages du Bouftou deviennent létaux (3019)
    const pass2 = stateBasedDestroyEvents(ctxOf(f));
    expect(pass2.destroyed).toEqual([instId("A", 1)]);
    expect(pass2.log.join(" ")).toContain("3019");
    dispatch(f, ...pass2.events);
    // le point fixe s'arrête : plus rien à détruire
    expect(fixedPoint(f)).toBe(0);
    // XP cumulé des deux morts au Héros adverse (2 + 1)
    expect(ctxOf(f).state.instances[HERO_B].counters.xp).toBe(3);
  });

  it("la posture protège un bloqueur « +2 tant qu'il bloque » ; sa fin (708.1) rend les Dommages létaux", () => {
    const bolet = withStatic(makeAlly("bolet", { force: 3 }), {
      kind: "forceWhileBlocking",
      n: 2,
    });
    const f = fixture([bolet]);
    bringToMonde(f, "A", instId("A", 0));
    dispatch(f, incCounter("A", instId("A", 0), "damage", 4));
    // pendant qu'il bloque : seuil 5 > 4 — pas de destruction d'état
    expect(
      stateBasedDestroyEvents(ctxOf(f), { blockers: [instId("A", 0)] })
        .destroyed,
    ).toEqual([]);
    // Fin de Combat : le bonus cesse → 4 ≥ 3, destruction différée (3019)
    expect(stateBasedDestroyEvents(ctxOf(f)).destroyed).toEqual([
      instId("A", 0),
    ]);
  });

  it("Force inconnue (donnée scrapée sans stats.force) : jamais détruit d'office", () => {
    const sansForce = createMockAllyCard({
      id: "sans-force",
      name: "Sans Force",
      stats: { niveau: { value: 1, element: "Feu" } },
    });
    const f = fixture([sansForce]);
    bringToMonde(f, "A", instId("A", 0));
    expect(stateBasedDestroyEvents(ctxOf(f)).destroyed).toEqual([]);
    expect(fixedPoint(f)).toBe(0);
  });
});

describe("rules/destruction — Havre-Sac banni à 0 Résistance (410.7)", () => {
  it("bannit le Havre-Sac en Exil et expulse le Héros au Monde en gardant ses compteurs", () => {
    const f = fixture([]);
    dispatch(f, setCounter("A", HERO_A, "xp", 5)); // compteur à conserver
    // Résistance du Havre-Sac A ramenée à 0
    dispatch(f, setCounter("A", SAC_A, "resistance", 0));
    const hsb = havreSacBanishEvents(ctxOf(f));
    expect(hsb.destroyed).toContain(SAC_A);
    expect(hsb.log.join(" ")).toContain("410.7");
    dispatch(f, ...hsb.events);
    const st = ctxOf(f).state;
    // Havre-Sac banni, Héros expulsé au Monde, compteurs conservés (501.5)
    expect(st.instances[SAC_A].location.zone).toBe("exil");
    expect(st.instances[HERO_A].location.zone).toBe("monde");
    expect(st.instances[HERO_A].counters.xp).toBe(5);
    expect(st.instances[HERO_A].counters.hp).toBe(16);
  });

  it("ne fait rien tant que la Résistance reste positive", () => {
    const f = fixture([]);
    dispatch(f, setCounter("A", SAC_A, "resistance", 4));
    expect(havreSacBanishEvents(ctxOf(f)).events).toEqual([]);
  });
});
