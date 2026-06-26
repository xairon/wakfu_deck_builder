import { describe, it, expect } from "vitest";
import { MECHANICS, OP_TO_MECHANIC, mechanicsForOps } from "@/data/mechanics";
import type { CompiledEffectOp, MechanicTag } from "@/types/cards";

// Les 21 ops du DSL (CompiledEffectOp). Toute nouvelle op DOIT être ajoutée ici
// ET dans OP_TO_MECHANIC (ce test échoue sinon).
const ALL_OPS: CompiledEffectOp["op"][] = [
  "gainXp",
  "draw",
  "heroGainPv",
  "heroLosePv",
  "damageOppHero",
  "havreSacGainResistance",
  "destroyTarget",
  "damageTarget",
  "healHeroTarget",
  "buffForceTarget",
  "buffForceSelf",
  "recycleFromDiscard",
  "discardFromHand",
  "searchDeck",
  "shuffleDeck",
  "destroySelf",
  "loseStatTurn",
  "tapSelf",
  "combatModSelf",
  "buffForceAlliesMondeTurn",
  "globalDamageShield",
];

describe("registre de mécaniques", () => {
  it("devrait mapper chaque op du DSL vers une mécanique", () => {
    for (const op of ALL_OPS) {
      expect(OP_TO_MECHANIC[op], `op ${op}`).toBeTruthy();
    }
  });

  it("devrait n'utiliser que des tags définis dans MECHANICS", () => {
    const known = new Set<MechanicTag>(MECHANICS.map((m) => m.id));
    for (const tag of Object.values(OP_TO_MECHANIC)) {
      expect(known.has(tag), `tag ${tag}`).toBe(true);
    }
  });

  it("devrait avoir des ids de mécanique uniques", () => {
    const ids = MECHANICS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("devrait dériver des tags uniques dans l'ordre d'apparition", () => {
    const tags = mechanicsForOps([
      { op: "draw" },
      { op: "draw" },
      { op: "gainXp" },
    ]);
    expect(tags).toEqual(["draw", "gain-xp"]);
  });

  it("devrait n'avoir de relatesTo que vers des tags connus", () => {
    const known = new Set<MechanicTag>(MECHANICS.map((m) => m.id));
    for (const m of MECHANICS) {
      for (const rel of m.relatesTo ?? []) {
        expect(known.has(rel.tag), `${m.id} -> ${rel.tag}`).toBe(true);
      }
    }
  });
});
