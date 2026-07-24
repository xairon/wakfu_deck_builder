import { describe, it, expect } from "vitest";
import {
  userRoleSchema,
  ruleEffectiveRowSchema,
  auditRowSchema,
} from "../admin";

describe("userRoleSchema", () => {
  it("devrait accepter les trois rôles", () => {
    for (const r of ["user", "admin", "owner"])
      expect(userRoleSchema.safeParse(r).success).toBe(true);
  });

  it("devrait refuser un rôle inconnu", () => {
    expect(userRoleSchema.safeParse("superadmin").success).toBe(false);
  });
});

describe("ruleEffectiveRowSchema", () => {
  it("devrait accepter une règle corrigée (is_edited + body_official)", () => {
    const ok = ruleEffectiveRowSchema.safeParse({
      number: "418.5b",
      kind: "rule",
      chapter: 4,
      title: null,
      body: "Texte corrigé.",
      sort_order: 512,
      is_edited: true,
      body_official: "Texte officiel.",
      updated_by: "11111111-1111-1111-1111-111111111111",
      updated_at: "2026-07-24T10:00:00Z",
    });
    expect(ok.success).toBe(true);
  });

  it("devrait accepter une règle AJOUTÉE (body_official null)", () => {
    const ok = ruleEffectiveRowSchema.safeParse({
      number: "418.5c",
      kind: "rule",
      chapter: 4,
      body: "Règle ajoutée.",
      sort_order: 512,
      is_edited: true,
      body_official: null,
    });
    expect(ok.success).toBe(true);
  });

  it("devrait refuser un chapitre hors 1..8", () => {
    expect(
      ruleEffectiveRowSchema.safeParse({
        number: "9.1",
        kind: "rule",
        chapter: 9,
        sort_order: 1,
        is_edited: false,
      }).success,
    ).toBe(false);
  });
});

describe("auditRowSchema", () => {
  it("devrait accepter une ligne système (actor null)", () => {
    const ok = auditRowSchema.safeParse({
      id: 1,
      actor: null,
      action: "create",
      entity: "errata",
      entity_key: "42",
      before_data: null,
      after_data: { summary: "x" },
      created_at: "2026-07-24T10:00:00Z",
    });
    expect(ok.success).toBe(true);
  });

  it("devrait refuser une action inconnue", () => {
    expect(
      auditRowSchema.safeParse({
        id: 1,
        action: "purge",
        entity: "errata",
        entity_key: "42",
        created_at: "2026-07-24T10:00:00Z",
      }).success,
    ).toBe(false);
  });
});
