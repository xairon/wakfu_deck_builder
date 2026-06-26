import { describe, it, expect } from "vitest";
import { canonicalKey, printingsOf } from "@/utils/cardIdentity";
import { createMockAllyCard } from "tests/factories/card";

describe("cardIdentity", () => {
  it("devrait produire la même clé pour deux impressions de même nom", () => {
    const incarnam = createMockAllyCard({ id: "tofu-incarnam", name: "Tofu" });
    const dofus = createMockAllyCard({
      id: "tofu-dofus-collection",
      name: "Tofu",
    });
    expect(canonicalKey(incarnam)).toBe(canonicalKey(dofus));
  });

  it("devrait ignorer la casse et les espaces autour du nom", () => {
    const a = createMockAllyCard({ name: "Bworky" });
    const b = createMockAllyCard({ name: "  bworky " });
    expect(canonicalKey(a)).toBe(canonicalKey(b));
  });

  it("devrait distinguer des noms différents", () => {
    const a = createMockAllyCard({ name: "Tofu" });
    const b = createMockAllyCard({ name: "Bouftou" });
    expect(canonicalKey(a)).not.toBe(canonicalKey(b));
  });

  it("printingsOf devrait retourner toutes les impressions du même nom", () => {
    const a = createMockAllyCard({ id: "tofu-incarnam", name: "Tofu" });
    const b = createMockAllyCard({ id: "tofu-dofus-collection", name: "Tofu" });
    const c = createMockAllyCard({ id: "bouftou-amakna", name: "Bouftou" });
    const result = printingsOf([a, b, c], a);
    expect(result.map((x) => x.id).sort()).toEqual([
      "tofu-dofus-collection",
      "tofu-incarnam",
    ]);
  });
});
