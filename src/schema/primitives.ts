import { z } from "zod";

export const cardRaritySchema = z.enum([
  "Commune",
  "Peu Commune",
  "Rare",
  "Mythique",
  "Légendaire",
  "Krosmaster",
]);

export const cardElementSchema = z.enum([
  "Air",
  "Eau",
  "Feu",
  "Terre",
  "Neutre",
]);

export const cardMainTypeSchema = z.enum([
  "Allié",
  "Action",
  "Équipement",
  "Zone",
  "Salle",
  "Dofus",
  "Héros",
  "Protecteur",
  "Havre-Sac",
  "Allié Élémentaire",
]);

export const cardKeywordSchema = z.enum([
  "Inclinaison",
  "Riposte",
  "Portée",
  "Critique",
  "Parade",
  "Résistance",
  "Recette",
  "Géant",
  "Unique",
]);

export const elementalCostSchema = z.object({
  element: cardElementSchema,
  count: z.number(),
});

export const elementalStatSchema = z.object({
  value: z.number(),
  element: cardElementSchema,
});

export const baseStatsSchema = z.object({
  niveau: elementalStatSchema.optional(),
  force: elementalStatSchema.optional(),
  pa: z.number().optional(),
  pm: z.number().optional(),
  pv: z.number().optional(),
  cost: z.number().optional(),
  taille: z.number().optional(),
  resistance: z.number().optional(),
});

export const professionSchema = z.object({
  name: z.string(),
  level: z.number(),
  specialization: z.string().optional(),
});

// `name` : z.string() (les noms scrapés ne correspondent pas toujours aux clés
// EXTENSION_LEVELS) ; `id` : optionnel (absent des données).
export const extensionInfoSchema = z.object({
  name: z.string(),
  id: z.string().optional(),
  number: z.string().optional(),
  shortUrl: z.string().optional(),
});

export const requirementsSchema = z.object({
  level: z.number().optional(),
  professions: z.array(z.string()).optional(),
  elements: z.array(cardElementSchema).optional(),
});
