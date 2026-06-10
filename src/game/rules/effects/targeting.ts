/**
 * Moteur de règles — étape C : résolution des ops d'effet À CIBLE
 * (« Détruisez … de votre choix », « Infligez N Dommages à l'Allié de votre
 * choix »). Le store met la table en mode ciblage ; le clic du joueur
 * appelle ces helpers purs qui émettent les events.
 */
import type { CompiledEffectOp } from "@/types/cards";
import type { DraftEvent, InstanceId } from "../../types/events";
import type { Seat } from "../../types/zones";
import { otherSeat } from "../../types/zones";
import type { RulesCtx } from "../types";
import { discard, incCounter } from "../../engine/verbs";
import { forceValue, xpValue } from "../cardAttrs";
import { combatKeywords, preventDamage } from "./keywords";
import { grantXpEvents } from "../progress";

export type TargetingOp = Extract<
  CompiledEffectOp,
  { op: "destroyTarget" } | { op: "damageTarget" }
>;

export function isTargetingOp(op: CompiledEffectOp): op is TargetingOp {
  return op.op === "destroyTarget" || op.op === "damageTarget";
}

/** Cibles légales d'une op (n'importe quel contrôleur). */
export function effectTargetIds(ctx: RulesCtx, op: TargetingOp): InstanceId[] {
  const zones = op.zones;
  const out: InstanceId[] = [];
  for (const inst of Object.values(ctx.state.instances)) {
    if (!zones.includes(inst.location.zone as "monde" | "havreSac")) continue;
    const card = ctx.getCard(inst.cardId);
    if (!card) continue;
    const ok =
      op.op === "destroyTarget"
        ? card.mainType === op.what
        : card.mainType === "Allié" || (op.heroes && card.mainType === "Héros");
    if (ok) out.push(inst.instanceId);
  }
  return out;
}

export interface EffectResolution {
  events: DraftEvent[];
  log: string[];
}

function nameOf(ctx: RulesCtx, id: InstanceId): string {
  const inst = ctx.state.instances[id];
  return ctx.getCard(inst?.cardId ?? null)?.name ?? "Carte";
}

/** Détruit la cible ; un Allié adverse détruit rapporte son XP (415.1). */
export function resolveDestroyTarget(
  ctx: RulesCtx,
  actor: Seat,
  targetId: InstanceId,
): EffectResolution {
  const inst = ctx.state.instances[targetId];
  if (!inst) return { events: [], log: [] };
  const events: DraftEvent[] = [discard(inst.owner, targetId, inst.location)];
  const log = [`${nameOf(ctx, targetId)} est détruit.`];
  const card = ctx.getCard(inst.cardId);
  if (card?.mainType === "Allié") {
    const grant = grantXpEvents(ctx, otherSeat(inst.controller), xpValue(card));
    events.push(...grant.events);
    log.push(
      ...grant.log.map((l) => `Le Héros de ${otherSeat(inst.controller)} ${l}`),
    );
  }
  return { events, log };
}

/**
 * Inflige n Dommages (élément de la source, Résistance déduite) : un Héros
 * perd des PV (410.2), un Allié cumule des Dommages + létalité (204.6).
 */
export function resolveDamageTarget(
  ctx: RulesCtx,
  actor: Seat,
  targetId: InstanceId,
  n: number,
  element: string,
): EffectResolution {
  const inst = ctx.state.instances[targetId];
  const card = inst ? ctx.getCard(inst.cardId) : null;
  if (!inst || !card) return { events: [], log: [] };
  const side = inst.face === "verso" ? "verso" : "recto";
  const eff = preventDamage(
    combatKeywords(card, side),
    n,
    element.toLowerCase(),
  );
  const events: DraftEvent[] = [];
  const log: string[] = [];
  if (eff < n) log.push(`Résistance : ${n - eff} Dommage(s) prévenu(s).`);
  if (eff <= 0) return { events, log };
  if (card.mainType === "Héros") {
    events.push(incCounter(actor, targetId, "hp", -eff));
    log.push(`${nameOf(ctx, targetId)} perd ${eff} PV.`);
    return { events, log };
  }
  events.push(incCounter(actor, targetId, "damage", eff));
  log.push(`${eff} Dommage(s) sur ${nameOf(ctx, targetId)}.`);
  const total = (inst.counters.damage ?? 0) + eff;
  const force = forceValue(card, side);
  if (force > 0 && total >= force) {
    const destroy = resolveDestroyTarget(ctx, actor, targetId);
    events.push(...destroy.events);
    log.push(...destroy.log);
  }
  return { events, log };
}
