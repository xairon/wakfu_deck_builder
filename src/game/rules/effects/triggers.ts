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
import {
  bearerEffects,
  selfAttackEffects,
  selfDamagedEffects,
  selfDestroyedEffects,
} from "./dsl";

/** Frame déclenchée, prête pour `enqueueEffect` du store. */
export interface TriggeredFrame {
  seat: Seat;
  sourceId: InstanceId;
  cardName: string;
  /** Texte d'origine (journal). */
  text: string;
  ops: CompiledEffectOp[];
  /**
   * « Vous pouvez … » sur le déclenché (ex. onSelfDestroyed optionnel) : le
   * moteur le présente comme un CHOIX (effectChoices) à confirmer plutôt que de
   * l'exécuter d'office. Absent = exécution automatique (déclenchés obligatoires).
   */
  optional?: boolean;
  /**
   * RIPOSTE DE PORTEUR (onDamageToBearer) : cible PRÉ-LIÉE = la créature qui vient
   * d'infliger les Dommages au Porteur (source de l'événement damageDealt). L'op
   * `damageRiposteSource` la lit comme cible (aucun picker). Absent hors riposte.
   */
  riposteTargetId?: InstanceId;
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
 *
 * Quand un Allié ou Héros (`evt.source`) inflige des Dommages à un Porteur
 * (`evt.target`), chaque Équipement attaché au Porteur qui porte une riposte
 * compilée (`bearerEffects`, trigger onDamageToBearer) enfile une frame qui
 * inflige à son tour des Dommages À LA CRÉATURE QUI A FRAPPÉ (riposteTargetId =
 * evt.source).
 *
 * GARDE ANTI-BOUCLE (fidèle au texte « un Allié ou Héros inflige ») : on n'émet
 * QUE si le damager est un Allié ou un Héros. Une riposte est infligée par
 * l'ÉQUIPEMENT (mainType Équipement, `sourceId`), donc elle ne re-déclenche
 * jamais une riposte — pas de boucle. Un Porteur DÉTRUIT (déplacé en Défausse
 * avant la collecte des déclenchés) n'a plus d'attachement en jeu → pas de
 * riposte (omission conservatrice, jamais d'approximation).
 */
function bearerFrames(
  ctx: RulesCtx,
  evt: Extract<RuleEvent, { kind: "damageDealt" }>,
): TriggeredFrame[] {
  const src = evt.source;
  if (!src) return []; // Dommages sans source (jeton/effet) → pas de riposte
  const srcCard = ctx.getCard(ctx.state.instances[src]?.cardId ?? null);
  if (
    !srcCard ||
    (srcCard.mainType !== "Allié" && srcCard.mainType !== "Héros")
  )
    return []; // damager non Allié/Héros (ex. une autre riposte) → pas de re-déclenchement
  const bearer = ctx.state.instances[evt.target];
  if (!bearer) return [];
  const zone = bearer.location.zone;
  if (zone !== "monde" && zone !== "havreSac") return [];
  const frames: TriggeredFrame[] = [];
  for (const attId of bearer.attachments ?? []) {
    const att = ctx.state.instances[attId];
    const card = att ? ctx.getCard(att.cardId) : null;
    if (!card || card.mainType !== "Équipement") continue;
    for (const atom of bearerEffects(card)) {
      frames.push({
        seat: bearer.controller,
        sourceId: attId,
        cardName: card.name,
        text: atom.text,
        ops: atom.ops,
        riposteTargetId: src,
      });
    }
  }
  return frames;
}

/**
 * damageDealt → effets « Chaque fois que [self] subit des Dommages » de la
 * CIBLE des Dommages (Wa Wabbit, 804.7). Toute provenance (combat, pouvoir,
 * riposte : le texte ne restreint pas la source — contrairement à la riposte de
 * Porteur qui, elle, exige un damager Allié/Héros). Émis seulement si la cible
 * est ENCORE EN JEU (Monde/Havre-Sac) : une cible détruite par ces mêmes
 * Dommages est en Défausse à la collecte → pas de déclenché (omission
 * conservatrice, cohérente avec bearerFrames — jamais d'approximation).
 * Pas de boucle possible aujourd'hui : le seul corps compilé (draw) n'inflige
 * pas de Dommages ; un futur corps damageant devra être validé à ce moment-là.
 */
function selfDamagedFrames(
  ctx: RulesCtx,
  evt: Extract<RuleEvent, { kind: "damageDealt" }>,
): TriggeredFrame[] {
  const inst = ctx.state.instances[evt.target];
  if (!inst) return [];
  const zone = inst.location.zone;
  if (zone !== "monde" && zone !== "havreSac") return [];
  const card = ctx.getCard(inst.cardId);
  if (!card) return [];
  return selfDamagedEffects(card).map((atom) => ({
    seat: inst.controller,
    sourceId: evt.target,
    cardName: card.name,
    text: atom.text,
    ops: atom.ops,
    ...(atom.optional ? { optional: true } : {}),
  }));
}

/**
 * destroyed → effets « Quand [self] est détruit » de la carte détruite (804.7).
 * L'instance détruite est lue dans le contexte FOURNI : l'appelant collecte les
 * frames AU MOMENT de la destruction (avant que le déplacement vers la Défausse
 * ne sorte l'instance du jeu), si bien que controller / cardName restent lisibles.
 * Le CORPS se résout avec sourceId = l'instance détruite (son info subsiste
 * l'instant où elle est détruite — 804.7 : déclenché APRÈS la destruction).
 */
function destroyedFrames(
  ctx: RulesCtx,
  evt: Extract<RuleEvent, { kind: "destroyed" }>,
): TriggeredFrame[] {
  const inst = ctx.state.instances[evt.instanceId];
  const card = inst ? ctx.getCard(inst.cardId) : null;
  if (!card) return [];
  return selfDestroyedEffects(card).map((atom) => ({
    seat: evt.controller,
    sourceId: evt.instanceId,
    cardName: card.name,
    text: atom.text,
    ops: atom.ops,
    ...(atom.optional ? { optional: true } : {}),
  }));
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
    else if (evt.kind === "damageDealt") {
      frames.push(...bearerFrames(ctx, evt));
      frames.push(...selfDamagedFrames(ctx, evt));
    } else if (evt.kind === "destroyed")
      frames.push(...destroyedFrames(ctx, evt));
  }
  const active = ctx.state.turn.active;
  return [
    ...frames.filter((f) => f.seat === active),
    ...frames.filter((f) => f.seat !== active),
  ];
}
