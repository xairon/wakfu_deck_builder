import { describe, it, expect } from "vitest";
import { formatFrenchDate } from "../date";

describe("formatFrenchDate", () => {
  it("devrait formater une date ISO en date française", () => {
    expect(formatFrenchDate("2009-10-13")).toBe("13/10/2009");
  });

  it("devrait formater une autre date ISO en date française", () => {
    expect(formatFrenchDate("2010-12-01")).toBe("01/12/2010");
  });

  it("devrait renvoyer une chaîne vide pour une date absente", () => {
    expect(formatFrenchDate(undefined)).toBe("");
    expect(formatFrenchDate(null)).toBe("");
    expect(formatFrenchDate("")).toBe("");
  });

  it("devrait renvoyer une chaîne vide pour une date malformée (jamais 'Invalid Date')", () => {
    expect(formatFrenchDate("pas une date")).toBe("");
    expect(formatFrenchDate("13/10/2009")).toBe(""); // pas de l'ISO en entrée
    expect(formatFrenchDate("2009-13-99")).toBe("");
  });
});
