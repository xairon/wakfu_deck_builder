/**
 * Moteur de règles R1 — légalité des coups (jouer une carte, attaquer).
 * Toutes les fonctions sont pures ; les raisons d'échec sont en français,
 * directement affichables (toast / journal).
 */
import type { Card } from "@/types/cards";
import type { InstanceId } from "../types/events";
import type { CardInstance } from "../types/state";
import type { Seat, ZoneRef } from "../types/zones";
import { otherSeat } from "../types/zones.ts";
import type { CombatTarget, RulesCtx } from "./types";
import {
  canAttackCard,
  canBlockCard,
  heroStats,
  normWord,
  onceNameToken,
  recetteOf,
  RECENT_PLAY_TOKENS,
} from "./cardAttrs.ts";
import { metierOf } from "./effects/keywords.ts";
import { heroClassOf } from "./resources.ts";
import { cannotAttackOrBlock, cannotBlock } from "./modifiers.ts";
import { combatKeywords, effectiveKeywords } from "./effects/keywords.ts";
import { planCost } from "./resources.ts";
import { eligibleBearers, requiresBearer } from "./bearer.ts";

/**
 * Zone d'arrivée d'une carte jouée, selon son type (309.1 : Salle → Havre-Sac).
 * 303.1 — un ALLIÉ « apparaît dans le Monde OU dans le Havre-Sac de son
 * propriétaire » : aux tours ≥ 2, `preferred` porte le choix du contrôleur
 * (défaut : le Monde). Au 1er tour de la partie (506.3, aucune entrée dans le
 * Monde), sa seule destination légale est le Havre-Sac → on l'y route quel que
 * soit le choix (développement de Ressources dès le 1er tour). `turnNumber`
 * omis = défaut (compat). La préférence n'a de sens QUE pour un Allié — les
 * autres types gardent leur zone imposée (Salle → Havre-Sac, reste → Monde).
 * NB : la MONTURE se joue attachée ; ici on ne route que les créatures.
 */
export function playDestination(
  card: Card,
  seat: Seat,
  turnNumber?: number,
  preferred?: "monde" | "havreSac",
): ZoneRef {
  if (card.mainType === "Salle") return { zone: "havreSac", owner: seat };
  const isAlly =
    card.mainType === "Allié" || card.mainType === "Allié Élémentaire";
  if (isAlly && (turnNumber === 1 || preferred === "havreSac"))
    return { zone: "havreSac", owner: seat };
  return { zone: "monde" };
}

/**
 * Destination EFFECTIVE d'une carte jouée, préférence du contrôleur comprise.
 * La préférence est IGNORÉE pendant un combat : un Allié joué en fenêtre de
 * combat (Défense / Renfort, 706.5) l'est pour bloquer ou renforcer l'attaque
 * → il arrive TOUJOURS dans le Monde, jamais à l'abri du Havre-Sac.
 */
export function resolvedPlayDestination(
  ctx: RulesCtx,
  seat: Seat,
  card: Card,
  preferred?: "monde" | "havreSac",
): ZoneRef {
  const pref = ctx.state.combat ? undefined : preferred;
  return playDestination(card, seat, ctx.state.turn.number, pref);
}

/** Tour d'entrée en jeu (token `arrivedTurn`, 0 = mise en place). */
export function arrivedTurnOf(inst: CardInstance): number {
  return inst.counters.tokens?.arrivedTurn ?? 0;
}

/**
 * Fenêtre de combat où un mot-clé de TIMING (Défense / Renfort) autorise à jouer
 * un Allié de sa main HORS des règles de tour/phase normales. Renvoie `true` si
 * la carte porte le mot-clé adéquat ET que `seat` occupe le rôle requis dans le
 * combat EN COURS (Phase d'Actions). `false` sinon (pas de combat, mauvais rôle,
 * mauvais mot-clé) → la barrière tour/phase standard s'applique.
 *
 * - **Défense** : jouable si un combat est en cours et que `seat` en est le
 *   DÉFENSEUR (l'adversaire de l'attaquant). L'Allié arrive redressé dans le
 *   Monde → immédiatement éligible comme bloqueur (eligibleBlockers), ce qui
 *   réalise le « placé comme bloqueur » par le flux normal de blocage.
 * - **Renfort** : jouable si un combat est en cours, que `seat` en est
 *   l'ATTAQUANT, ET que SON HÉROS est lui-même attaquant dans ce combat
 *   (héros dans `combat.attackers`). Ne suffit PAS d'attaquer avec des Alliés.
 *
 * On lit les mots-clés IMPRIMÉS de la carte (combatKeywords) : Défense/Renfort
 * sont des propriétés de l'Allié joué depuis la main (pas d'une instance en jeu).
 */
function combatPlayWindow(ctx: RulesCtx, seat: Seat, card: Card): boolean {
  const combat = ctx.state.combat;
  if (!combat) return false;
  const kw = combatKeywords(card);
  if (!kw.defense && !kw.renfort) return false;
  const defender = otherSeat(combat.attackerSeat);
  // Défense : le contrôleur doit être le défenseur du combat.
  if (kw.defense && seat === defender) return true;
  // Renfort : le contrôleur doit être l'attaquant ET son Héros doit attaquer.
  if (kw.renfort && seat === combat.attackerSeat) {
    const heroId = ctx.state.seats[seat].heroInstanceId;
    if (heroId && combat.attackers.includes(heroId)) return true;
  }
  return false;
}

/**
 * Pourquoi `seat` ne peut PAS jouer cette carte de sa main — `null` si légal.
 * Vérifie : main, tour, phase, restriction du premier tour (4943), coût.
 */
/**
 * RESTRICTION DE JEU « Ne jouez cette carte que si <cond> » (playCondition,
 * évaluée au PLAY-TIME). Renvoie une raison de refus en français, ou null si
 * toutes les conditions sont remplies. Aujourd'hui : `heroInZone` (Repos —
 * « … que si votre Héros se trouve dans son Havre-Sac »). Les autres condSpecs
 * ne portent pas de sémantique de play-time → ignorés (aucune restriction).
 */
/** Un `playCondition` de restriction est-il SATISFAIT ? (heroInZone, récence). */
function playConditionOk(
  ctx: RulesCtx,
  seat: Seat,
  pc: NonNullable<
    NonNullable<Card["effects"]>[number]["compiled"]
  >["playCondition"],
  // SOURCE du pouvoir (activation) : sert aux conds « un AUTRE … » qui
  // excluent la source du référent (allyJustAppeared{other} — W79). Absent
  // pour une carte JOUÉE de la main (aucune exclusion pertinente).
  sourceId?: string,
): boolean {
  const heroId = ctx.state.seats[seat].heroInstanceId;
  const hero = heroId ? ctx.state.instances[heroId] : null;
  if (pc?.cond === "heroInZone")
    return !!hero && hero.location.zone === pc.zone;
  // GATE DE CLASSE (Gzenah) : le Héros du contrôleur doit être de la Classe.
  if (pc?.cond === "heroClass")
    return heroClassOf(ctx, seat) === normWord(pc.class);
  if (pc?.cond === "recentlyPlayedQuestParch")
    return (hero?.counters.tokens?.recentQuestParch ?? 0) > 0;
  // RÉCENCE PAR CATÉGORIE : `who:"self"` lit VOTRE Héros, `who:"other"` le
  // Héros ADVERSE (en 1v1, « un adversaire / un autre joueur » = l'adversaire).
  if (pc?.cond === "recentlyPlayedKind") {
    const whoSeat = pc.who === "other" ? otherSeat(seat) : seat;
    const hid = ctx.state.seats[whoSeat].heroInstanceId;
    const h = hid ? ctx.state.instances[hid] : null;
    return pc.kinds.some(
      (k) => (h?.counters.tokens?.[RECENT_PLAY_TOKENS[k]] ?? 0) > 0,
    );
  }
  // « … que lorsqu'un de VOS Alliés vient d'apparaître depuis votre Défausse »
  // (Échappé des Glaces, W78) : un Allié contrôlé par l'acteur porte les DEUX
  // jetons de récence d'apparition (marqueur justAppeared + provenance).
  if (pc?.cond === "allyJustAppearedFromDiscard") {
    return Object.values(ctx.state.instances).some(
      (inst) =>
        inst.controller === seat &&
        (inst.counters.tokens?.justAppeared ?? 0) > 0 &&
        (inst.counters.tokens?.justAppearedFromDefausse ?? 0) > 0 &&
        ctx.getCard(inst.cardId)?.mainType === "Allié",
    );
  }
  // « … un [autre] Allié <Famille> vient d'apparaître » (Assassin Grouilleux,
  // W79) : un Allié (TOUT contrôleur) marqué justAppeared matche la Famille ;
  // `other` exclut la SOURCE du pouvoir (« un AUTRE »).
  if (pc?.cond === "allyJustAppeared") {
    const sub = pc.sub ? normWord(pc.sub) : undefined;
    return Object.values(ctx.state.instances).some((inst) => {
      if (pc.other && sourceId && inst.instanceId === sourceId) return false;
      if ((inst.counters.tokens?.justAppeared ?? 0) <= 0) return false;
      const card = ctx.getCard(inst.cardId);
      if (card?.mainType !== "Allié") return false;
      return !sub || (card.subTypes ?? []).some((s) => normWord(s) === sub);
    });
  }
  return true; // condSpec sans sémantique de restriction → aucune contrainte
}

/** Message de refus si une restriction de PLAY (carte jouée) n'est pas remplie.
 * N'examine QUE les effets de mise en jeu (onPlay/onArrive) — les restrictions
 * de POUVOIR (onTap : Fécaline) sont jugées à l'activation (powerConditionReason). */
function playConditionReason(
  ctx: RulesCtx,
  seat: Seat,
  card: Card,
): string | null {
  for (const e of card.effects ?? []) {
    const pc = e.compiled?.playCondition;
    if (!pc || e.compiled?.trigger === "onTap") continue;
    if (!playConditionOk(ctx, seat, pc)) return reasonFor(pc);
  }
  return null;
}

/** Message de refus si le playCondition d'un POUVOIR (atom onTap) n'est pas
 * rempli — Fécaline (« Ne jouez ce pouvoir que lorsque vous venez de jouer une
 * Quête ou un Parchemin »). Appelé par activateTapPower. */
export function powerConditionReason(
  ctx: RulesCtx,
  seat: Seat,
  pc: NonNullable<
    NonNullable<Card["effects"]>[number]["compiled"]
  >["playCondition"],
  // Instance SOURCE du pouvoir — exclue du référent par les conds « un
  // AUTRE … » (allyJustAppeared{other}, W79).
  sourceId?: string,
): string | null {
  if (!pc) return null;
  return playConditionOk(ctx, seat, pc, sourceId) ? null : reasonFor(pc);
}

function reasonFor(
  pc: NonNullable<
    NonNullable<Card["effects"]>[number]["compiled"]
  >["playCondition"],
): string {
  if (pc?.cond === "heroInZone")
    return pc.zone === "havreSac"
      ? "Votre Héros doit être dans son Havre-Sac pour jouer cette carte."
      : "Votre Héros doit être dans le Monde pour jouer cette carte.";
  if (pc?.cond === "heroClass")
    return `Votre Héros doit être ${pc.class} pour utiliser ce pouvoir.`;
  if (pc?.cond === "recentlyPlayedQuestParch")
    return "Vous devez venir de jouer une carte Quête ou Parchemin.";
  if (pc?.cond === "recentlyPlayedKind") {
    const labels: Record<string, string> = {
      action: "une Action",
      sort: "un Sort",
      parchemin: "un Parchemin",
      equipement: "un Équipement",
      allie: "un Allié",
      unique: "une carte Unique",
    };
    const what = pc.kinds.map((k) => labels[k] ?? k).join(" ou ");
    return pc.who === "other"
      ? `Un adversaire doit venir de jouer ${what}.`
      : `Vous devez venir de jouer ${what}.`;
  }
  if (pc?.cond === "allyJustAppearedFromDiscard")
    return "Un de vos Alliés doit venir d'apparaître depuis votre Défausse.";
  if (pc?.cond === "allyJustAppeared") {
    const what = pc.sub
      ? `Allié ${pc.sub.charAt(0).toUpperCase()}${pc.sub.slice(1)}`
      : "Allié";
    return `Un ${pc.other ? "autre " : ""}${what} doit venir d'apparaître.`;
  }
  return "Condition de jeu non remplie.";
}

/**
 * A19 — FABRICATION (305.4 / 401.4a / 418.6) : la carte en main peut-elle être
 * FABRIQUÉE (jouée pour son coût de Recette) ? Renvoie la raison du refus, ou
 * null si légal. Exigences :
 *  - carte en MAIN du joueur, porteuse d'une Recette parsable (recetteOf) ;
 *  - type Équipement ou Salle (418.4c) ;
 *  - son tour + Phase Principale (mêmes contrôles que jouer normalement) ;
 *  - ≥1 Allié ARTISAN du Métier requis, contrôlé, DRESSÉ (401.4a : il faut
 *    pouvoir l'incliner) et en jeu (Monde/Havre-Sac) ;
 *  - la Défausse du joueur contient ≥ N cartes de l'Élément de la Recette
 *    (418.6 — l'Élément d'une carte = son Élément de Niveau imprimé).
 */
export function whyCannotCraft(
  ctx: RulesCtx,
  seat: Seat,
  instanceId: InstanceId,
): string | null {
  const { state } = ctx;
  const inst = state.instances[instanceId];
  if (!inst) return "Carte introuvable.";
  if (inst.location.zone !== "main" || inst.owner !== seat)
    return "Cette carte n'est pas dans votre main.";
  const card = ctx.getCard(inst.cardId);
  if (!card) return "Carte inconnue.";
  const recette = recetteOf(card);
  if (!recette) return "Cette carte n'a pas de Recette.";
  if (card.mainType !== "Équipement" && card.mainType !== "Salle")
    return "Seuls les Équipements et les Salles se fabriquent (418.4c).";
  if (state.turn.active !== seat) return "Ce n'est pas votre tour.";
  if (state.turn.phase !== "principale")
    return "On ne fabrique qu'en Phase Principale.";
  // 401.4a — un Artisan du Métier requis, contrôlé, DRESSÉ, en jeu.
  const hasArtisan = Object.values(state.instances).some((i) => {
    if (i.controller !== seat || i.orientation !== "upright") return false;
    const z = i.location.zone;
    if (z !== "monde" && z !== "havreSac") return false;
    const c = ctx.getCard(i.cardId);
    if (!c || c.mainType !== "Allié") return false;
    return metierOf(i, c).includes(recette.metier);
  });
  if (!hasArtisan)
    return `Il faut incliner un Artisan ${recette.metier} dressé (401.4a).`;
  // 418.6 — N cartes de l'Élément requis dans SA Défausse.
  const have = state.seats[seat].defausse.filter((id) => {
    const c = ctx.getCard(state.instances[id]?.cardId ?? null);
    return c?.stats?.niveau?.element === recette.element;
  }).length;
  if (have < recette.n)
    return `Défausse insuffisante : il faut recycler ${recette.n} carte(s) ${recette.element} (${have} disponible(s), 418.6).`;
  return null;
}

export function whyCannotPlay(
  ctx: RulesCtx,
  seat: Seat,
  instanceId: InstanceId,
  reaction = false,
  preferred?: "monde" | "havreSac",
  // A19 — FABRICATION : le coût de lancement est REMPLACÉ par la Recette
  // (305.4, déjà payée par la frame de fabrication) → l'affordabilité en
  // Ressources n'est pas exigée. Toutes les autres contraintes tiennent.
  freeCost = false,
): string | null {
  const { state } = ctx;
  const inst = state.instances[instanceId];
  if (!inst) return "Carte introuvable.";
  if (inst.location.zone !== "main" || inst.owner !== seat)
    return "Cette carte n'est pas dans votre main.";
  const card = ctx.getCard(inst.cardId);
  if (!card) return "Carte inconnue — jouez-la en mode libre.";
  // Défense / Renfort (mots-clés de timing) : un Allié possédant le mot-clé et
  // dont le contrôleur occupe le bon rôle dans le combat EN COURS peut être joué
  // durant la Phase d'Actions, HORS des règles de tour/phase. On RELÂCHE alors
  // exactement les deux mêmes contrôles que la fenêtre de réaction (tour/phase) —
  // toutes les autres contraintes (main, coût, zone, 4943) restent vérifiées.
  const combatWindow = combatPlayWindow(ctx, seat, card);
  const bypassTurnPhase = reaction || combatWindow;
  // « Réaction. … » (Flèche d'Immolation) : jouable UNIQUEMENT en fenêtre de
  // réaction (706.5). Hors réaction (à son propre tour), refusée — sinon un
  // marqueur périmé « qui vient de s'incliner » serait ciblable (approximation).
  if (!reaction && (card.effects ?? []).some((e) => e.compiled?.reactionOnly))
    return "Cette carte ne peut être jouée qu'en réaction.";
  // RESTRICTION DE TIMING (706.5) : dans la fenêtre de RÉACTION (jeu HORS de son
  // tour), seule une ACTION est jouable — un Allié/Équipement/Salle/Zone (vitesse
  // « sorcier ») ne se pose qu'à son propre tour. Les Alliés Défense/Renfort ont
  // leur propre autorisation (combatWindow) et ne passent pas par ce garde.
  if (reaction && !combatWindow && card.mainType !== "Action")
    return "Seule une Action peut être jouée en réaction (706.5).";
  // 706 — en fenêtre de réaction on joue HORS de son tour : ces deux contrôles
  // sont relâchés (les autres — main, coût, zone, 4943 — restent actifs).
  if (!bypassTurnPhase && state.turn.active !== seat)
    return "Ce n'est pas votre tour.";
  if (!bypassTurnPhase && state.turn.phase !== "principale")
    return "On ne joue des cartes qu'en Phase Principale.";
  const dest = resolvedPlayDestination(ctx, seat, card, preferred);
  if (dest.zone === "monde" && state.turn.number === 1)
    return "Aucune carte ne peut entrer dans le Monde au premier tour de la partie.";
  // 2626 / 4806 : pas de carte dans le Havre-Sac s'il est plein (Taille atteinte).
  // Couvre les Salles ET les Alliés routés au Havre-Sac au 1er tour (303.1).
  if (dest.zone === "havreSac" && !havreSacHasRoom(ctx, seat))
    return "Le Havre-Sac est plein (Taille atteinte).";
  if (!freeCost) {
    const plan = planCost(ctx, seat, card);
    if (!plan.ok) return plan.reason;
  }
  // 305.x — un ÉQUIPEMENT se joue ATTACHÉ à une créature : sans Porteur éligible
  // en jeu (Allié non-Monstre / Héros contrôlé), il est injouable (jamais posé
  // « tout seul »). Grise la carte dans la main (affordance) plutôt qu'un refus au clic.
  if (
    requiresBearer(card) &&
    eligibleBearers(ctx, seat, instanceId).length === 0
  )
    return "Aucune créature en jeu ne peut porter cet Équipement.";
  // RESTRICTION DE JEU « Ne jouez cette carte que si <cond> » (Repos, heroInZone).
  const pcReason = playConditionReason(ctx, seat, card);
  if (pcReason) return pcReason;
  // « Vous ne pouvez jouer qu'une seule <Nom> par tour » (onceNamePerTurn —
  // Puissance d'Ogrest) : jeton par NOM sur VOTRE Héros, posé au jeu, purgé au
  // tour. Les rééditions du même nom partagent la limite.
  if ((card.effects ?? []).some((e) => e.compiled?.onceNamePerTurn)) {
    const hid = state.seats[seat].heroInstanceId;
    const h = hid ? state.instances[hid] : null;
    if ((h?.counters.tokens?.[onceNameToken(card.name)] ?? 0) > 0)
      return `Vous ne pouvez jouer qu'une seule ${card.name} par tour.`;
  }
  return null;
}

/** Une seule attaque par tour (603), jamais à son premier tour (603.2). */
export function whyCannotDeclareAttack(
  ctx: RulesCtx,
  seat: Seat,
  attackedOnTurn: number | null,
): string | null {
  const { turn } = ctx.state;
  if (turn.active !== seat) return "Ce n'est pas votre tour.";
  if (turn.phase !== "principale")
    return "On déclare une attaque en Phase Principale.";
  // 603.2 — turn.number<=2 couvre le 1er tour de CHAQUE joueur (tour 1 =
  // firstPlayer, tour 2 = 2nd joueur). turn.active===seat est déjà garanti l.68.
  if (turn.number <= 2)
    return "Pas d'attaque possible durant votre premier tour.";
  if (attackedOnTurn === turn.number) return "Une seule attaque par tour.";
  return null;
}

/**
 * Contrôles COMMUNS du mouvement 414.x, partagés Héros/Allié : zone visée ≠
 * zone courante, carte DRESSÉE (414.2), aucune sortie au Monde au 1er tour de
 * la partie (506.3), entrée au Havre-Sac dans la Taille (414.3). Le drapeau
 * `hero` ne change QUE la formulation des messages — jamais la règle : toute
 * évolution du mouvement se fait ICI, une seule fois.
 */
function whyCannotMoveCommon(
  ctx: RulesCtx,
  seat: Seat,
  inst: CardInstance | undefined,
  to: "monde" | "havreSac",
  hero: boolean,
): string | null {
  if (inst?.location.zone === to) {
    if (to === "monde")
      return hero
        ? "Ton Héros est déjà dans le Monde."
        : "Cette créature est déjà dans le Monde.";
    return hero
      ? "Ton Héros est déjà dans son Havre-Sac."
      : "Cette créature est déjà dans son Havre-Sac.";
  }
  if (inst && inst.orientation !== "upright")
    return hero
      ? "Un Héros incliné ne peut pas se déplacer (414.2)."
      : "Une créature inclinée ne peut pas se déplacer (414.2).";
  if (to === "monde" && ctx.state.turn.number === 1)
    return "Aucune sortie dans le Monde au premier tour de la partie.";
  if (to === "havreSac" && !havreSacHasRoom(ctx, seat))
    return "Le Havre-Sac est plein (Taille atteinte).";
  return null;
}

/**
 * Mouvement du Héros entre son Havre-Sac et le Monde (414.1) : à son tour, en
 * Phase Principale, puis contrôles communs 414.x (dressé, 1er tour, Taille) —
 * cf. `whyCannotMoveCommon` (messages « Héros »). Sans coût (414.1).
 */
export function whyCannotMoveHero(
  ctx: RulesCtx,
  seat: Seat,
  to: "monde" | "havreSac",
): string | null {
  const { turn } = ctx.state;
  if (turn.active !== seat) return "Ce n'est pas votre tour.";
  if (turn.phase !== "principale")
    return "On déplace le Héros en Phase Principale.";
  const heroId = ctx.state.seats[seat].heroInstanceId;
  const hero = heroId ? ctx.state.instances[heroId] : undefined;
  return whyCannotMoveCommon(ctx, seat, hero, to, true);
}

/**
 * Mouvement d'une CRÉATURE (Héros ou Allié) entre son Havre-Sac et le Monde
 * (414.1) — GÉNÉRALISE le déplacement du Héros aux Alliés. À son tour, en Phase
 * Principale, sous son contrôle, en jeu, puis contrôles communs 414.x
 * (dressé, 1er tour, Taille) — cf. `whyCannotMoveCommon`. Gratuit.
 */
export function whyCannotMoveCreature(
  ctx: RulesCtx,
  seat: Seat,
  instanceId: InstanceId,
  to: "monde" | "havreSac",
): string | null {
  const { turn } = ctx.state;
  if (turn.active !== seat) return "Ce n'est pas votre tour.";
  if (turn.phase !== "principale")
    return "On déplace une créature en Phase Principale.";
  const inst = ctx.state.instances[instanceId];
  if (!inst || inst.controller !== seat)
    return "Cette créature n'est pas sous ton contrôle.";
  const card = ctx.getCard(inst.cardId);
  if (
    !card ||
    (card.mainType !== "Héros" &&
      card.mainType !== "Allié" &&
      card.mainType !== "Allié Élémentaire")
  )
    return "Seul un Héros ou un Allié peut se déplacer (414.1).";
  const cur = inst.location.zone;
  if (cur !== "monde" && cur !== "havreSac")
    return "Cette créature n'est pas en jeu.";
  return whyCannotMoveCommon(ctx, seat, inst, to, false);
}

/** Attaquants légaux : Alliés/Héros redressés, sans mal d'invocation (1821). */
export function eligibleAttackers(ctx: RulesCtx, seat: Seat): InstanceId[] {
  const out: InstanceId[] = [];
  for (const inst of Object.values(ctx.state.instances)) {
    if (inst.controller !== seat) continue;
    // 503.1/508.1b — on n'attaque QUE depuis le Monde : une créature (Héros comme
    // Allié) dans l'intérieur du Havre-Sac est à l'abri mais ne peut pas être
    // déclarée attaquante ; elle doit d'abord sortir (mouvement 414.1).
    if (inst.location.zone !== "monde") continue;
    if (inst.orientation !== "upright") continue;
    const card = ctx.getCard(inst.cardId);
    if (!card || !canAttackCard(card)) continue;
    // « ne peut ni attaquer, ni bloquer » (pouvoir continu) — exclu des
    // attaquants éligibles (volet blocage géré par eligibleBlockers/cannotBlock).
    if (cannotAttackOrBlock(ctx, inst.instanceId)) continue;
    // le Héros n'a pas le mal d'invocation (en jeu depuis la mise en place).
    // Agressivité (glossaire) : un Allié possédant ce mot-clé PEUT être déclaré
    // attaquant le tour où il apparaît — on lève UNIQUEMENT le mal d'invocation
    // (toutes les autres contraintes ci-dessus restent vérifiées). Lu via
    // effectiveKeywords : l'Agressivité IMPRIMÉE comme celle CONFÉRÉE « jusqu'à
    // la fin du tour » (jeton agressiviteTurnMod) lèvent toutes deux le mal.
    if (
      card.mainType === "Allié" &&
      arrivedTurnOf(inst) >= ctx.state.turn.number &&
      !effectiveKeywords(ctx, inst.instanceId).agressivite
    )
      continue;
    out.push(inst.instanceId);
  }
  return out;
}

/** Cibles légales (702.2/702.3) : Héros adverse, Allié adverse du Monde, Havre-Sac adverse. */
export function eligibleTargets(ctx: RulesCtx, seat: Seat): CombatTarget[] {
  const def = otherSeat(seat);
  const board = ctx.state.seats[def];
  const out: CombatTarget[] = [];
  // Le Héros adverse n'est CIBLABLE qu'exposé dans le Monde (protégé au Havre-Sac,
  // 508.x) ; il s'y expose en sortant attaquer ou à l'expulsion (410.7).
  const heroInst = board.heroInstanceId
    ? ctx.state.instances[board.heroInstanceId]
    : null;
  if (heroInst && heroInst.location.zone === "monde")
    out.push({ kind: "hero", instanceId: board.heroInstanceId! });
  if (board.havreSacInstanceId)
    out.push({ kind: "havreSac", instanceId: board.havreSacInstanceId });
  for (const id of ctx.state.monde) {
    const inst = ctx.state.instances[id];
    if (!inst || inst.controller !== def) continue;
    if (id === board.havreSacInstanceId) continue;
    const card = ctx.getCard(inst.cardId);
    if (card && card.mainType === "Allié")
      out.push({ kind: "ally", instanceId: id });
  }
  return out;
}

/**
 * Mots-clés de combat EFFECTIFS d'une instance en jeu : face courante imprimée +
 * jetons (« gagne <Mot-clé> jusqu'à la fin du tour » → `<kw>TurnMod`) + bonus de
 * Porteur. On lit via effectiveKeywords (et non combatKeywords) pour que
 * l'Agilité CONFÉRÉE soit aussi prise en compte dans la légalité de blocage (704).
 */
function instanceKeywords(ctx: RulesCtx, id: InstanceId) {
  return effectiveKeywords(ctx, id);
}

/**
 * Agilité (glossaire) : un attaquant possédant Agilité ne peut être bloqué que
 * par un bloqueur possédant lui aussi Agilité. `null` (attaquant non précisé) →
 * pas de filtre Agilité. Un attaquant sans Agilité est bloqué normalement.
 */
export function blockerBlockedByAgilite(
  ctx: RulesCtx,
  blockerId: InstanceId,
  attackerId: InstanceId | null,
): boolean {
  if (!attackerId) return false;
  if (!instanceKeywords(ctx, attackerId).agilite) return false;
  return !instanceKeywords(ctx, blockerId).agilite;
}

/** Bloqueurs légaux (704) : Alliés redressés du Monde du défenseur, hors
 *  cible — et hors « ne peut pas bloquer » (pouvoir continu, ex. Jicé).
 *  `attacker` (optionnel) : si fourni et qu'il possède Agilité, les bloqueurs
 *  sans Agilité sont exclus (mot-clé Agilité du glossaire). */
export function eligibleBlockers(
  ctx: RulesCtx,
  defender: Seat,
  target: CombatTarget,
  attacker: InstanceId | null = null,
): InstanceId[] {
  const out: InstanceId[] = [];
  for (const id of ctx.state.monde) {
    const inst = ctx.state.instances[id];
    if (!inst || inst.controller !== defender) continue;
    if (inst.orientation !== "upright") continue;
    if (id === target.instanceId) continue;
    const card = ctx.getCard(inst.cardId);
    if (!card || !canBlockCard(card) || cannotBlock(ctx, id)) continue;
    if (blockerBlockedByAgilite(ctx, id, attacker)) continue;
    out.push(id);
  }
  return out;
}

/**
 * Capacité du Havre-Sac (Taille, 2315) : nombre maximal de cartes Héros,
 * Allié ou Salle dans la zone. `null` si la Taille est inconnue (mode libre).
 */
export function havreSacCapacity(ctx: RulesCtx, seat: Seat): number | null {
  const id = ctx.state.seats[seat].havreSacInstanceId;
  const inst = id ? ctx.state.instances[id] : null;
  const card = inst ? ctx.getCard(inst.cardId) : null;
  const taille = card?.stats?.taille;
  return typeof taille === "number" ? taille : null;
}

/** Occupation actuelle du Havre-Sac (Héros + Alliés + Salles, 4781). */
export function havreSacOccupancy(ctx: RulesCtx, seat: Seat): number {
  let n = 0;
  for (const id of ctx.state.seats[seat].havreSac) {
    const card = ctx.getCard(ctx.state.instances[id]?.cardId ?? null);
    if (!card) continue;
    if (
      card.mainType === "Héros" ||
      card.mainType === "Allié" ||
      card.mainType === "Salle"
    )
      n++;
  }
  return n;
}

/** Le Havre-Sac peut-il accueillir une carte de plus (4793/4806) ? */
export function havreSacHasRoom(ctx: RulesCtx, seat: Seat): boolean {
  const cap = havreSacCapacity(ctx, seat);
  if (cap === null) return true; // Taille inconnue : on ne bloque pas
  return havreSacOccupancy(ctx, seat) < cap;
}

/** PM effectifs d'un siège (plafond attaquants/bloqueurs, 703/704) :
 *  compteur + modificateurs temporaires (pmMod, purgés en fin de tour). */
export function pmOf(ctx: RulesCtx, seat: Seat): number {
  const id = ctx.state.seats[seat].heroInstanceId;
  const inst = id ? ctx.state.instances[id] : null;
  const mod = inst?.counters.tokens?.pmMod ?? 0;
  if (inst?.counters.pm !== undefined)
    return Math.max(0, inst.counters.pm + mod);
  const card = inst ? ctx.getCard(inst.cardId) : null;
  const base = card
    ? (heroStats(card, inst!.face === "verso" ? "verso" : "recto")?.pm ?? 3)
    : 3;
  return Math.max(0, base + mod);
}
