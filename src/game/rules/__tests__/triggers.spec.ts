import { describe, expect, it } from "vitest";
import { collectTriggeredEffects } from "@/game/rules";
import type { RuleEvent } from "@/game/rules";
import {
  bringToMonde,
  ctxOf,
  fixture,
  instId,
  makeAlly,
  setTurn,
} from "./harness";

/** Allié doté d'un pouvoir « Quand il attaque » compilé (trigger onSelfAttacks). */
function brussLike(id: string) {
  const c = makeAlly(id, { force: 2 });
  c.effects = [
    {
      description: `Quand ${c.name} attaque, il gagne +2 en Force et Géant.`,
      compiled: {
        trigger: "onSelfAttacks",
        ops: [{ op: "combatModSelf", force: 2, pm: 0, geant: true }],
      },
    },
  ];
  return c;
}

describe("rules/triggers — bus de déclenchement (804.7)", () => {
  it("attackerDeclared → frame « Quand [self] attaque » de l'attaquant", () => {
    const f = fixture([brussLike("bruss")]);
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    const evt: RuleEvent = {
      kind: "attackerDeclared",
      seat: "A",
      instanceId: instId("A", 0),
    };
    const frames = collectTriggeredEffects(ctxOf(f), [evt]);
    expect(frames).toHaveLength(1);
    expect(frames[0].seat).toBe("A");
    expect(frames[0].sourceId).toBe(instId("A", 0));
    expect(frames[0].ops).toEqual([
      { op: "combatModSelf", force: 2, pm: 0, geant: true },
    ]);
  });

  it("aucun déclenché pour un attaquant sans pouvoir « Quand il attaque »", () => {
    const f = fixture([makeAlly("muet", { force: 2 })]);
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    const frames = collectTriggeredEffects(ctxOf(f), [
      { kind: "attackerDeclared", seat: "A", instanceId: instId("A", 0) },
    ]);
    expect(frames).toEqual([]);
  });

  it("le joueur actif passe d'abord (804.6 approx.)", () => {
    const f = fixture([brussLike("a")], [brussLike("b")]);
    setTurn(f, "A", 3);
    bringToMonde(f, "A", instId("A", 0), { arrivedTurn: 1 });
    bringToMonde(f, "B", instId("B", 0), { arrivedTurn: 1 });
    const frames = collectTriggeredEffects(ctxOf(f), [
      { kind: "attackerDeclared", seat: "B", instanceId: instId("B", 0) },
      { kind: "attackerDeclared", seat: "A", instanceId: instId("A", 0) },
    ]);
    // A est actif → sa frame d'abord, même émise après celle de B
    expect(frames.map((fr) => fr.seat)).toEqual(["A", "B"]);
  });

  it("damageDealt ne déclenche rien tant que le modèle de Porteur manque (lot F)", () => {
    const f = fixture([makeAlly("x", { force: 2 })]);
    bringToMonde(f, "A", instId("A", 0));
    const frames = collectTriggeredEffects(ctxOf(f), [
      {
        kind: "damageDealt",
        source: instId("A", 0),
        target: instId("A", 0),
        amount: 2,
        element: "feu",
        combat: true,
      },
    ]);
    expect(frames).toEqual([]);
  });
});
