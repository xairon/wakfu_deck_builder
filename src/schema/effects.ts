import { z } from "zod";
import { cardElementSchema, cardKeywordSchema } from "./primitives";
import { mechanicTagSchema } from "./mechanics";

const zonesSchema = z.array(z.enum(["monde", "havreSac"]));
const controllerSchema = z.enum(["self", "opponent"]);
// « l'Allié incliné / dressé de votre choix » (orientation imprimée sur la
// cible) — filtre fidèle lu sur inst.orientation.
const orientationFilterSchema = z.enum(["tapped", "upright"]);
// « l'Allié ou Héros attaquant / bloqueur de votre choix » — rôle dans le
// combat EN COURS (state.combat) ; hors combat, aucune cible éligible.
// « inCombat » = « attaquant OU bloqueur » (l'un OU l'autre rôle).
const combatRoleSchema = z.enum(["attacking", "blocking", "inCombat"]);

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
    // Niveau EXACT (« … de Niveau N ») — distinct de maxLevel (≤). Cible sans
    // Niveau = inéligible.
    exactLevel: z.number().optional(),
    // Type d'Équipement requis (« Détruisez l'Arme / l'Armure … de votre
    // choix ») — lu sur card.equipmentType.
    equipType: z.string().optional(),
    // Orientation imprimée (« l'Allié incliné / dressé de votre choix »).
    orientation: orientationFilterSchema.optional(),
    // Rôle de combat (« l'Allié ou Héros attaquant / bloqueur de votre choix »).
    combatRole: combatRoleSchema.optional(),
    zones: zonesSchema,
  }),
  z.object({
    op: z.literal("damageTarget"),
    n: z.number(),
    element: z.string(),
    heroes: z.boolean(),
    // Famille requise (« … à l'Allié [Famille] de votre choix »).
    sub: z.string().optional(),
    // Niveau EXACT (« … de Niveau N de votre choix »). Cible sans Niveau =
    // inéligible.
    exactLevel: z.number().optional(),
    // Orientation imprimée (« … à l'Allié incliné / dressé de votre choix »).
    orientation: orientationFilterSchema.optional(),
    // Rôle de combat (« … à l'Allié ou Héros attaquant / bloqueur »).
    combatRole: combatRoleSchema.optional(),
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
    // Orientation imprimée (« l'Allié incliné / dressé de votre choix »).
    orientation: orientationFilterSchema.optional(),
    // Rôle de combat (« l'Allié ou Héros attaquant / bloqueur de votre choix »).
    combatRole: combatRoleSchema.optional(),
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
  // « Mettez en jeu un [Allié/Zone/Salle/Équipement] [Famille]? [de Niveau ≤ N]?
  // de votre main / Défausse. » — le joueur choisit une carte CORRESPONDANTE
  // dans sa main ou sa Défausse et la met en jeu (Monde) ; ses effets
  // d'apparition se déclenchent (cascade). Réutilise la machinerie de pick de
  // searchDeck (zone configurable, action toMonde). `tapped` = « il apparaît
  // incliné ». PAS de création de jeton (« Invoquez … » reste manuel).
  z.object({
    op: z.literal("putInPlay"),
    from: z.enum(["main", "defausse"]),
    what: z.enum(["Allié", "Zone", "Salle", "Équipement"]),
    sub: z.string().optional(),
    maxLevel: z.number().optional(),
    // Niveau EXACT (« Mettez en jeu un Monstre de Niveau N … ») — distinct de
    // maxLevel (≤). Une carte sans Niveau est inéligible (manquant ≠ N).
    exactLevel: z.number().optional(),
    tapped: z.boolean().optional(),
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
    // Orientation imprimée (« inclinez l'Allié dressé de votre choix »).
    orientation: orientationFilterSchema.optional(),
    // Rôle de combat (« inclinez l'Allié attaquant / bloqueur de votre choix »).
    combatRole: combatRoleSchema.optional(),
    zones: zonesSchema,
  }),
  z.object({
    op: z.literal("untapTarget"),
    heroes: z.boolean().optional(),
    controller: controllerSchema.optional(),
    // Orientation imprimée (« redressez l'Allié incliné de votre choix »).
    orientation: orientationFilterSchema.optional(),
    // Rôle de combat (« redressez l'Allié attaquant / bloqueur de votre choix »).
    combatRole: combatRoleSchema.optional(),
    zones: zonesSchema,
  }),
  z.object({
    op: z.literal("returnToHand"),
    heroes: z.boolean().optional(),
    controller: controllerSchema.optional(),
    zones: zonesSchema,
  }),
  // COÛT de pouvoir payé « Inclinez un de vos X : … » : op de CIBLAGE (première
  // op d'une séquence cost:"paidOps"). Le joueur choisit une de SES créatures
  // (controller = acteur) éligible et DRESSÉE, qui est alors inclinée
  // (SET_ORIENTATION tapped). `heroes` : le coût accepte aussi un Héros (« un de
  // vos Alliés ou Héros »). `sub` : Famille requise. `excludeSource` : « un
  // AUTRE de vos … » (la source du pouvoir ne peut pas se payer elle-même).
  z.object({
    op: z.literal("costTapControlled"),
    heroes: z.boolean().optional(),
    sub: z.string().optional(),
    maxLevel: z.number().optional(),
    excludeSource: z.boolean().optional(),
    zones: zonesSchema,
  }),
  // COÛT de pouvoir payé « Détruisez un de vos X : … » : op de CIBLAGE. Le joueur
  // choisit une de SES créatures éligible, qui est alors DÉTRUITE
  // (resolveDestroyTarget — un Allié détruit rapporte son XP à l'adversaire,
  // 415.1, fidèle). Mêmes filtres que costTapControlled (sans contrainte
  // d'orientation : on peut détruire une carte inclinée comme dressée).
  z.object({
    op: z.literal("costDestroyControlled"),
    heroes: z.boolean().optional(),
    sub: z.string().optional(),
    maxLevel: z.number().optional(),
    excludeSource: z.boolean().optional(),
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

// « Quand un Allié [Famille]? [adverse]? apparaît … » : descripteur de VEILLE
// (onOtherAppears). Décrit la carte qui APPARAÎT (pas la carte qui veille) :
// son mainType, sa Famille éventuelle (`sub`, lue sur subTypes) et le
// contrôleur relatif au veilleur (« adverse » → opponent). Le CORPS (ops) a
// pour sujet le contrôleur du veilleur.
const appearanceWatchSchema = z.object({
  mainType: z.enum(["Allié", "Héros"]),
  sub: z.string().optional(),
  controller: controllerSchema.optional(),
});

export const compiledEffectSchema = z.object({
  trigger: z.enum([
    "onArrive",
    "onTap",
    "onPlay",
    "onTurnStart",
    "static",
    "onSelfAttacks",
    "onOtherAppears",
    "onDamageToBearer",
  ]),
  optional: z.boolean().optional(),
  // "sacrificeSelf" : le coût est de sacrifier la SOURCE (« Détruisez [cette
  // carte] : … »). "paidOps" : le coût est la PREMIÈRE op de la séquence (op de
  // ciblage costTap/costDestroyControlled, « Inclinez/Détruisez un de vos X :
  // … ») — la source n'est ni inclinée ni sacrifiée automatiquement.
  cost: z.enum(["sacrificeSelf", "paidOps"]).optional(),
  orElse: z.literal("destroySelf").optional(),
  static: staticAbilitySchema.optional(),
  // Présent uniquement pour trigger:"onOtherAppears".
  watch: appearanceWatchSchema.optional(),
  // ACTOR-BINDING : le CORPS a pour sujet (source) une créature désignée par le
  // contexte, pas la carte qui porte l'effet (« …, il/elle inflige sa Force … »).
  //  - "appeared"   : la créature qui vient d'APPARAÎTRE (onOtherAppears) ; le
  //    moteur enfile la frame avec sourceId = instance apparue, seat = veilleur.
  //  - "costTarget" : la créature SÉLECTIONNÉE par le coût (cost:"paidOps",
  //    costTapControlled en première op) ; le moteur réécrit le sourceId de la
  //    frame en attente vers l'instance choisie au moment du paiement du coût.
  // Les ops du corps (damageTargetByForce/buffForceSelf) lisent alors ce
  // sourceId réécrit (Force et Élément calculés sur la créature liée).
  actor: z.enum(["appeared", "costTarget"]).optional(),
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
