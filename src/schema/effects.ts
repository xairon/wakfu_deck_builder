import { z } from "zod";
import { cardElementSchema, cardKeywordSchema } from "./primitives";
import { mechanicTagSchema } from "./mechanics";

const zonesSchema = z.array(z.enum(["monde", "havreSac"]));
const controllerSchema = z.enum(["self", "opponent"]);

export const compiledEffectOpSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("gainXp"), n: z.number() }),
  z.object({ op: z.literal("draw"), n: z.number() }),
  z.object({ op: z.literal("heroGainPv"), n: z.number() }),
  z.object({ op: z.literal("heroLosePv"), n: z.number() }),
  z.object({ op: z.literal("damageOppHero"), n: z.number() }),
  z.object({ op: z.literal("havreSacGainResistance"), n: z.number() }),
  z.object({
    op: z.literal("destroyTarget"),
    // Cas mono-type historique (« Détruisez l'Allié de votre choix »).
    what: z.enum(["Allié", "Zone", "Équipement", "Dofus"]).optional(),
    // Cas multi-type (« Détruisez l'Équipement ou la Zone de votre choix »).
    whatAny: z
      .array(z.enum(["Allié", "Zone", "Équipement", "Dofus"]))
      .optional(),
    // Famille requise (« Détruisez l'Allié [Famille] de votre choix »).
    sub: z.string().optional(),
    // Niveau max (« … de Niveau inférieur ou égal à N »). Cible sans Niveau
    // = inéligible (cf. matchesPickFilter, missing = +Infinity).
    maxLevel: z.number().optional(),
    zones: zonesSchema,
  }),
  z.object({
    op: z.literal("damageTarget"),
    n: z.number(),
    element: z.string(),
    heroes: z.boolean(),
    // Famille requise (« … à l'Allié [Famille] de votre choix »).
    sub: z.string().optional(),
    zones: zonesSchema,
  }),
  // « [X] inflige sa Force en Dommages à l'Allié (ou Héros) de votre choix » :
  // op à cible dont le montant = Force effective de la SOURCE à la résolution
  // (410.1, dommages de l'élément de la source).
  z.object({
    op: z.literal("damageTargetByForce"),
    element: z.string(),
    heroes: z.boolean().optional(),
    controller: controllerSchema.optional(),
    zones: zonesSchema,
  }),
  z.object({ op: z.literal("eachPlayerDraws"), n: z.number() }),
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
  // « Tous vos adversaires perdent N PA/PM jusqu'à la fin du tour. » — en 1v1
  // l'unique adversaire ; pas de « de votre choix » (cible déterministe).
  z.object({
    op: z.literal("oppLoseStatTurn"),
    stat: z.enum(["pa", "pm"]),
    n: z.number(),
  }),
  // « Votre Héros gagne +N en Force jusqu'à la fin du tour. » — jeton forceMod
  // sur VOTRE Héros (purgé en fin de tour), comme buffForceTarget mais sujet fixe.
  z.object({ op: z.literal("buffForceHeroSelf"), n: z.number() }),
  // « Redressez votre Héros. » — SET_ORIENTATION upright sur VOTRE Héros.
  z.object({ op: z.literal("untapHeroSelf") }),
  z.object({ op: z.literal("tapSelf") }),
  // « Redressez [cette carte]. » — SET_ORIENTATION upright sur la SOURCE
  // (no-op si déjà dressée). Pendant de tapSelf.
  z.object({ op: z.literal("untapSelf") }),
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
  z.object({
    op: z.literal("tapTarget"),
    heroes: z.boolean().optional(),
    controller: controllerSchema.optional(),
    zones: zonesSchema,
  }),
  z.object({
    op: z.literal("untapTarget"),
    heroes: z.boolean().optional(),
    controller: controllerSchema.optional(),
    zones: zonesSchema,
  }),
  z.object({
    op: z.literal("returnToHand"),
    heroes: z.boolean().optional(),
    controller: controllerSchema.optional(),
    zones: zonesSchema,
  }),
]);

export const staticAbilitySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("forceAura"),
    n: z.number(),
    // Famille bénéficiaire (« vos autres Alliés Bouftous »). Absente = toutes
    // vos autres créatures éligibles, sans restriction de Famille.
    sub: z.string().optional(),
    // « et Héros » / « Alliés ou Héros » : votre Héros bénéficie aussi de l'aura.
    heroes: z.boolean().optional(),
  }),
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
