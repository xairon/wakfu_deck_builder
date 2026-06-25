import { describe, it, expect } from "vitest";
import { CREDITS } from "@/data/credits";

describe("CREDITS", () => {
  it("remercie Safranil avec un lien vers son site", () => {
    const safranil = CREDITS.find((c) => c.name.includes("Safranil"));
    expect(safranil).toBeTruthy();
    expect(safranil!.url).toContain("wtcg-return.fr");
  });
  it("crédite Ankama comme créateur de l'univers", () => {
    expect(CREDITS.some((c) => c.name.includes("Ankama"))).toBe(true);
  });
  it("chaque entrée a un titre et une description", () => {
    for (const c of CREDITS) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.description.length).toBeGreaterThan(0);
    }
  });
});
