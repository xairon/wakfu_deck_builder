import { describe, it, expect } from "vitest";
import { ruleRowSchema, errataRowSchema } from "../rules";

describe("ruleRowSchema", () => {
  it("devrait accepter une règle valide", () => {
    const ok = ruleRowSchema.safeParse({
      number: "418.5b",
      kind: "rule",
      chapter: 4,
      title: null,
      body: "Pour payer le coût de lancement d'un Allié…",
      sort_order: 512,
    });
    expect(ok.success).toBe(true);
  });

  it("devrait refuser un kind inconnu", () => {
    const ko = ruleRowSchema.safeParse({
      number: "418",
      kind: "paragraphe",
      chapter: 4,
      sort_order: 1,
    });
    expect(ko.success).toBe(false);
  });

  it("devrait refuser un chapitre hors 1..8", () => {
    const ko = ruleRowSchema.safeParse({
      number: "9.1",
      kind: "rule",
      chapter: 9,
      body: "x",
      sort_order: 1,
    });
    expect(ko.success).toBe(false);
  });
});

describe("errataRowSchema", () => {
  it("devrait accepter un errata valide", () => {
    const ok = errataRowSchema.safeParse({
      card_id: "opee-tissoin-incarnam",
      errata_date: "2010-12-01",
      source: "Forum officiel Wakfu",
      summary: "Passe à 6 PA.",
      before_text: "7 PA",
      after_text: "6 PA",
      sort_order: 0,
    });
    expect(ok.success).toBe(true);
  });

  it("devrait refuser un errata sans summary", () => {
    const ko = errataRowSchema.safeParse({
      card_id: "x-incarnam",
      sort_order: 0,
    });
    expect(ko.success).toBe(false);
  });
});

describe("errataChangeSchema / changes", () => {
  it("devrait accepter un errata avec des changements structurés", () => {
    const ok = errataRowSchema.safeParse({
      card_id: "opee-tissoin-incarnam",
      summary: "Passe à 6 PA.",
      sort_order: 0,
      changes: [{ label: "PA", before: "7", after: "6" }],
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.changes).toHaveLength(1);
  });

  it("devrait défaut à [] quand changes est absent (colonne pas encore migrée)", () => {
    const ok = errataRowSchema.safeParse({
      card_id: "x-incarnam",
      summary: "Texte.",
      sort_order: 0,
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.changes).toEqual([]);
  });

  it("devrait refuser un changement sans label", () => {
    const ko = errataRowSchema.safeParse({
      card_id: "x-incarnam",
      summary: "Texte.",
      sort_order: 0,
      changes: [{ before: "7", after: "6" }],
    });
    expect(ko.success).toBe(false);
  });
});
