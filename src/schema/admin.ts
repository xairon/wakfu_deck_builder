import { z } from "zod";

/** Rôle d'un compte. `owner` n'est jamais attribuable via l'API (cf. set_user_role). */
export const userRoleSchema = z.enum(["user", "admin", "owner"]);

/** Une ligne de la vue `rules_effective` (règle importée, corrigée, ou ajoutée). */
export const ruleEffectiveRowSchema = z.object({
  number: z.string().min(1),
  kind: z.enum(["chapter", "section", "rule"]),
  chapter: z.number().int().min(1).max(8),
  title: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  sort_order: z.number().int(),
  is_edited: z.boolean(),
  /** Texte officiel d'origine ; null pour une règle AJOUTÉE (aucun import en face). */
  body_official: z.string().nullable().optional(),
  updated_by: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});

/**
 * Une ligne de `rules_overrides`.
 *
 * Champs gérés par le serveur (ne jamais fournis par l'appelant) :
 * - `updated_by` : défini par `adminService.upsertRuleOverride()` à partir de la session
 * - `updated_at` : défini automatiquement par un trigger PostgreSQL (now())
 */
export const ruleOverrideRowSchema = z.object({
  number: z.string().min(1),
  kind: z.enum(["chapter", "section", "rule"]).nullable().optional(),
  chapter: z.number().int().min(1).max(8).nullable().optional(),
  title: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  sort_order: z.number().int().nullable().optional(),
  updated_by: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});

/** Une ligne du journal. `actor` null = écriture système (seed). */
export const auditRowSchema = z.object({
  id: z.number().int(),
  actor: z.string().nullable().optional(),
  action: z.enum(["create", "update", "delete"]),
  entity: z.enum(["rule_override", "errata", "role"]),
  entity_key: z.string(),
  before_data: z.unknown().nullable().optional(),
  after_data: z.unknown().nullable().optional(),
  created_at: z.string(),
});

export type UserRole = z.infer<typeof userRoleSchema>;
export type RuleEffectiveRow = z.infer<typeof ruleEffectiveRowSchema>;
export type RuleOverrideRow = z.infer<typeof ruleOverrideRowSchema>;
export type AuditRow = z.infer<typeof auditRowSchema>;
