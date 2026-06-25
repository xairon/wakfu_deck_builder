import { describe, it, expect } from "vitest";
import { FIRST_STEPS } from "@/data/firstSteps";

describe("FIRST_STEPS", () => {
  it("propose une séquence de plusieurs étapes", () => {
    expect(FIRST_STEPS.length).toBeGreaterThanOrEqual(4);
  });
  it("chaque étape a un titre et un contenu", () => {
    for (const s of FIRST_STEPS) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.body.length).toBeGreaterThan(0);
    }
  });
});
