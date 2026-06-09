import { describe, expect, it } from "vitest";
import { grantXpEvents, victoryFromState } from "../progress";
import { HERO_A, HERO_B, ctxOf, dispatch, fixture } from "./harness";
import { flipLevel, setCounter } from "@/game";

describe("rules/progress — XP, niveaux, victoire", () => {
  it("flip verso au 6ᵉ XP : face, niveau, PA/PM verso, PV +delta", () => {
    const f = fixture([]);
    dispatch(f, setCounter("A", HERO_A, "xp", 5));
    const grant = grantXpEvents(ctxOf(f), "A", 1);
    expect(grant.leveledTo).toBe(2);
    expect(grant.won).toBe(false);
    dispatch(f, ...grant.events);
    const hero = ctxOf(f).state.instances[HERO_A];
    expect(hero.face).toBe("verso");
    expect(hero.counters.pa).toBe(7);
    expect(hero.counters.hp).toBe(20);
  });

  it("ne re-flip pas un Héros déjà verso", () => {
    const f = fixture([]);
    dispatch(f, flipLevel("A", HERO_A, "verso", 2, 6));
    dispatch(f, setCounter("A", HERO_A, "xp", 6));
    const grant = grantXpEvents(ctxOf(f), "A", 1);
    expect(grant.leveledTo).toBeNull();
  });

  it("won à 18 XP", () => {
    const f = fixture([]);
    dispatch(f, setCounter("A", HERO_A, "xp", 17));
    const grant = grantXpEvents(ctxOf(f), "A", 1);
    expect(grant.won).toBe(true);
    expect(grant.leveledTo).toBe(3);
  });

  it("victoryFromState : PV ≤ 0 → l'adversaire gagne ; 18 XP → le joueur gagne", () => {
    const f = fixture([]);
    expect(victoryFromState(ctxOf(f))).toBeNull();
    dispatch(f, setCounter("B", HERO_B, "hp", 0));
    expect(victoryFromState(ctxOf(f))).toBe("A");
    const g = fixture([]);
    dispatch(g, setCounter("B", HERO_B, "xp", 18));
    expect(victoryFromState(ctxOf(g))).toBe("B");
  });
});
