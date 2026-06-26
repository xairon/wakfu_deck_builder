import { describe, it, expect } from "vitest";
import { MECHANICS, OP_TO_MECHANIC, mechanicsForOps } from "@/data/mechanics";
import { compiledEffectOpSchema } from "@/schema";
import type { MechanicTag } from "@/types/cards";

// Ensemble AUTORITAIRE des ops du DSL, dérivé du schéma (source de vérité) :
// chaque option de l'union discriminée est un z.object dont la valeur littérale
// `op` est lisible via `opt.shape.op.value` (Zod v4). Ainsi, ajouter une op au
// schéma sans l'ajouter à OP_TO_MECHANIC (ou l'inverse) FAIT échouer le test
// d'égalité ci-dessous — la garantie d'exhaustivité est réelle, pas un sous-set.
const ALL_OPS: string[] = compiledEffectOpSchema.options.map(
  (opt) => opt.shape.op.value,
);

describe("registre de mécaniques", () => {
  it("devrait mapper exactement les ops du schéma (exhaustivité)", () => {
    expect(Object.keys(OP_TO_MECHANIC).sort()).toEqual([...ALL_OPS].sort());
  });

  it("devrait mapper chaque op du DSL vers une mécanique", () => {
    for (const op of ALL_OPS) {
      expect(
        OP_TO_MECHANIC[op as keyof typeof OP_TO_MECHANIC],
        `op ${op}`,
      ).toBeTruthy();
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
