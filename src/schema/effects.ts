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
// (lue par effectiveKeywords → légalité / résolution) — un octroi d'un mot-clé
// inerte (Fantôme, Défense, Renfort…) serait un no-op, donc une APPROXIMATION.
// Ceux-là restent manuels (le DSL ne les compile pas). Géant : répartition de
// Force au combat (7258/6135). Agilité : ne peut être bloqué que par Agilité
// (704). Agressivité : peut attaquer le tour de son apparition (lève le mal
// d'invocation). Tacle : pouvoir continu de combat — les Alliés/Héros bloquant
// un possesseur de Tacle ne s'inclinent pas en fin de combat (resolveCombat).
const grantKeywordSchema = z.enum(["Géant", "Agilité", "Agressivité", "Tacle"]);

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

// ── VALEUR DYNAMIQUE — représentation CANONIQUE d'une magnitude (ValueExpr) ────
// Modèle état-de-l'art (Forge « Count$ » / MTG) : toute magnitude numérique d'op
// est soit un LITTÉRAL (`n`), soit une `ValueExpr` — un petit AST de valeur
// évalué À LA RÉSOLUTION par UN SEUL évaluateur moteur (`evalValue`). Cela
// unifie les magnitudes dynamiques (au lieu d'un champ ad-hoc par cas) et rend
// chaque nœud composable. STRICT : on n'admet QUE des sources fidèlement
// évaluables depuis l'état ; toute valeur dynamique non calculable exactement
// reste manuelle. « an approximation of gameplay is worse than a manual effect ».
//
// `countSpec` = un ENSEMBLE comptable de l'état (« … que vous contrôlez »).
export const countSpecSchema = z.object({
  // « … que vous contrôlez » : nombre d'instances EN JEU (Monde + Havre-Sac)
  // contrôlées par l'acteur, du type `what` (et Famille `sub` éventuelle). Un
  // Équipement attaché est co-localisé avec son Porteur (zone Monde/Havre-Sac),
  // donc compté — fidèle au ruling « portés par votre Héros / vos Alliés » et
  // aux Équipements posés en standalone.
  source: z.literal("controlled"),
  what: z.enum(["Allié", "Zone", "Équipement", "Dofus", "Salle"]),
  sub: z.string().optional(),
});

// AST de valeur. Variantes câblées AUJOURD'HUI (chacune a un évaluateur réel +
// un consommateur réel — ZÉRO code mort) :
//   - `fixed`  : littéral (composable, ex. base d'un futur `plus`) ;
//   - `count`  : « … égal au nombre de <X> que vous contrôlez » (countSpec).
// Nœuds prévus (ajoutés incrément par incrément AVEC leur effet consommateur,
// jamais spéculativement) : `boundCount` (remplace le legacy fromCount/perCount
// des coûts « Recyclez jusqu'à N … »), `statOf` (généralise damageTargetByForce
// : Force/Niveau d'une cible ou de soi), `mirror` (« le même nombre »), `plus`
// (« 1 plus le nombre de … »). Plat pour l'instant (pas de récursion → typage
// exact sans z.lazy) ; on passera à z.lazy quand un nœud imbriquera une ValueExpr.
export const valueExprSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("fixed"), n: z.number() }),
  z.object({ kind: z.literal("count"), of: countSpecSchema }),
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
  // CHOIX EXCLUSIF « A ou B » (« L'Allié de votre choix gagne Géant ou +2 en
  // Force… ») : le joueur choisit UNE option, dont les ops s'exécutent ; les
  // autres sont ignorées. Chaque option porte un `label` (bouton) et une séquence
  // d'ops (récursive, comme conditional). Présenté via effectChoices (boutons
  // étiquetés). STRICT : on ne compile un chooseOne QUE si TOUTES les branches
  // sont des effets câblés fidèlement (sinon manuel — pas de demi-encodage).
  // `prompt` : légende d'origine pour l'overlay (sinon « A ou B » dérivé).
  z.object({
    op: z.literal("chooseOne"),
    prompt: z.string().optional(),
    options: z
      .array(z.object({ label: z.string(), ops: conditionalBodySchema }))
      .min(2),
  }),
  z.object({ op: z.literal("gainXp"), n: z.number() }),
  z.object({
    op: z.literal("draw"),
    n: z.number(),
    // « Piochez un nombre de cartes égal au nombre de <X> que vous contrôlez »
    // → magnitude dynamique via `value` (ValueExpr). Absent = `n` fixe.
    value: valueExprSchema.optional(),
  }),
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
  // « Bannissez l'Allié [Famille] [de Niveau ≤ N] de votre choix [dans le Monde] »
  //   / « Bannissez le <Famille> de votre choix » → op de CIBLAGE jumelle de
  //   destroyTarget, MAIS le BANNISSEMENT n'est PAS une destruction : la cible
  //   choisie est DÉPLACÉE vers l'Exil de SON propriétaire (« retirée de la
  //   partie ») — AUCUN XP n'est accordé (contrairement à destroyTarget/415.1),
  //   AUCUN événement de destruction n'est émis, et la carte ne va jamais en
  //   Défausse/Pioche. Un JETON banni quitte le jeu vers une zone hors-jeu →
  //   il CESSE D'EXISTER (chemin de suppression de jeton du reducer). Mêmes
  //   filtres d'éligibilité que destroyTarget (type/sub/maxLevel/controller/zones).
  z.object({
    op: z.literal("banishTarget"),
    // Cas mono-type (« Bannissez l'Allié de votre choix »).
    what: z.enum(["Allié", "Zone", "Équipement", "Dofus"]).optional(),
    // Famille requise (« Bannissez le Démon de votre choix » → sub Demon).
    sub: z.string().optional(),
    // Niveau max (« … de Niveau inférieur ou égal à N »). Cible sans Niveau
    // = inéligible (manquant = +Infinity).
    maxLevel: z.number().optional(),
    // « … vos » (self) / « … adverse » (opponent) — filtre de contrôleur.
    controller: controllerSchema.optional(),
    zones: zonesSchema,
  }),
  // « Bannissez la carte [l'Équipement…] de votre choix de la Défausse d'un
  //   adversaire » (Snouffle, Poubelles d'Astrub) → BANNISSEMENT depuis une PILE
  //   (pas une créature en jeu). Le joueur choisit une carte dans la Défausse de
  //   l'ADVERSAIRE (pick interactif, machinerie effectPicking action "banish") ;
  //   la carte choisie part en EXIL de son propriétaire — « retirée de la partie »,
  //   AUCUN XP (un bannissement n'est pas une destruction), elle ne revient
  //   jamais en jeu. Si la Défausse adverse (filtrée) est vide, l'op est un no-op
  //   fidèle (rien à bannir). FIDÈLE : cible une PILE PUBLIQUE (la Défausse est
  //   visible des deux joueurs), pas d'information cachée.
  //   - `from` : pile source (seul "defausse" modélisé) ;
  //   - `controller` : propriétaire de la pile ("opponent" = la Défausse adverse) ;
  //   - `what` : type requis (« l'Équipement … » → Équipement). Absent = toute
  //     carte (« la carte de votre choix »).
  z.object({
    op: z.literal("banishFromZone"),
    from: z.literal("defausse"),
    controller: controllerSchema,
    what: z
      .enum(["Allié", "Zone", "Équipement", "Dofus", "Action", "Salle"])
      .optional(),
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
    // « … à l'Allié ou Héros ADVERSE de votre choix » : restreint la cible aux
    // créatures du contrôleur adverse (opponent) ; absent = n'importe quel
    // contrôleur (cible libre). Lu par effectTargetIds comme pour destroy/tap.
    controller: controllerSchema.optional(),
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
  // « Mettez en jeu un jeton "Monstre - <Famille>" de Force N [Élément]. »
  //   (Abraknyde, Vampyro…) → createToken : MINTE une nouvelle créature en jeu
  //   SANS carte de deck. Le jeton est une carte SYNTHÉTIQUE (mainType "Allié",
  //   subType "Monstre" + Famille `sub`, Force `force` de l'Élément `element`) :
  //   participant de combat à part entière (distribue sa Force, attaque/bloque,
  //   subit des Dommages, meurt à Dommages ≥ Force). Il entre dans le Monde du
  //   contrôleur, dressé. À sa sortie de jeu il CESSE D'EXISTER (jamais de
  //   défausse/pioche — retiré des instances). `name` sert aux « jetons portant
  //   le même nom ». FIDÈLE : un jeton n'a AUCUN effet d'apparition.
  z.object({
    op: z.literal("createToken"),
    name: z.string(),
    force: z.number(),
    element: z.string().optional(),
    sub: z.string().optional(),
    // « Il apparaît incliné. » / « … jetons … inclinés dans le Monde. » : le(s)
    // jeton(s) entre(nt) INCLINÉ(S) (orientation "tapped" à l'arrivée, lue par
    // le reducer CREATE_TOKEN). Absent = dressé (106.3, défaut).
    tapped: z.boolean().optional(),
    // « Mettez en jeu LE MÊME NOMBRE de jetons … » (Classe de Vampyro) : le
    // NOMBRE de jetons créés est le nombre de cartes recyclées par le coût en
    // amont (frame.boundCount), pas 1. Lié uniquement à un costRecycle{max:true}
    // (« Recyclez jusqu'à N … »). FIDÈLE : compte dynamique borné = compte réel.
    // Sans ce drapeau, createToken minte exactement UN jeton (comportement W24).
    countFromRecycled: z.boolean().optional(),
  }),
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
  // « Le Porteur de <self> gagne <Mot-clé> jusqu'à la fin du tour. » (Scarature
  // Blanche, via chooseOne « Agilité ou Tacle ») — la SOURCE est un Équipement ;
  // le mot-clé TURN-scoped (`<kw>TurnMod`) est posé sur SON PORTEUR (la créature
  // dont `attachments` contient la source), pas sur l'équipement. No-op fidèle si
  // la source n'est pas attachée (aucun Porteur). Pendant « de soi » de
  // grantKeywordTarget{requiresAttachment} (qui, lui, laisse le joueur choisir).
  z.object({
    op: z.literal("grantKeywordBearerSelf"),
    keyword: grantKeywordSchema,
  }),
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
    // « l'Équipement de votre choix fait gagner <Kw> à son Porteur » : on cible
    // directement le PORTEUR (créature ayant ≥1 Équipement/Dofus attaché) —
    // choisir l'équipement ne sert qu'à désigner son Porteur, donc la cible
    // fidèle EST la créature qui le porte. Filtre d'éligibilité : attachments ≥ 1.
    requiresAttachment: z.boolean().optional(),
    zones: zonesSchema,
  }),
  // « [self] gagne Résistance N (Élément)[(Élément)…] jusqu'à la fin du tour. » —
  // la SOURCE gagne de la Résistance TURN-scoped à un ou plusieurs Éléments.
  // Pose un jeton TURN-scoped `resMod_<el>` (+N par Élément) sur la source
  // (uniquement si elle est en jeu), purgé en fin de tour (TURN_TOKEN_PREFIXES :
  // « resMod_ »), lu par effectiveKeywords → CombatKeywords.resistances → la
  // prévention de Dommages (7469, par infliction). `resist` : un (Élément, N) par
  // Élément (multi-éléments : « Résistance 1 (air)(eau)(terre)(feu) »). FIDÈLE :
  // valeur FIXE par Élément, portée TOUR (les variantes BEARER « Le Porteur … »,
  // COMBAT et DYNAMIQUES « N par carte recyclée / dans l'élément des Dommages »
  // restent manuelles — approximation interdite).
  z.object({
    op: z.literal("grantResistanceSelf"),
    resist: z.array(z.object({ element: z.string(), n: z.number() })).min(1),
  }),
  // « L'Allié [ou Héros] [Famille] [bloqué / de votre choix] gagne Résistance N
  // (Élément)[…] jusqu'à la fin du tour. » — op de CIBLAGE : le joueur choisit une
  // créature éligible, qui reçoit un jeton TURN-scoped `resMod_<el>` (+N par
  // Élément, purgé en fin de tour, lu par effectiveKeywords). Mêmes filtres que les
  // autres ops à cible : `heroes`, `sub` (Famille), `combatRole`, `controller`,
  // `zones`. Variante ciblée de grantResistanceSelf.
  z.object({
    op: z.literal("grantResistanceTarget"),
    resist: z.array(z.object({ element: z.string(), n: z.number() })).min(1),
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
  // COÛT de pouvoir payé « Recyclez un <Allié|Famille> de votre choix : … »
  //   (Vampyro) : op de CIBLAGE (première op d'une séquence cost:"paidOps", comme
  //   costTapControlled/costDestroyControlled). Le joueur choisit une de SES
  //   créatures EN JEU (Monde / Havre-Sac) correspondant au filtre, qui est alors
  //   RECYCLÉE — remise sous la Pioche de son propriétaire (glossaire « Recycler »).
  //   Si l'éligibilité est vide, le coût ne peut pas être payé → la frame est
  //   abandonnée (corps non exécuté), comme les autres coûts payés. `sub` :
  //   Famille requise (« un Monstre de votre choix » → sub Monstre). `heroes` :
  //   le coût accepte aussi un Héros. `excludeSource` : « un AUTRE de vos … ».
  z.object({
    op: z.literal("costRecycleControlled"),
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
  // RÉDUCTION DE COÛT DE SOI, conditionnée par la CLASSE du Héros (805 — les ~12
  // Dopeuls : « Si votre Héros est <Classe>, le coût du <self> est réduit de N. »).
  // Pouvoir CONTINU lu par `planCost` UNIQUEMENT pour la carte elle-même au moment
  // de la jouer : si le Héros du contrôleur est de la Classe `ifHeroClass`, son
  // coût de lancement est réduit de `n` (plancher 0, fidèle). `ifHeroClass` est la
  // Classe exacte (« Sram », « Iop »… cf. heroCard.class) comparée par normWord.
  z.object({
    kind: z.literal("selfCostMod"),
    n: z.number(),
    ifHeroClass: z.string(),
  }),
  // AURA DE RÉDUCTION DE COÛT (805.2 — « Tant que <self> est dans le Monde, le
  // coût de vos <scope> est réduit de N. »). Pouvoir CONTINU : tant que la SOURCE
  // est en jeu (Monde / Havre-Sac), le coût de lancement des cartes du contrôleur
  // correspondant au `scope` est réduit de `n` (plancher 0, lu par `planCost`).
  // STRICT — seuls les scopes fidèlement calculables sont compilés :
  //  - { kind:"family", sub } : « vos Alliés <Famille> » (Famille sur subTypes) ;
  //  - { kind:"type", mainType } : « vos Actions » / « vos Alliés » (mainType) ;
  //  - { kind:"unique" } : « vos cartes Uniques » (trait Unique, isUniqueCard).
  // Les scopes non modélisables fidèlement (« Capture de vos Dragodindes », « vos
  // Invocations », « Sorts de la même Classe »…) ne sont PAS compilés → manuel.
  z.object({
    kind: z.literal("costAura"),
    n: z.number(),
    scope: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("family"), sub: z.string() }),
      z.object({
        kind: z.literal("type"),
        mainType: z.enum(["Allié", "Action"]),
      }),
      z.object({ kind: z.literal("unique") }),
    ]),
  }),
  // AURA DE MOT-CLÉ (805.2 — « Tant que <self> est dans le Monde, vos [autres]
  // Alliés [Famille] [et Héros] gagnent <Mot-clé>. »). Pouvoir CONTINU : tant que
  // la SOURCE est en jeu, les créatures du même contrôleur dans le `scope`
  // (sub / heroes — mêmes règles de sélection que forceAura) gagnent un mot-clé
  // de COMBAT FONCTIONNEL (lu par effectiveKeywords → légalité / résolution).
  // STRICT — seuls les mots-clés CÂBLÉS sont admis (grantKeywordSchema :
  // Géant 7258/6135, Agilité 704, Agressivité = mal d'invocation, Tacle = verrou
  // d'inclinaison) : octroyer un mot-clé inerte (Fantôme, Défense, Renfort…)
  // serait un no-op = approximation → ces formes restent manuelles (le DSL ne les
  // compile pas). Miroir exact de forceAura, mais octroie un mot-clé au lieu de
  // Force. `excludeSource` : « vos AUTRES Alliés … » (la source ne se compte pas).
  z.object({
    kind: z.literal("keywordAura"),
    keyword: grantKeywordSchema,
    // Famille bénéficiaire (« vos autres Alliés Pirates »). Absente = toutes vos
    // créatures éligibles, sans restriction de Famille.
    sub: z.string().optional(),
    // « et Héros » / « Alliés ou Héros » : votre Héros bénéficie aussi de l'aura.
    heroes: z.boolean().optional(),
    // « vos AUTRES Alliés … » : la SOURCE elle-même ne bénéficie pas de l'aura.
    excludeSource: z.boolean().optional(),
  }),
  // AURA DE PRÉVENTION DE DOMMAGES (effet de REMPLACEMENT continu, modèle MTG
  // 614/616 — primitive #3). Tant que la SOURCE est en jeu (Monde/Havre-Sac),
  // les Dommages ENTRANTS sur un bénéficiaire (relatif au contrôleur de la
  // source) sont réduits. Lu au point de passage UNIQUE `reduceDamage` (après
  // Résistance/combatDamageReduction, avant le plancher 0) → s'applique aux
  // Dommages de COMBAT comme d'EFFET (contrairement à `combatDamageReduction`,
  // gaté combat).
  //  - `all:true` (« réduits à 0 ») → prévention TOTALE ; sinon `n` (« réduits
  //    de N »). Exactement l'un des deux.
  //  - `to` : bénéficiaire des Dommages entrants, relatif au contrôleur de la
  //    source — `controllerHero` (« à votre Héros ») ou `controlledAllies`
  //    (« à vos [Famille] » ; `sub` = Famille sur subTypes, absente = tous vos
  //    Alliés).
  // STRICT : le sens SORTANT (« que devrait infliger … »), la durée TOUR
  // (« jusqu'à la fin du tour »), la cible CHOISIE et la REDIRECTION (« à la
  // place ») ne sont PAS ce nœud → restent manuels (incréments ultérieurs).
  z.object({
    kind: z.literal("damagePreventionAura"),
    n: z.number().optional(),
    all: z.boolean().optional(),
    to: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("controllerHero") }),
      z.object({
        kind: z.literal("controlledAllies"),
        sub: z.string().optional(),
      }),
    ]),
  }),
  // Dommages IMPRÉVENABLES, sens dealer (primitive #3) : « Les Dommages infligés
  // par <self> ne peuvent pas être réduits. » Les Dommages de la SOURCE contournent
  // TOUTE réduction (Résistance 7469, prévention, Trêve) — reduceDamage renvoie le
  // montant BRUT. STRICT : la forme PORTEUR (« infligés par le Porteur de … »,
  // bearer) et la forme par-INSTANCE (« Ces Dommages … ») restent manuelles.
  z.object({ kind: z.literal("damageUnpreventable") }),
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
    "onSelfDestroyed",
    "onDamageToBearer",
  ]),
  optional: z.boolean().optional(),
  // "sacrificeSelf" : le coût est de sacrifier la SOURCE (« Détruisez [cette
  // carte] : … »). "banishSelf" : le coût est de BANNIR la SOURCE (« Bannissez
  // [cette carte] [depuis votre Défausse] : … ») — la source est déplacée vers
  // l'Exil de son propriétaire (retirée de la partie), AUCUN XP, AUCUNE
  // destruction (parallèle exact de sacrificeSelf, mais en exil au lieu de la
  // Défausse ; la variante « depuis votre Défausse » bannit depuis la Défausse).
  // "paidOps" : le coût est la PREMIÈRE op de la séquence (op de ciblage
  // costTap/costDestroyControlled, « Inclinez/Détruisez un de vos X : … ») — la
  // source n'est ni inclinée ni sacrifiée automatiquement.
  cost: z
    .enum(["sacrificeSelf", "banishSelf", "banishSelfFromDiscard", "paidOps"])
    .optional(),
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
