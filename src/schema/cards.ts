import { z } from "zod";
import {
  baseStatsSchema,
  cardElementSchema,
  cardMainTypeSchema,
  cardRaritySchema,
  elementalStatSchema,
  extensionInfoSchema,
  requirementsSchema,
} from "./primitives";
import { cardEffectSchema, cardKeywordInfoSchema } from "./effects";

// Champs partagés par toutes les cartes (mainType redéfini par chaque sous-type).
export const baseCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  mainType: cardMainTypeSchema,
  subTypes: z.array(z.string()),
  extension: extensionInfoSchema,
  rarity: cardRaritySchema,
  stats: baseStatsSchema.optional(),
  effects: z.array(cardEffectSchema).optional(),
  keywords: z.array(cardKeywordInfoSchema).optional(),
  experience: z.number().optional(),
  metier: z.enum(["Bricoleur", "Forgeron", "Bijoutier", "Armurier"]).optional(),
  artists: z.array(z.string()),
  notes: z.array(z.string()).optional(),
  flavor: z
    .object({ text: z.string(), attribution: z.string().optional() })
    .optional(),
  imageUrl: z.string().optional(),
  url: z.string().optional(),
});

// `.strict()` (Zod v4) sur chaque membre rejette les clés top-level inconnues :
// le gate de validation devient réel (typos / champs périmés échouent au lieu
// d'être silencieusement strippés). Vérifié empiriquement : strict + extend
// reste compatible avec z.discriminatedUnion en Zod v4.
const heroFaceSchema = z
  .object({
    stats: baseStatsSchema,
    effects: z.array(cardEffectSchema),
    keywords: z.array(cardKeywordInfoSchema),
    // Donnée réelle : les faces `recto`/`verso` portent un `imageUrl` — seule
    // clé non modélisée trouvée dans les données une fois ajoutée.
    imageUrl: z.string().optional(),
  })
  .strict();

export const allyCardSchema = baseCardSchema
  .extend({
    mainType: z.literal("Allié"),
    stats: baseStatsSchema,
    race: z.string().optional(),
    tribe: z.string().optional(),
  })
  .strict();

export const actionCardSchema = baseCardSchema
  .extend({
    mainType: z.literal("Action"),
    effects: z.array(cardEffectSchema),
    spellSchool: z.string().optional(),
  })
  .strict();

export const equipmentCardSchema = baseCardSchema
  .extend({
    mainType: z.literal("Équipement"),
    equipmentType: z.enum([
      "Arme",
      "Armure",
      "Bijou",
      "Bouclier",
      "Dofus",
      "Familier",
      "Objet",
    ]),
    durability: z.number().optional(),
    requirements: requirementsSchema.optional(),
  })
  .strict();

export const zoneCardSchema = baseCardSchema
  .extend({
    mainType: z.literal("Zone"),
    effects: z.array(cardEffectSchema),
    zoneType: z.string().optional(),
  })
  .strict();

export const roomCardSchema = baseCardSchema
  .extend({
    mainType: z.literal("Salle"),
    effects: z.array(cardEffectSchema),
    roomType: z.string().optional(),
  })
  .strict();

export const dofusCardSchema = baseCardSchema
  .extend({
    mainType: z.literal("Dofus"),
    effects: z.array(cardEffectSchema),
    requirements: requirementsSchema.optional(),
  })
  .strict();

export const heroCardSchema = baseCardSchema
  .extend({
    mainType: z.literal("Héros"),
    class: z.string(),
    // Donnée réelle : `level` est un stat élémentaire {value, element} (25/26
    // Héros), parfois un simple nombre (1 carte) — accepter les deux formes.
    level: z.union([z.number(), elementalStatSchema]).optional(),
    recto: heroFaceSchema,
    verso: heroFaceSchema.optional(),
  })
  .strict();

export const protectorCardSchema = baseCardSchema
  .extend({
    mainType: z.literal("Protecteur"),
    stats: baseStatsSchema,
    effects: z.array(cardEffectSchema),
    guardianType: z.string().optional(),
  })
  .strict();

export const havenBagCardSchema = baseCardSchema
  .extend({
    mainType: z.literal("Havre-Sac"),
    effects: z.array(cardEffectSchema),
    capacity: z.number().optional(),
  })
  .strict();

export const elementalAllyCardSchema = baseCardSchema
  .extend({
    mainType: z.literal("Allié Élémentaire"),
    stats: baseStatsSchema,
    elements: z.array(cardElementSchema),
    // Donnée réelle : `elementalAffinity` est présent mais vide ({}) pour les
    // Alliés Élémentaires de Draft — `primary` doit donc être optionnel.
    elementalAffinity: z
      .object({
        primary: cardElementSchema.optional(),
        secondary: cardElementSchema.optional(),
      })
      .optional(),
  })
  .strict();

export const cardSchema = z.discriminatedUnion("mainType", [
  allyCardSchema,
  actionCardSchema,
  equipmentCardSchema,
  zoneCardSchema,
  roomCardSchema,
  dofusCardSchema,
  heroCardSchema,
  protectorCardSchema,
  havenBagCardSchema,
  elementalAllyCardSchema,
]);
