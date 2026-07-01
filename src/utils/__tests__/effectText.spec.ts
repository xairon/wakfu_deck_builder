import { describe, it, expect } from "vitest";
import { isEffectAnnotation, EFFECT_KIND_LABELS } from "../effectText";

describe("effectText — isEffectAnnotation", () => {
  it("considère un effet sans kind comme un effet de jeu réel", () => {
    expect(isEffectAnnotation({ description: "Piochez une carte." })).toBe(
      false,
    );
  });

  it("considère les entrées kind:ruling et kind:errata comme des annotations", () => {
    expect(isEffectAnnotation({ description: "…", kind: "ruling" })).toBe(true);
    expect(isEffectAnnotation({ description: "…", kind: "errata" })).toBe(true);
  });

  it("est robuste aux entrées nulles/indéfinies", () => {
    expect(isEffectAnnotation(null)).toBe(false);
    expect(isEffectAnnotation(undefined)).toBe(false);
  });

  it("expose un label français par type d'annotation (ruling → Note)", () => {
    expect(EFFECT_KIND_LABELS.ruling).toBe("Note");
    expect(EFFECT_KIND_LABELS.errata).toBe("Errata");
  });
});
