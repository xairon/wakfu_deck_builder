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
import { canAttackCard, canBlockCard, heroStats } from "./cardAttrs.ts";
import { cannotAttackOrBlock, cannotBlock } from "./modifiers.ts";
import { effectiveKeywords } from "./effects/keywords.ts";
import { planCost } from "./resources.ts";

/** Zone d'arrivée d'une carte jouée, selon son type (309.1 : Salle → Havre-Sac). */
export function playDestination(card: Card, seat: Seat): ZoneRef {
  if (card.mainType === "Salle") return { zone: "havreSac", owner: seat };
  return { zone: "monde" };
}

/** Tour d'entrée en jeu (token `arrivedTurn`, 0 = mise en place). */
export function arrivedTurnOf(inst: CardInstance): number {
  return inst.counters.tokens?.arrivedTurn ?? 0;
}

/**
 * Pourquoi `seat` ne peut PAS jouer cette carte de sa main — `null` si légal.
 * Vérifie : main, tour, phase, restriction du premier tour (4943), coût.
 */
export function whyCannotPlay(
  ctx: RulesCtx,
  seat: Seat,
  instanceId: InstanceId,
  reaction = false,
): string | null {
  const { state } = ctx;
  const inst = state.instances[instanceId];
  if (!inst) return "Carte introuvable.";
  if (inst.location.zone !== "main" || inst.owner !== seat)
    return "Cette carte n'est pas dans votre main.";
  // 706 — en fenêtre de réaction on joue HORS de son tour : ces deux contrôles
  // sont relâchés (les autres — main, coût, zone, 4943 — restent actifs).
  if (!reaction && state.turn.active !== seat)
    return "Ce n'est pas votre tour.";
  if (!reaction && state.turn.phase !== "principale")
    return "On ne joue des cartes qu'en Phase Principale.";
  const card = ctx.getCard(inst.cardId);
  if (!card) return "Carte inconnue — jouez-la en mode libre.";
  const dest = playDestination(card, seat);
  if (dest.zone === "monde" && state.turn.number === 1)
    return "Aucune carte ne peut entrer dans le Monde au premier tour de la partie.";
  // 2626 : pas de Salle si le Havre-Sac est plein (Taille atteinte)
  if (dest.zone === "havreSac" && !havreSacHasRoom(ctx, seat))
    return "Le Havre-Sac est plein (Taille atteinte).";
  const plan = planCost(ctx, seat, card);
  if (!plan.ok) return plan.reason;
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

/** Attaquants légaux : Alliés/Héros redressés, sans mal d'invocation (1821). */
export function eligibleAttackers(ctx: RulesCtx, seat: Seat): InstanceId[] {
  const out: InstanceId[] = [];
  for (const inst of Object.values(ctx.state.instances)) {
    if (inst.controller !== seat) continue;
    const zone = inst.location.zone;
    if (zone !== "monde" && zone !== "havreSac") continue;
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
  if (board.heroInstanceId)
    out.push({ kind: "hero", instanceId: board.heroInstanceId });
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
