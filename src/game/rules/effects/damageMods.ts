/**
 * Moteur de règles — passe UNIQUE de modificateurs de Dommages (A2).
 *
 * `reduceDamage` est le seul point de prévention : toute infliction de
 * DOMMAGES (combat ou effet ciblé) y passe avant d'être appliquée. Ordre :
 *   1. Résistance de la cible (7469, mots-clés EFFECTIFS : face + jetons) ;
 *   2. réductions continues `combatDamageReduction` de la CIBLE (Poum
 *      Ondacié) — seulement si elle est attaquant, bloqueur ou cible d'une
 *      attaque (posture du combat) ;
 *   3. modificateurs globaux (`treve` : tout à 0) — `protectCombatants` /
 *      `tapTrap` arrivent avec la fenêtre d'actions (lot E) ;
 *   plancher 0 (7482).
 * Les pertes de PV directes (« perd N PV », coûts) ne sont PAS des Dommages
 * (410.3/410.6) : elles ne passent jamais ici.
 */
import type { InstanceId } from "../../types/events";
import type { CombatStance, DamageMod, RulesCtx } from "../types";
import { normElement } from "../cardAttrs";
import { staticAbilitiesOf } from "../modifiers";
import { stanceBlockers } from "../stats";
import { effectiveKeywords, preventDamage } from "./keywords";

/** Une infliction de Dommages sur le point d'être appliquée (811). */
export interface DamageHit {
  targetId: InstanceId;
  amount: number;
  /** Élément des Dommages (410.1), casse libre — normalisé ici. */
  element: string;
  /** Dommages de combat (duels/frappes) vs effet ciblé. */
  combat: boolean;
  sourceId?: InstanceId | null;
}

/** La cible tient-elle un rôle dans le combat (attaquant/bloqueur/cible) ? */
function inCombatRole(
  stance: CombatStance | undefined,
  id: InstanceId,
): boolean {
  if (!stance) return false;
  return (
    stance.attackers.includes(id) ||
    stance.targetId === id ||
    stanceBlockers(stance).includes(id)
  );
}

/**
 * Montant FINAL des Dommages de `hit` après la passe unique de
 * modificateurs. Pur — ne dispatch rien.
 */
export function reduceDamage(
  ctx: RulesCtx,
  hit: DamageHit,
  mods: DamageMod[] = [],
  stance?: CombatStance,
): number {
  let amount = hit.amount;
  if (amount <= 0) return 0;
  // 1. Résistance de la cible (7469)
  amount = preventDamage(
    effectiveKeywords(ctx, hit.targetId),
    amount,
    normElement(hit.element),
  );
  // 2. réductions continues de la CIBLE (Poum) — en combat seulement :
  // « Tant que [self] est attaquant, bloqueur ou cible d'une attaque … »
  if (inCombatRole(stance, hit.targetId)) {
    const inst = ctx.state.instances[hit.targetId];
    const card = inst ? ctx.getCard(inst.cardId) : null;
    const side = inst?.face === "verso" ? "verso" : "recto";
    for (const s of staticAbilitiesOf(card, side)) {
      if (s.kind === "combatDamageReduction") amount -= s.n;
    }
  }
  // 3. modificateurs globaux — Trêve absorbe tout (seul mod du lot C)
  if (mods.some((m) => m.kind === "treve")) amount = 0;
  // plancher 0 (7482)
  return Math.max(0, amount);
}

/**
 * Modificateurs globaux ACTIFS d'après l'état : une Trêve est active tant
 * que le tour courant n'a pas atteint le jeton `treveUntilTurn` posé sur un
 * Héros (« jusqu'au début de votre prochain tour »).
 */
export function activeGlobalMods(ctx: RulesCtx): DamageMod[] {
  const mods: DamageMod[] = [];
  for (const seat of ["A", "B"] as const) {
    const id = ctx.state.seats[seat].heroInstanceId;
    const hero = id ? ctx.state.instances[id] : null;
    const until = hero?.counters.tokens?.treveUntilTurn ?? 0;
    if (until > ctx.state.turn.number) {
      mods.push({ kind: "treve" });
      break; // un seul mod absorbant suffit
    }
  }
  return mods;
}
