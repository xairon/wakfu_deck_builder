/**
 * Moteur de règles R1 — Ressources & coûts (4261/4316/4356/4381/4398).
 * Une carte en jeu redressée (Monde ou Havre-Sac, sauf Protecteur) produit en
 * s'inclinant 1 Ressource de son Élément. Coût de lancement = Niveau ; un
 * Allié exige au moins une Ressource de son Élément.
 */
import type { Card } from "@/types/cards";
import type { InstanceId } from "../types/events";
import type { Seat } from "../types/zones";
import type { PlanCost, ResourceProducer, RulesCtx } from "./types";
import {
  canProduceResource,
  elementLabel,
  levelCost,
  producedElement,
  requiredElement,
} from "./cardAttrs";

/** Cartes inclinables pour produire une Ressource (contrôlées, redressées). */
export function resourceProducers(
  ctx: RulesCtx,
  seat: Seat,
): ResourceProducer[] {
  const out: ResourceProducer[] = [];
  // 2342 : au premier tour du joueur qui n'a PAS commencé, son Havre-Sac se
  // redresse après sa première inclinaison → il vaut DEUX Ressources pour le
  // même coût (une seule inclinaison réelle au paiement).
  const freeUntap =
    seat !== ctx.state.turn.firstPlayer && ctx.state.turn.number === 2;
  const sacId = ctx.state.seats[seat].havreSacInstanceId;
  for (const inst of Object.values(ctx.state.instances)) {
    if (inst.controller !== seat) continue;
    const zone = inst.location.zone;
    if (zone !== "monde" && zone !== "havreSac") continue;
    if (inst.orientation !== "upright") continue;
    const card = ctx.getCard(inst.cardId);
    if (!card || !canProduceResource(card)) continue;
    const producer = {
      instanceId: inst.instanceId,
      element: producedElement(card),
    };
    out.push(producer);
    // Bonus à USAGE UNIQUE : une fois le Havre-Sac incliné ce tour (token posé
    // par playFromHand), il ne se redouble plus, même redressé manuellement.
    if (
      freeUntap &&
      inst.instanceId === sacId &&
      !inst.counters.tokens?.sacBonusUsed
    )
      out.push({ ...producer });
  }
  return out;
}

/**
 * Sélection automatique des producteurs pour payer le coût de lancement de
 * `card`. Satisfait d'abord l'exigence élémentaire (Allié), puis complète en
 * préférant les éléments non requis (préserve les ressources contraintes).
 */
export function planCost(ctx: RulesCtx, seat: Seat, card: Card): PlanCost {
  const cost = levelCost(card);
  if (cost <= 0) return { ok: true, producers: [] };

  const pool = resourceProducers(ctx, seat);
  if (pool.length < cost) {
    return {
      ok: false,
      reason: `Pas assez de Ressources : il faut ${cost} carte(s) redressée(s) à incliner (${pool.length} disponible(s)).`,
    };
  }

  const chosen: InstanceId[] = [];
  const remaining = [...pool];
  const req = requiredElement(card);
  if (req) {
    const i = remaining.findIndex((p) => p.element === req);
    if (i === -1) {
      return {
        ok: false,
        reason: `Il faut au moins une Ressource ${elementLabel(req)} pour jouer cet Allié.`,
      };
    }
    chosen.push(remaining[i].instanceId);
    remaining.splice(i, 1);
  }
  // complète avec les éléments non requis d'abord (Neutre puis autres ≠ req)
  remaining.sort((a, b) => {
    const rank = (p: ResourceProducer) =>
      p.element === "neutre" ? 0 : p.element === req ? 2 : 1;
    return rank(a) - rank(b);
  });
  while (chosen.length < cost) {
    const next = remaining.shift();
    if (!next) break;
    chosen.push(next.instanceId);
  }
  return { ok: true, producers: chosen };
}
