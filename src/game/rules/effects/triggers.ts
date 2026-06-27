/**
 * Moteur de règles — BUS DE DÉCLENCHEMENT (804.5/804.7, A1).
 *
 * Les résolutions pures émettent des `RuleEvent` à côté de leurs
 * `DraftEvent` ; `collectTriggeredEffects` (pur) les transforme en frames
 * d'effets que le store enfile (`processRuleEvents` → `effectQueue`).
 * Conforme 804.7 : les déclenchés partent APRÈS la résolution complète de
 * l'événement déclencheur. Approximation 804.6 : les frames du joueur ACTIF
 * passent d'abord (aucune carte du périmètre n'a d'interaction d'ordre
 * inter-joueurs).
 */
import type { CompiledEffectOp } from "@/types/cards";
import type { InstanceId } from "../../types/events";
import type { Seat } from "../../types/zones";
import type { RuleEvent, RulesCtx } from "../types";
import { selfAttackEffects } from "./dsl";

/** Frame déclenchée, prête pour `enqueueEffect` du store. */
export interface TriggeredFrame {
  seat: Seat;
  sourceId: InstanceId;
  cardName: string;
  /** Texte d'origine (journal). */
  text: string;
  ops: CompiledEffectOp[];
}

function sideOf(ctx: RulesCtx, id: InstanceId): "recto" | "verso" {
  return ctx.state.instances[id]?.face === "verso" ? "verso" : "recto";
}

/** attackerDeclared → effets « Quand [self] attaque » de l'attaquant. */
function attackerFrames(
  ctx: RulesCtx,
  evt: Extract<RuleEvent, { kind: "attackerDeclared" }>,
): TriggeredFrame[] {
  const inst = ctx.state.instances[evt.instanceId];
  const card = inst ? ctx.getCard(inst.cardId) : null;
  if (!inst || !card) return [];
  return selfAttackEffects(card, sideOf(ctx, evt.instanceId)).map((atom) => ({
    seat: inst.controller,
    sourceId: evt.instanceId,
    cardName: card.name,
    text: atom.text,
    ops: atom.ops,
  }));
}

/**
 * damageDealt → effets `onDamageToBearer` (riposte Prespic, 804.3).
 * DORMANT : le modèle de Porteur existe désormais (lot F : `attachments` +
 * `bearerBonuses`), mais AUCUN équipement des données n'a de riposte fidèlement
 * parseable « Quand le Porteur subit des Dommages, … » (les seuls déclenchés de
 * Porteur observés portent sur l'ATTAQUE / la DESTRUCTION, pas sur les Dommages
 * subis, et embarquent des clauses non modélisées). Activer ce bus sans donnée
 * fidèle serait une approximation : on le laisse dormant tant qu'aucun
 * `trigger:"onDamageToBearer"` compilé n'existe (cf. report bearer).
 */
function bearerFrames(
  _ctx: RulesCtx,
  _evt: Extract<RuleEvent, { kind: "damageDealt" }>,
): TriggeredFrame[] {
  return [];
}

/**
 * Frames déclenchées par une rafale d'événements de règles — joueur actif
 * d'abord (804.6 approx.), ordre d'émission préservé par ailleurs.
 */
export function collectTriggeredEffects(
  ctx: RulesCtx,
  evts: RuleEvent[],
): TriggeredFrame[] {
  const frames: TriggeredFrame[] = [];
  for (const evt of evts) {
    if (evt.kind === "attackerDeclared")
      frames.push(...attackerFrames(ctx, evt));
    else if (evt.kind === "damageDealt") frames.push(...bearerFrames(ctx, evt));
  }
  const active = ctx.state.turn.active;
  return [
    ...frames.filter((f) => f.seat === active),
    ...frames.filter((f) => f.seat !== active),
  ];
}
