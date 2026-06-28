import { z } from "zod";
import { cardElementSchema, cardKeywordSchema } from "./primitives";
import { mechanicTagSchema } from "./mechanics";

const zonesSchema = z.array(z.enum(["monde", "havreSac"]));
const controllerSchema = z.enum(["self", "opponent"]);
// Filtre de contrôleur des OPS DE MASSE (non interactives) : « vos » (self),
// « adverses » (opponent) ou aucune restriction (« tous les … » → any).
const massControllerSchema = z.enum(["self", "opponent", "any"]);
// « l'Allié incliné / dressé de votre choix » (orientation imprimée sur la
// cible) — filtre fidèle lu sur inst.orientation.
const orientationFilterSchema = z.enum(["tapped", "upright"]);
// « l'Allié ou Héros attaquant / bloqueur de votre choix » — rôle dans le
// combat EN COURS (state.combat) ; hors combat, aucune cible éligible.
// « inCombat » = « attaquant OU bloqueur » (l'un OU l'autre rôle).
const combatRoleSchema = z.enum(["attacking", "blocking", "inCombat"]);
// Mots-clés OCTROYABLES « jusqu'à la fin du tour » (grantKeyword{Self,Target}).
// STRICT : on n'autorise QUE les mots-clés ayant une SÉMANTIQUE DE COMBAT câblée
// (lue par effectiveKeywords → légalité) — un octroi d'un mot-clé inerte (Tacle,
// Fantôme, Défense, Renfort…) serait un no-op, donc une APPROXIMATION. Ceux-là
// restent manuels (le DSL ne les compile pas). Géant : répartition de Force au
// combat (7258/6135). Agilité : ne peut être bloqué que par Agilité (704).
// Agressivité : peut attaquer le tour de son apparition (lève le mal d'invocation).
const grantKeywordSchema = z.enum(["Géant", "Agilité", "Agressivité"]);

// ── CONDITIONS « Si <condition>, <corps> » (sous-système conditionnel) ────────
// Une `CondSpec` est une condition FAITHFULLY évaluable depuis l'état de jeu à
// la résolution de l'effet : si elle est FAUSSE, le corps (ops imbriquées de
// l'op `conditional`) est ignoré (no-op). On n'implémente QUE des conditions
// lisibles EXACTEMENT — toute condition non évaluable fidèlement reste manuelle
// (le DSL renvoie null → uncovered). « an approximation of gameplay is worse
// than a manual effect ».
const comparatorSchema = z.enum([">=", "==", "<="]);
export const condSpecSchema = z.discriminatedUnion("cond", [
  // « si [self] est dans le Monde / dans son Havre-Sac » : la SOURCE de l'effet
  // (frame.sourceId) est-elle dans la zone donnée au moment de résoudre ? FIDÈLE
  // — lu sur inst.location.zone. Sert aux pouvoirs « Au début de votre tour, si
  // [self] est dans le Monde, … » dont le déclencheur scanne déjà Monde +
  // Havre-Sac (la zone Défausse n'est PAS scannée → ces formes restent manuelles).
  z.object({
    cond: z.literal("selfInZone"),
    zone: z.enum(["monde", "havreSac"]),
  }),
  // « si votre Héros est de Niveau N (ou plus / ou moins) » : Niveau courant du
  // Héros de l'acteur (307.4/307.5, helper heroLevel) comparé à `n`. FIDÈLE.
  z.object({
    cond: z.literal("heroLevel"),
    op: comparatorSchema,
    n: z.number(),
  }),
  // « si vous contrôlez (au moins N) [Allié] [Famille] » : nombre d'Alliés que
  // l'acteur contrôle dans le Monde correspondant à `sub` (Famille, sur subTypes)
  // ≥ `min` (défaut 1). FIDÈLE — compte exact des instances en jeu. Exclut la
  // SOURCE de l'effet ? Non : « vous contrôlez » inclut toutes vos créatures.
  z.object({
    cond: z.literal("controlsAlly"),
    sub: z.string().optional(),
    min: z.number().optional(),
  }),
]);

// Le corps d'un op `conditional` est une séquence d'ops standard (récursive).
// On le valide via `z.lazy` pour casser la référence circulaire avec
// `compiledEffectOpSchema`. La référence paresseuse est annotée explicitement
// (`z.ZodTypeAny`) : sans cela TypeScript inférerait `any` pour le schéma entier
// (auto-référence dans son propre initialiseur) et tout le typage des ops
// s'effondrerait. La validation reste exacte au runtime (l'évaluation de la
// fonction lazy renvoie le vrai schéma d'op).
const conditionalBodySchema: z.ZodTypeAny = z.lazy(() =>
  z.array(compiledEffectOpSchema),
);

export const compiledEffectOpSchema = z.discriminatedUnion("op", [
  // « Si <condition>, <corps> » : exécute `ops` (le corps) UNIQUEMENT si `cond`
  // est vraie à la résolution (évaluée contre l'état/RulesCtx, bornée à la source
  // et à l'acteur de la frame). Si fausse, les ops du corps sont sautées (no-op
  // fidèle). Le corps est une séquence d'ops standard (récursive) — les ops à
  // cible / pile du corps mettent la frame en pause comme à plat. STRICT : une
  // condition non FAITHFULLY évaluable n'est jamais compilée (manuel).
  z.object({
    op: z.literal("conditional"),
    cond: condSpecSchema,
    ops: conditionalBodySchema,
  }),
  z.object({ op: z.literal("gainXp"), n: z.number() }),
  z.object({ op: z.literal("draw"), n: z.number() }),
  z.object({
    op: z.literal("heroGainPv"),
    n: z.number(),
    // « Votre Héros regagne X PV » / « … N PV par carte recyclée » : magnitude =
    // nombre de cartes recyclées (frame.boundCount), × perCount éventuel. Voir
    // damageTarget.fromCount.
    fromCount: z.boolean().optional(),
    perCount: z.number().optional(),
  }),
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
    // « … le même nombre de Dommages … » (valeur dynamique liée au COÛT de
    // recyclage « Recyclez jusqu'à N … : … ») : la magnitude est le NOMBRE de
    // cartes effectivement recyclées (frame.boundCount), pas `n`. Quand présent,
    // `n` sert de repli (0). Lié uniquement à un costRecycle{max:true} en amont.
    fromCount: z.boolean().optional(),
    // Multiplicateur par carte recyclée (« N Dommages par carte recyclée »).
    perCount: z.number().optional(),
    element: z.string(),
    heroes: z.boolean(),
    // « … au Héros de votre choix » : la cible est restreinte aux HÉROS (pas
    // d'Allié éligible). Exclusif avec `sub` (un Héros n'a pas de Famille).
    // `heroes` reste true par cohérence (un Héros est ciblable).
    targetHeroOnly: z.boolean().optional(),
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
  // « Choisissez jusqu'à N Alliés ou Héros [attaquants ou bloqueurs]?
  //   [différents]?. [La source] leur inflige X Dommages. » — DOMMAGES
  //   MULTI-CIBLES BORNÉS : le joueur choisit JUSQU'À `count` cibles (0..count ;
  //   « jusqu'à » → il peut s'arrêter avant), chacune subit X Dommages
  //   (resolveDamageTarget : Résistance / létalité / XP). `distinct` (« …
  //   différents ») : une même cible ne peut pas être choisie deux fois.
  //   `combatRole`/`heroes`/`zones` : mêmes filtres d'éligibilité que damageTarget.
  //   FIDÈLE : borne FIXE (pas « égal à … »), pas de clause résiduelle (PA, etc.).
  z.object({
    op: z.literal("damageMultiTarget"),
    n: z.number(),
    element: z.string(),
    // Nombre MAXIMAL de cibles distinctes (« jusqu'à N ») — borne, pas un quota.
    count: z.number(),
    // « … différents » : interdit de re-choisir une cible déjà touchée.
    distinct: z.boolean().optional(),
    heroes: z.boolean().optional(),
    // Rôle de combat (« … attaquants ou bloqueurs »). inCombat = l'un OU l'autre.
    combatRole: combatRoleSchema.optional(),
    zones: zonesSchema,
  }),
  z.object({ op: z.literal("eachPlayerDraws"), n: z.number() }),
  z.object({
    op: z.literal("healHeroTarget"),
    n: z.number(),
    // « Le Héros de votre choix regagne N PV par carte recyclée » — magnitude =
    // boundCount × perCount. Voir damageTarget.fromCount.
    fromCount: z.boolean().optional(),
    perCount: z.number().optional(),
  }),
  z.object({
    op: z.literal("buffForceTarget"),
    n: z.number(),
    // « La Force de l'Allié ou Héros de votre choix est augmentée du même nombre »
    // — magnitude = boundCount (× perCount). Voir damageTarget.fromCount.
    fromCount: z.boolean().optional(),
    perCount: z.number().optional(),
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
    // Niveau EXACT (« … de Niveau N ») — distinct de maxLevel (≤). Cible sans
    // Niveau = inéligible.
    exactLevel: z.number().optional(),
    tapped: z.boolean().optional(),
    // Pile de recherche : « dans votre Pioche » (défaut, mélange possible) ou
    // « dans votre Défausse » (« Cherchez … dans votre Défausse et prenez-la en
    // main » — la Défausse n'est pas mélangée). `from` absent = "pioche" pour
    // préserver les données et le comportement historiques.
    from: z.enum(["pioche", "defausse"]).optional(),
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
    // Niveau dans un ENSEMBLE (« … de Niveau 1 ou 2 … ») — carte sans Niveau
    // inéligible. Distinct de maxLevel/exactLevel (énumération exacte).
    levelIn: z.array(z.number()).optional(),
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
  // OPS « LE JOUEUR DE VOTRE CHOIX … » : choix d'un JOUEUR modélisé comme un
  // ciblage de HÉROS (ops de ciblage, éligibilité = tous les Héros en jeu, les
  // deux contrôleurs — on peut se choisir soi-même OU l'adversaire). L'effet
  // s'applique au CONTRÔLEUR du Héros choisi. Aucune nouvelle interaction : la
  // table réutilise effectTargeting (clic sur un Héros).
  // « Le joueur de votre choix pioche N cartes. » → le contrôleur du Héros choisi
  // pioche N (deps.draw).
  z.object({ op: z.literal("playerDraw"), n: z.number() }),
  // « Le joueur de votre choix perd N PA/PM jusqu'à la fin du tour. » → jeton
  // paMod/pmMod −N sur le Héros choisi (purgé en fin de tour, comme
  // loseStatTurn/oppLoseStatTurn). Généralise oppLoseStatTurn au joueur choisi.
  z.object({
    op: z.literal("playerLoseStatTurn"),
    stat: z.enum(["pa", "pm"]),
    n: z.number(),
  }),
  // « Le joueur de votre choix gagne N PA/PM jusqu'à la fin du tour. » → jeton
  // paMod/pmMod +N sur le Héros choisi (purgé en fin de tour). Pendant positif
  // de playerLoseStatTurn.
  z.object({
    op: z.literal("playerGainStat"),
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
  // « [self] gagne <Mot-clé> jusqu'à la fin du tour. » (Ouassingue : Géant) — la
  // SOURCE gagne un mot-clé de COMBAT (grantKeywordSchema : Géant 7258/6135,
  // Agilité 704, Agressivité = lève le mal d'invocation) jusqu'à la fin du tour.
  // Pose un jeton TURN-scoped `<kw>TurnMod` (geantTurnMod / agiliteTurnMod /
  // agressiviteTurnMod) sur la source (uniquement si elle est en jeu), purgé en
  // fin de tour (isTurnToken), lu par effectiveKeywords. Distinct de combatModSelf
  // (jeton `geantCombatMod`, portée COMBAT « jusqu'à la fin du combat »).
  z.object({ op: z.literal("grantKeywordSelf"), keyword: grantKeywordSchema }),
  // « L'Allié [ou Héros] [Famille] [bloqué / de votre choix] gagne <Mot-clé>
  // jusqu'à la fin du tour. » (Pandaluk : Géant ; Rat Klure : Géant/Rat bloqué ;
  // Petit Anneau de Force : Géant en sacrifice ; Petit Anneau d'Agilité :
  // Agilité en sacrifice ; Monstre de votre choix : Agressivité) — op de CIBLAGE :
  // le joueur choisit une créature éligible, qui reçoit un jeton TURN-scoped
  // `<kw>TurnMod` (purgé en fin de tour, lu par effectiveKeywords). Mêmes filtres
  // que les autres ops à cible : `heroes`, `sub` (Famille), `combatRole` (rôle de
  // combat), `controller`, `zones`.
  z.object({
    op: z.literal("grantKeywordTarget"),
    keyword: grantKeywordSchema,
    heroes: z.boolean().optional(),
    sub: z.string().optional(),
    combatRole: combatRoleSchema.optional(),
    controller: controllerSchema.optional(),
    zones: zonesSchema,
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
    // Clause résiduelle « cet Allié ne peut pas se redresser jusqu'au début de
    // votre prochain tour » (Pandrista, Kolo-Kolko, Boufdégou…) : la cible
    // choisie reçoit un jeton `noUntapUntilTurn` (= tour courant + 2) qui FAIT
    // SAUTER son redressement de début de tour tant que le jeton est actif (cf.
    // nextTurnEvents). Inclinaison + interdiction portent sur la MÊME cible.
    cannotRedress: z.boolean().optional(),
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
    // Cas MULTI-TYPE (« Renvoyez l'Allié, la Zone ou l'Équipement de votre
    // choix … ») : la cible peut être de l'un de ces types. Absent = forme
    // historique (Allié, + Héros si `heroes`). Un Héros ne « rentre » pas en
    // main (il vit dans le Havre-Sac) — `whatAny` et `heroes` sont disjoints
    // en pratique (la grammaire ne les combine pas).
    whatAny: z
      .array(z.enum(["Allié", "Zone", "Équipement", "Dofus"]))
      .optional(),
    zones: zonesSchema,
  }),
  // OPS DE MASSE (NON interactives — pas de « de votre choix ») : appliquent
  // l'effet à TOUTES les créatures en jeu correspondant aux filtres, sans choix
  // du joueur. Résolues directement dans runFrame (comme draw/heroGainPv), pas
  // via effectTargeting.
  //  - controller : « vos » (self) / « adverses » (opponent) / « tous » (any) ;
  //  - heroes : « et Héros » inclut les Héros ;
  //  - sub : Famille requise (« tous vos Alliés Bouftous ») ;
  //  - maxForce : « de Force inférieure ou égale à N » (effectiveForce) ;
  //  - zones : « dans le Monde » → ["monde"].
  // « Inclinez tous les Alliés [et Héros] [de Force ≤ N] dans le Monde. »
  z.object({
    op: z.literal("tapAll"),
    controller: massControllerSchema.optional(),
    heroes: z.boolean().optional(),
    sub: z.string().optional(),
    maxForce: z.number().optional(),
    zones: zonesSchema,
  }),
  // « Redressez tous vos Alliés [Famille] [et Héros] dans le Monde. »
  z.object({
    op: z.literal("untapAll"),
    controller: massControllerSchema.optional(),
    heroes: z.boolean().optional(),
    sub: z.string().optional(),
    maxForce: z.number().optional(),
    zones: zonesSchema,
  }),
  // « Infligez N Dommages à tous les Alliés [adverses] [et Héros] [dans le
  //   Monde]. » Chaque cible subit resolveDamageTarget (Résistance / létalité /
  //   XP). `element` = Élément des Dommages (source, 410.1).
  z.object({
    op: z.literal("damageAll"),
    n: z.number(),
    element: z.string(),
    controller: massControllerSchema.optional(),
    heroes: z.boolean().optional(),
    sub: z.string().optional(),
    maxForce: z.number().optional(),
    zones: zonesSchema,
  }),
  // « Détruisez tous les Alliés [adverses] [et Héros] [de Niveau ≤ N | de Niveau
  //   N] [inclinés / dressés] [dans le Monde]. » → destroyAll, op de MASSE NON
  //   interactive (board-wipe). Chaque instance éligible subit resolveDestroyTarget
  //   (415.1 : un Allié détruit rapporte son XP à l'adversaire de son contrôleur).
  //  - controller : « adverses » (opponent) / « vos » (self) / « tous » (any) ;
  //  - heroes : « et Héros » inclut les Héros — DANGEREUX (détruire un Héros = perte
  //    de la partie) : posé UNIQUEMENT si le texte dit littéralement « et Héros » ;
  //  - sub : Famille requise (« tous les Alliés Piou ») ;
  //  - maxLevel : « de Niveau inférieur ou égal à N » ; exactLevel : « de Niveau N » ;
  //  - orientation : « inclinés » (tapped) / « dressés » (upright) — lu sur
  //    inst.orientation ;
  //  - zones : « dans le Monde » → ["monde"].
  z.object({
    op: z.literal("destroyAll"),
    controller: massControllerSchema.optional(),
    heroes: z.boolean().optional(),
    sub: z.string().optional(),
    maxLevel: z.number().optional(),
    exactLevel: z.number().optional(),
    orientation: orientationFilterSchema.optional(),
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
  // COÛT de pouvoir payé « Recyclez … : CORPS » : op de COÛT (première op d'une
  // séquence cost:"paidOps", comme costTap/costDestroyControlled). Recycler =
  // remettre une carte SOUS la Pioche de son propriétaire (502 / glossaire). La
  // sémantique dépend de `from` :
  //  - "defausse" (défaut, « Recyclez une carte de votre Défausse : … ») : choix
  //    INTERACTIF dans la Défausse (machinerie effectPicking, action "recycle").
  //    `element` : filtre optionnel (« une carte [Feu] »). Si RIEN à recycler →
  //    le coût ne peut PAS être payé → la frame est ABANDONNÉE (corps non exécuté),
  //    comme costTap/costDestroyControlled. Pareil si le joueur PASSE le choix.
  //  - "self" (« Recyclez [cette carte] depuis le Monde [ou votre Havre-Sac] :
  //    … ») : recycle la SOURCE elle-même (aucune interaction). Si la source
  //    n'est pas en jeu (Monde/Havre-Sac), le coût ne peut pas être payé → abandon.
  //  - "main" (« Recyclez une carte de votre main : … ») : choix interactif dans
  //    la main (même règle d'abandon que "defausse").
  // `n` : nombre de cartes à recycler (défaut 1) — pour les formes interactives.
  z.object({
    op: z.literal("costRecycle"),
    n: z.number().optional(),
    // « Recyclez JUSQU'À N … » : `n` est le MAXIMUM (recyclage de 0..N), pas une
    // quantité imposée. Le coût est TOUJOURS payé (recycler 0 est licite : « jusqu'à »)
    // — le moteur enregistre le nombre RÉELLEMENT recyclé sur frame.boundCount,
    // que les ops du corps `fromCount:true` lisent. Sans `max`, le coût impose le
    // recyclage de `n` cartes (sinon abandon), comportement W21 inchangé.
    max: z.boolean().optional(),
    element: z.string().optional(),
    // Filtre de TYPE sur les cartes recyclables (« Recyclez jusqu'à N MONSTRES /
    // ALLIÉS de votre Défausse ») : `what` = mainType requis ; `sub` = Famille
    // requise (lue sur subTypes). Absent (« … N cartes … ») = aucune restriction
    // de type. Lu par matchesPickFilter (engine), comme searchDeck/destroyTarget.
    what: z.enum(["Allié", "Zone", "Équipement", "Dofus", "Salle"]).optional(),
    sub: z.string().optional(),
    from: z.enum(["defausse", "main", "self"]).optional(),
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
  // « [self] ne peut ni attaquer, ni bloquer. » (Épouvantail, Allies
  // Élémentaires Aero/Akwa/Pyro/Terra) — restriction CONTINUE : la créature
  // est retirée de `eligibleAttackers` ET `eligibleBlockers` (mêmes points
  // d'autorité que `cannotBlock`). Plus fort que `cannotBlock` (couvre aussi
  // l'attaque), modélisé comme un kind distinct pour rester littéral.
  z.object({ kind: z.literal("cannotAttackOrBlock") }),
  // « [self] ne peut pas porter d'Équipement. » (Allies Élémentaires) —
  // restriction CONTINUE : cette créature ne peut jamais être Porteur ; l'op
  // ATTACH la refuse comme bearer (lu par `cannotCarryEquipment`).
  z.object({ kind: z.literal("cannotCarryEquipment") }),
  z.object({ kind: z.literal("combatDamageReduction"), n: z.number() }),
  // BONUS DE PORTEUR (305.x) : pouvoir continu d'un Équipement / d'une Monture
  // PORTÉ(E) qui s'applique au PORTEUR tant qu'il est en jeu (« Le Porteur de X
  // gagne +N en Force »). À la différence de `forceAura`, le bénéficiaire n'est
  // pas une autre carte du Monde mais la créature à laquelle CETTE carte est
  // attachée (lu via `bearer.attachments`). `force` : bonus de Force continu ;
  // `resistance` : prévention par Élément normalisé (cumulée à la Résistance du
  // Porteur), possiblement multi-éléments (Croum : « Résistance 1 » aux quatre
  // Éléments) ; `keyword` : mot-clé conféré au Porteur (« Le Porteur de X gagne
  // Géant. ») — appliqué à `effectiveKeywords` du Porteur (Géant alimente le
  // calcul de répartition de Force au combat ; les autres mots-clés sont
  // enregistrés fidèlement, au même niveau que s'ils étaient imprimés). Au moins
  // un des trois champs est présent.
  z.object({
    kind: z.literal("bearerBonus"),
    force: z.number().optional(),
    resistance: z
      .object({
        element: z.union([z.string(), z.array(z.string())]),
        n: z.number(),
      })
      .optional(),
    keyword: cardKeywordSchema.optional(),
  }),
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
