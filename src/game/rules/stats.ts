/**
 * Moteur de règles — statistiques effectives d'une instance en jeu.
 * La Force effective (204.4, 812.2) compose, dans l'ordre :
 *   base imprimée (face courante) OU définie par un pouvoir continu
 *   (`forceEqualsHandSize`, Vrombyx) ;
 *   + auras `forceAura` des AUTRES cartes alliées du Monde (805.2,
 *     « vos autres Alliés [Famille] dans le Monde ») ;
 *   + `teamForceMod` du Héros du contrôleur (812.3b, Stratégie de Groupe :
 *     ensemble dynamique — tout Allié du Monde du siège en profite, même
 *     arrivé après la résolution) ;
 *   + `forceWhileBlocking` si la posture dit que la carte bloque (805.1) ;
 *   + jetons temporaires `forceMod` (fin de tour) et `forceCombatMod`
 *     (fin de combat, Bruss Ouilis) ;
 *   clamp ≥ 0. Elle sert aux deux sens de la Force : dommages infligés ET
 *   seuil de létalité.
 */
import type { InstanceId } from "../types/events";
import type { CombatStance, RulesCtx } from "./types";
import { forceValue, normWord } from "./cardAttrs";
import { staticAbilitiesOf } from "./modifiers";

/** Posture de combat minimale (805.1) : qui bloque actuellement. */
export interface ForceStance {
  blockers?: InstanceId[];
}

/** Posture acceptée partout : minimale (lot B) ou complète (lot C). */
export type AnyStance = ForceStance | CombatStance;

/** Bloqueurs effectifs d'une posture, quelle que soit sa forme. */
export function stanceBlockers(stance?: AnyStance): InstanceId[] {
  if (!stance) return [];
  if ("blocks" in stance) {
    return Object.keys(stance.blocks).filter((b) =>
      stance.attackers.includes(stance.blocks[b]),
    );
  }
  return stance.blockers ?? [];
}

export function effectiveForce(
  ctx: RulesCtx,
  id: InstanceId,
  stance?: AnyStance,
): number {
  const inst = ctx.state.instances[id];
  const card = inst ? ctx.getCard(inst.cardId) : null;
  if (!inst || !card) return 0;
  const side = inst.face === "verso" ? "verso" : "recto";
  const statics = staticAbilitiesOf(card, side);
  // 812.2 — base : imprimée, ou définie par un pouvoir continu (Vrombyx)
  let force = statics.some((s) => s.kind === "forceEqualsHandSize")
    ? ctx.state.seats[inst.controller].main.length
    : forceValue(card, side);
  if (inst.location.zone === "monde" && card.mainType === "Allié") {
    // 805.2 — auras des AUTRES cartes du Monde, même contrôleur (la source
    // ne se compte jamais elle-même : « vos AUTRES Alliés … »)
    for (const srcId of ctx.state.monde) {
      if (srcId === id) continue;
      const src = ctx.state.instances[srcId];
      if (!src || src.controller !== inst.controller) continue;
      const srcCard = ctx.getCard(src.cardId);
      if (!srcCard) continue;
      const srcSide = src.face === "verso" ? "verso" : "recto";
      for (const s of staticAbilitiesOf(srcCard, srcSide)) {
        if (
          s.kind === "forceAura" &&
          (card.subTypes ?? []).some((st) => normWord(st) === s.sub)
        )
          force += s.n;
      }
    }
    // 812.3b — modificateur de SIÈGE (Stratégie de Groupe) : posé sur le
    // Héros du contrôleur, il profite à TOUT Allié du Monde de ce siège,
    // y compris arrivé après la résolution (ensemble dynamique).
    const heroId = ctx.state.seats[inst.controller].heroInstanceId;
    const hero = heroId ? ctx.state.instances[heroId] : null;
    force += hero?.counters.tokens?.teamForceMod ?? 0;
  }
  // 805.1 — « Tant qu'il bloque » (Maître Bolet)
  if (stanceBlockers(stance).includes(id)) {
    for (const s of statics) if (s.kind === "forceWhileBlocking") force += s.n;
  }
  return Math.max(
    0,
    force +
      (inst.counters.tokens?.forceMod ?? 0) +
      (inst.counters.tokens?.forceCombatMod ?? 0),
  );
}
