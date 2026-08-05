import { describe, it, expect } from "vitest";
import {
  userRoleSchema,
  ruleEffectiveRowSchema,
  auditRowSchema,
  ruleOverrideRowSchema,
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

describe("ruleOverrideRowSchema", () => {
  it("devrait accepter une correction minimale (number + chapter + body)", () => {
    const ok = ruleOverrideRowSchema.safeParse({
      number: "418.5b",
      chapter: 4,
      body: "Texte corrigé.",
    });
    expect(ok.success).toBe(true);
  });

  it("devrait refuser une ligne sans chapter — finding 5 : une règle AJOUTÉE n'a pas de ligne `r` en face dans la vue, donc `chapter` doit toujours venir de l'override", () => {
    expect(
      ruleOverrideRowSchema.safeParse({
        number: "418.5b",
        body: "Sans chapitre.",
      }).success,
    ).toBe(false);
  });

  it("devrait appliquer les défauts kind='rule' et sort_order=0 quand ils sont omis (miroir des défauts colonne de la migration 0013)", () => {
    const result = ruleOverrideRowSchema.safeParse({
      number: "418.5b",
      chapter: 4,
      body: "Texte corrigé.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe("rule");
      expect(result.data.sort_order).toBe(0);
    }
  });

  // Finding 5 : reproduit ce que la vue `rules_effective` émet pour une règle
  // AJOUTÉE (aucune ligne `r` en face, `body_official` est donc null) une
  // fois que `rules_overrides` garantit kind/chapter/sort_order non-null —
  // avant le fix, ces trois colonnes pouvaient être NULL côté override et la
  // ligne de vue échouait silencieusement au safeParse de ruleEffectiveRowSchema.
  it("devrait accepter une ligne de vue pour une règle AJOUTÉE, sans ligne `r` en face", () => {
    const ok = ruleEffectiveRowSchema.safeParse({
      number: "418.5z",
      kind: "rule",
      chapter: 4,
      title: "Nouvelle règle",
      body: "Texte de la règle ajoutée.",
      sort_order: 0,
      is_edited: true,
      body_official: null,
      updated_by: "11111111-1111-1111-1111-111111111111",
      updated_at: "2026-07-24T10:00:00Z",
    });
    expect(ok.success).toBe(true);
  });

  it("devrait accepter une règle AJOUTÉE (avec kind, chapter, sort_order)", () => {
    const ok = ruleOverrideRowSchema.safeParse({
      number: "418.5c",
      kind: "rule",
      chapter: 4,
      body: "Règle ajoutée.",
      sort_order: 512,
    });
    expect(ok.success).toBe(true);
  });

  it("devrait accepter une ligne lue de la base (avec updated_by et updated_at gérés par le serveur) et préserver ces champs", () => {
    const input = {
      number: "418.5d",
      kind: "rule",
      chapter: 4,
      body: "Règle lue de la base.",
      sort_order: 512,
      updated_by: "11111111-1111-1111-1111-111111111111",
      updated_at: "2026-07-24T10:00:00Z",
    };
    const result = ruleOverrideRowSchema.safeParse(input);
    expect(result.success).toBe(true);
    // CRITICAL: assert that updated_by and updated_at survive the parse
    if (result.success) {
      expect(result.data.updated_by).toBe(
        "11111111-1111-1111-1111-111111111111",
      );
      expect(result.data.updated_at).toBe("2026-07-24T10:00:00Z");
    }
  });

  it("devrait refuser une ligne sans number (clé primaire)", () => {
    expect(
      ruleOverrideRowSchema.safeParse({
        kind: "rule",
        chapter: 4,
        body: "Sans numéro.",
        sort_order: 512,
      }).success,
    ).toBe(false);
  });
});
