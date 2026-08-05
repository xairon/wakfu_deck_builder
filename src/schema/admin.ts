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
 *
 * `chapter` est requis (la colonne est `not null` en base, sans défaut : une
 * règle ajoutée appartient toujours à un chapitre choisi par l'admin — sans
 * ça, `rules_effective` ne peut pas la rendre). `kind`/`sort_order` sont
 * optionnels EN ENTRÉE seulement : la colonne a un défaut ('rule' / 0) côté
 * base, donc un appelant qui les omet obtient quand même une ligne valide.
 */
export const ruleOverrideRowSchema = z.object({
  number: z.string().min(1),
  kind: z.enum(["chapter", "section", "rule"]).default("rule"),
  chapter: z.number().int().min(1).max(8),
  title: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  sort_order: z.number().int().default(0),
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
/**
 * `z.input`, pas `z.infer`/`z.output` : `kind`/`sort_order` ont un
 * `.default()`, donc l'appelant qui CONSTRUIT une ligne (avant parsing) peut
 * les omettre — `z.infer` donnerait le type de SORTIE (après application du
 * défaut), où ils redeviennent obligatoires, ce qui casserait tous les
 * appels de `upsertRuleOverride()` qui ne précisent pas `kind`/`sort_order`.
 */
export type RuleOverrideRow = z.input<typeof ruleOverrideRowSchema>;
export type AuditRow = z.infer<typeof auditRowSchema>;
