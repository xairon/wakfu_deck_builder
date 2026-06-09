import { describe, it, expect } from "vitest";
import { normalizeSearch, matchesSearch } from "@/utils/text";

describe("normalizeSearch", () => {
  it("devrait passer en minuscules", () => {
    expect(normalizeSearch("XÉLOR")).toBe("xelor");
  });

  it("devrait retirer les accents", () => {
    expect(normalizeSearch("Abcès")).toBe("abces");
    expect(normalizeSearch("Féca")).toBe("feca");
    expect(normalizeSearch("Brâkmar")).toBe("brakmar");
    expect(normalizeSearch("Otomaï")).toBe("otomai");
    expect(normalizeSearch("Crâ")).toBe("cra");
  });

  it("devrait compresser les espaces superflus", () => {
    expect(normalizeSearch("  Bonta   Brakmar  ")).toBe("bonta brakmar");
  });
});

describe("matchesSearch", () => {
  it("devrait trouver une carte accentuée via une requête sans accent", () => {
    expect(matchesSearch("Xélor", "xelor")).toBe(true);
    expect(matchesSearch("Abcès de Wakfu", "abces")).toBe(true);
    expect(matchesSearch("Otomaï l'Enchanteur", "otomai")).toBe(true);
  });

  it("devrait fonctionner dans les deux sens (requête accentuée)", () => {
    expect(matchesSearch("Xelor", "xélor")).toBe(true);
  });

  it("devrait être insensible à la casse", () => {
    expect(matchesSearch("Bottes du Craqueleur", "CRAQUELEUR")).toBe(true);
  });

  it("ne devrait pas matcher un terme absent", () => {
    expect(matchesSearch("Abraknyde", "iop")).toBe(false);
  });

  it("devrait toujours matcher une requête vide", () => {
    expect(matchesSearch("Abraknyde", "")).toBe(true);
    expect(matchesSearch("Abraknyde", "   ")).toBe(true);
  });
});
