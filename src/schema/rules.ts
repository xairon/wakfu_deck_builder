import { z } from "zod";

/** Une ligne de la table `rules` : chapitre, section, ou règle numérotée. */
export const ruleRowSchema = z.object({
  // "4" (chapitre) | "418" (section) | "418.5b" (règle) — ancre de deep-link.
  number: z.string().min(1),
  kind: z.enum(["chapter", "section", "rule"]),
  chapter: z.number().int().min(1).max(8),
  title: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  sort_order: z.number().int(),
});

/**
 * Un changement porté par un errata : « tel champ passe de X à Y ».
 * `label` est le nom du champ tel qu'il est montré au joueur (« PA »,
 * « Sous-types », « Effet ») — libre, pas une énumération : les errata touchent
 * des champs variés et le libellé officiel prime sur une taxonomie interne.
 * `before`/`after` sont des CHAÎNES affichées telles quelles : on affiche, on ne
 * recalcule aucune version de carte.
 */
export const errataChangeSchema = z.object({
  label: z.string().min(1),
  before: z.string(),
  after: z.string(),
});

/** Une ligne de la table `card_errata` (un errata rattaché à une carte). */
export const errataRowSchema = z.object({
  card_id: z.string().min(1),
  errata_date: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  summary: z.string().min(1),
  before_text: z.string().nullable().optional(),
  after_text: z.string().nullable().optional(),
  sort_order: z.number().int().default(0),
  changes: z.array(errataChangeSchema).default([]),
});

export type RuleRow = z.infer<typeof ruleRowSchema>;
export type ErrataRow = z.infer<typeof errataRowSchema>;
export type ErrataChange = z.infer<typeof errataChangeSchema>;
