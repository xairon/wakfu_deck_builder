/**
 * Portée 508.1b/c : l'adversaire ne peut atteindre un objet (Héros compris) dans
 * VOTRE Havre-Sac. Reproduction du bug signalé : le pouvoir de Tirlangue Portey
 * (« inflige 2 Dommages à l'Allié ou Héros de votre choix », damageTarget
 * heroes:true zones:[monde,havreSac]) ne doit PAS pouvoir cibler le Héros adverse
 * protégé dans son Havre-Sac — seulement une fois exposé dans le Monde.
 */
import { describe, it, expect } from "vitest";
import { effectTargetIds } from "../targeting";
import type { TargetingOp } from "../targeting";
import {
  fixture,
  ctxOf,
  moveHeroTo,
  HERO_A,
  HERO_B,
  setTurn,
} from "@/game/rules/__tests__/harness";

const TIRLANGUE_OP = {
  op: "damageTarget",
  n: 2,
  element: "Air",
  heroes: true,
  zones: ["monde", "havreSac"],
} as unknown as TargetingOp;

describe("targeting — portée 508.x (Havre-Sac adverse injoignable)", () => {
  it("un effet ne cible pas le Héros ADVERSE dans son Havre-Sac, mais le cible exposé (repro Tirlangue)", () => {
    const f = fixture([]);
    setTurn(f, "A", 3);
    // Héros B protégé dans son Havre-Sac : hors de portée d'un effet de A.
    expect(effectTargetIds(ctxOf(f), TIRLANGUE_OP, "A")).not.toContain(HERO_B);
    // Héros B exposé dans le Monde : ciblable.
    moveHeroTo(f, "B", "monde");
    expect(effectTargetIds(ctxOf(f), TIRLANGUE_OP, "A")).toContain(HERO_B);
  });

  it("mais un effet peut atteindre SON PROPRE Héros dans SON Havre-Sac (soin/self)", () => {
    const f = fixture([]);
    setTurn(f, "A", 3);
    const healOp = { op: "healHeroTarget", n: 2 } as unknown as TargetingOp;
    // le Héros de A (dans son propre Havre-Sac) reste joignable ; pas le Héros B.
    const ids = effectTargetIds(ctxOf(f), healOp, "A");
    expect(ids).toContain(HERO_A);
    expect(ids).not.toContain(HERO_B);
  });
});
