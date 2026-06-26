import { z } from "zod";
import { cardElementSchema, cardKeywordSchema } from "./primitives";
import { mechanicTagSchema } from "./mechanics";

const zonesSchema = z.array(z.enum(["monde", "havreSac"]));

export const compiledEffectOpSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("gainXp"), n: z.number() }),
  z.object({ op: z.literal("draw"), n: z.number() }),
  z.object({ op: z.literal("heroGainPv"), n: z.number() }),
  z.object({ op: z.literal("heroLosePv"), n: z.number() }),
  z.object({ op: z.literal("damageOppHero"), n: z.number() }),
  z.object({ op: z.literal("havreSacGainResistance"), n: z.number() }),
  z.object({
    op: z.literal("destroyTarget"),
    what: z.enum(["Allié", "Zone", "Équipement"]),
    zones: zonesSchema,
  }),
  z.object({
    op: z.literal("damageTarget"),
    n: z.number(),
    element: z.string(),
    heroes: z.boolean(),
    zones: zonesSchema,
  }),
  z.object({ op: z.literal("healHeroTarget"), n: z.number() }),
  z.object({
    op: z.literal("buffForceTarget"),
    n: z.number(),
    heroes: z.boolean(),
    sub: z.string().optional(),
    zones: zonesSchema,
  }),
  z.object({ op: z.literal("buffForceSelf"), n: z.number() }),
  z.object({
    op: z.literal("recycleFromDiscard"),
    n: z.number(),
    element: z.string().optional(),
  }),
  z.object({ op: z.literal("discardFromHand"), n: z.number() }),
  z.object({
    op: z.literal("searchDeck"),
    what: z.enum(["Dofus", "Action", "Équipement", "Zone", "Salle", "Allié"]),
    sub: z.string().optional(),
    maxLevel: z.number().optional(),
    tapped: z.boolean().optional(),
    dest: z.enum(["main", "monde"]),
  }),
  z.object({ op: z.literal("shuffleDeck") }),
  z.object({ op: z.literal("destroySelf") }),
  z.object({
    op: z.literal("loseStatTurn"),
    stat: z.enum(["pa", "pm"]),
    n: z.number(),
  }),
  z.object({ op: z.literal("tapSelf") }),
  z.object({
    op: z.literal("combatModSelf"),
    force: z.number().optional(),
    pm: z.number().optional(),
    geant: z.boolean().optional(),
  }),
  z.object({
    op: z.literal("buffForceAlliesMondeTurn"),
    n: z.union([z.number(), z.literal("heroLevel")]),
  }),
  z.object({ op: z.literal("globalDamageShield") }),
]);

export const staticAbilitySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("forceAura"), n: z.number(), sub: z.string() }),
  z.object({ kind: z.literal("forceWhileBlocking"), n: z.number() }),
  z.object({ kind: z.literal("forceEqualsHandSize") }),
  z.object({ kind: z.literal("cannotBlock") }),
  z.object({ kind: z.literal("combatDamageReduction"), n: z.number() }),
]);

export const compiledEffectSchema = z.object({
  trigger: z.enum([
    "onArrive",
    "onTap",
    "onPlay",
    "onTurnStart",
    "static",
    "onSelfAttacks",
    "onDamageToBearer",
  ]),
  optional: z.boolean().optional(),
  cost: z.literal("sacrificeSelf").optional(),
  orElse: z.literal("destroySelf").optional(),
  static: staticAbilitySchema.optional(),
  ops: z.array(compiledEffectOpSchema),
});

export const effectCoverageSchema = z.enum([
  "auto",
  "manual",
  "uncovered",
  "ruling",
  "keyword",
  "trait",
]);

export const cardEffectSchema = z.object({
  description: z.string(),
  elements: z.array(cardElementSchema).optional(),
  isOncePerTurn: z.boolean().optional(),
  requiresIncline: z.boolean().optional(),
  kind: z.enum(["ruling", "errata"]).optional(),
  compiled: compiledEffectSchema.optional(),
  // Optionnels dans le TYPE (factories/consommateurs ne cassent pas) ; leur
  // présence sur les données réelles est imposée par tests/data/coverage.spec.ts.
  coverage: effectCoverageSchema.optional(),
  mechanics: z.array(mechanicTagSchema).optional(),
  linkedTokens: z
    .array(
      z.object({
        name: z.string(),
        type: z.array(z.string()),
        force: z.number().optional(),
        elements: z.array(cardElementSchema).optional(),
      }),
    )
    .optional(),
});

export const cardKeywordInfoSchema = z.object({
  name: cardKeywordSchema,
  description: z.string(),
  value: z.number().optional(),
  elements: z.array(cardElementSchema).optional(),
});
