import { describe, expect, it } from "vitest";
import type { Card } from "@/types/cards";
import {
  effectiveForce,
  effectTargetIds,
  resolveBuffForceTarget,
  resolveDamageTarget,
  resolveDestroyTarget,
  resolveHealHeroTarget,
} from "@/game/rules";
import {
  HERO_A,
  bringToMonde,
  ctxOf,
  dispatch,
  fixture,
  instId,
  makeAlly,
} from "./harness";
import { move } from "@/game";

describe("rules/effects — ciblage", () => {
  it("liste les Alliés du Monde (tous contrôleurs), pas les Zones ni le Héros", () => {
    const zone = { ...makeAlly("z"), mainType: "Zone" } as unknown as Card;
    const f = fixture([makeAlly("a0"), zone], [makeAlly("b0")]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "A", instId("A", 1)); // la Zone
    bringToMonde(f, "B", instId("B", 0));
    const ids = effectTargetIds(ctxOf(f), {
      op: "destroyTarget",
      what: "Allié",
      zones: ["monde"],
    });
    expect(ids.sort()).toEqual([instId("A", 0), instId("B", 0)].sort());
    const zones = effectTargetIds(ctxOf(f), {
      op: "destroyTarget",
      what: "Zone",
      zones: ["monde"],
    });
    expect(zones).toEqual([instId("A", 1)]);
  });

  it("inclut le Havre-Sac quand l'op le permet", () => {
    const f = fixture([makeAlly("a0")]);
    // place l'allié dans le Havre-Sac de A
    dispatch(
      f,
      move("A", {
        instanceId: instId("A", 0),
        from: { zone: "pioche", owner: "A" },
        to: { zone: "havreSac", owner: "A" },
        position: { at: "any" },
        visibility: { faceDown: false, visibleTo: "all" },
        preservesIdentity: false,
        orientationOnArrival: "upright",
      }),
    );
    const mondeOnly = effectTargetIds(ctxOf(f), {
      op: "destroyTarget",
      what: "Allié",
      zones: ["monde"],
    });
    expect(mondeOnly).toEqual([]);
    const both = effectTargetIds(ctxOf(f), {
      op: "destroyTarget",
      what: "Allié",
      zones: ["monde", "havreSac"],
    });
    expect(both).toEqual([instId("A", 0)]);
  });

  it("détruire un Allié adverse : défausse du propriétaire + XP (415.1)", () => {
    const f = fixture([], [makeAlly("b0", { xp: 2 })]);
    bringToMonde(f, "B", instId("B", 0));
    const res = resolveDestroyTarget(ctxOf(f), "A", instId("B", 0));
    dispatch(f, ...res.events);
    const s = ctxOf(f).state;
    expect(s.seats.B.defausse).toContain(instId("B", 0));
    expect(s.instances[HERO_A].counters.xp).toBe(2);
  });

  it("dommages ciblés : Résistance déduite, létalité appliquée", () => {
    const f = fixture(
      [],
      [
        makeAlly("dur", { force: 5, resist: ["Feu", 1] }),
        makeAlly("frele", { force: 2 }),
      ],
    );
    bringToMonde(f, "B", instId("B", 0));
    bringToMonde(f, "B", instId("B", 1));
    // 3 Feu sur le résistant : 2 effectifs < 5 → survit
    const r1 = resolveDamageTarget(ctxOf(f), "A", instId("B", 0), 3, "Feu");
    dispatch(f, ...r1.events);
    expect(ctxOf(f).state.instances[instId("B", 0)].counters.damage).toBe(2);
    // 3 sur le frêle (force 2) → détruit
    const r2 = resolveDamageTarget(ctxOf(f), "A", instId("B", 1), 3, "Feu");
    dispatch(f, ...r2.events);
    expect(ctxOf(f).state.seats.B.defausse).toContain(instId("B", 1));
  });

  it("dommages ciblés sur un Héros : perte de PV, jamais de compteur damage", () => {
    const f = fixture([]);
    const r = resolveDamageTarget(ctxOf(f), "B", HERO_A, 3, "Eau");
    dispatch(f, ...r.events);
    const hero = ctxOf(f).state.instances[HERO_A];
    expect(hero.counters.hp).toBe(13); // 16 − 3
    expect(hero.counters.damage ?? 0).toBe(0);
  });

  it("buffForceTarget avec famille : seuls les Monstres sont ciblables", () => {
    const monstre = makeAlly("m0");
    monstre.subTypes = ["Monstre", "Bouftou"];
    const humain = makeAlly("h0");
    humain.subTypes = ["Bandit"];
    const f = fixture([monstre, humain]);
    bringToMonde(f, "A", instId("A", 0));
    bringToMonde(f, "A", instId("A", 1));
    const ids = effectTargetIds(ctxOf(f), {
      op: "buffForceTarget",
      n: 2,
      heroes: false,
      sub: "monstre",
      zones: ["monde", "havreSac"],
    });
    expect(ids).toEqual([instId("A", 0)]);
  });

  it("healHeroTarget : cibles = les deux Héros, soin appliqué", () => {
    const f = fixture([]);
    const ids = effectTargetIds(ctxOf(f), { op: "healHeroTarget", n: 3 });
    expect(ids.sort()).toEqual([HERO_A, "ci_B_001"].sort());
    dispatch(f, ...resolveDamageTarget(ctxOf(f), "B", HERO_A, 5, "Eau").events);
    dispatch(f, ...resolveHealHeroTarget(ctxOf(f), "A", HERO_A, 3).events);
    expect(ctxOf(f).state.instances[HERO_A].counters.hp).toBe(14); // 16−5+3
  });

  it("buffForceTarget : +N Force temporaire, pris en compte par la létalité", () => {
    const f = fixture([], [makeAlly("b0", { force: 2 })]);
    bringToMonde(f, "B", instId("B", 0));
    dispatch(
      f,
      ...resolveBuffForceTarget(ctxOf(f), "B", instId("B", 0), 2).events,
    );
    expect(
      ctxOf(f).state.instances[instId("B", 0)].counters.tokens?.forceMod,
    ).toBe(2);
    // 3 Dommages < Force effective 4 → survit (sans le buff il mourrait)
    const r = resolveDamageTarget(ctxOf(f), "A", instId("B", 0), 3, "Feu");
    dispatch(f, ...r.events);
    expect(ctxOf(f).state.seats.B.defausse).not.toContain(instId("B", 0));
    expect(ctxOf(f).state.instances[instId("B", 0)].counters.damage).toBe(3);
  });

  it("effectiveForce additionne Force imprimée et forceMod", () => {
    const f = fixture([makeAlly("a0", { force: 2 })]);
    bringToMonde(f, "A", instId("A", 0));
    expect(effectiveForce(ctxOf(f), instId("A", 0))).toBe(2);
    dispatch(
      f,
      ...resolveBuffForceTarget(ctxOf(f), "A", instId("A", 0), 3).events,
    );
    expect(effectiveForce(ctxOf(f), instId("A", 0))).toBe(5);
  });

  it("les Héros sont ciblables seulement si l'op le permet", () => {
    const f = fixture([makeAlly("a0")]);
    bringToMonde(f, "A", instId("A", 0));
    const noHeroes = effectTargetIds(ctxOf(f), {
      op: "damageTarget",
      n: 1,
      element: "Feu",
      heroes: false,
      zones: ["monde", "havreSac"],
    });
    expect(noHeroes).toEqual([instId("A", 0)]);
    const withHeroes = effectTargetIds(ctxOf(f), {
      op: "damageTarget",
      n: 1,
      element: "Feu",
      heroes: true,
      zones: ["monde", "havreSac"],
    });
    expect(withHeroes).toContain(HERO_A);
    expect(withHeroes).toContain(instId("A", 0));
  });
});
