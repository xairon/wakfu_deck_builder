/**
 * Moteur de règles R1 — légalité des coups (jouer une carte, attaquer).
 * Toutes les fonctions sont pures ; les raisons d'échec sont en français,
 * directement affichables (toast / journal).
 */
import type { Card } from "@/types/cards";
import type { InstanceId } from "../types/events";
import type { CardInstance } from "../types/state";
import type { Seat, ZoneRef } from "../types/zones";
import { otherSeat } from "../types/zones";
import type { CombatTarget, RulesCtx } from "./types";
import { canAttackCard, canBlockCard, heroStats } from "./cardAttrs";
import { planCost } from "./resources";

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
): string | null {
  const { state } = ctx;
  const inst = state.instances[instanceId];
  if (!inst) return "Carte introuvable.";
  if (inst.location.zone !== "main" || inst.owner !== seat)
    return "Cette carte n'est pas dans votre main.";
  if (state.turn.active !== seat) return "Ce n'est pas votre tour.";
  if (state.turn.phase !== "principale")
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
  if (turn.number <= 2 && turn.active === seat)
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
    // le Héros n'a pas le mal d'invocation (en jeu depuis la mise en place)
    if (
      card.mainType === "Allié" &&
      arrivedTurnOf(inst) >= ctx.state.turn.number
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

/** Bloqueurs légaux (704) : Alliés redressés du Monde du défenseur, hors cible. */
export function eligibleBlockers(
  ctx: RulesCtx,
  defender: Seat,
  target: CombatTarget,
): InstanceId[] {
  const out: InstanceId[] = [];
  for (const id of ctx.state.monde) {
    const inst = ctx.state.instances[id];
    if (!inst || inst.controller !== defender) continue;
    if (inst.orientation !== "upright") continue;
    if (id === target.instanceId) continue;
    const card = ctx.getCard(inst.cardId);
    if (card && canBlockCard(card)) out.push(id);
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
