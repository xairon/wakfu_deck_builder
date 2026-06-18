import { describe, it, expect } from "vitest";
import { manualEffects } from "../dsl";
import { createMockAllyCard } from "tests/factories/card";

describe("manualEffects", () => {
  it("ne retourne que les effets imprimés sans forme compilée", () => {
    const card = createMockAllyCard({
      effects: [
        {
          description: "Effet auto",
          compiled: { trigger: "onArrive", ops: [] },
        },
        { description: "Effet manuel" },
        { description: "Note de règle", kind: "ruling" },
        { description: "   " },
      ],
    });
    expect(manualEffects(card).map((e) => e.description)).toEqual([
      "Effet manuel",
    ]);
  });

  it("carte vanille ou nulle → liste vide", () => {
    expect(manualEffects(createMockAllyCard({ effects: [] }))).toEqual([]);
    expect(manualEffects(null)).toEqual([]);
  });
});
