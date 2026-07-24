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

/** Une ligne de la table `card_errata` (un errata rattaché à une carte). */
export const errataRowSchema = z.object({
  card_id: z.string().min(1),
  errata_date: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  summary: z.string().min(1),
  before_text: z.string().nullable().optional(),
  after_text: z.string().nullable().optional(),
  sort_order: z.number().int().default(0),
});

export type RuleRow = z.infer<typeof ruleRowSchema>;
export type ErrataRow = z.infer<typeof errataRowSchema>;
