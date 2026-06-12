/**
 * Moteur de règles — statistiques effectives d'une instance en jeu.
 * La Force effective (204.4, 812.2) compose, dans l'ordre :
 *   base imprimée (face courante) OU définie par un pouvoir continu
 *   (`forceEqualsHandSize`, Vrombyx) ;
 *   + auras `forceAura` des AUTRES cartes alliées du Monde (805.2,
 *     « vos autres Alliés [Famille] dans le Monde ») ;
 *   + `forceWhileBlocking` si la posture dit que la carte bloque (805.1) ;
 *   + jetons temporaires `forceMod` (purgés à la fin du tour) ;
 *   clamp ≥ 0. Elle sert aux deux sens de la Force : dommages infligés ET
 *   seuil de létalité.
 */
import type { InstanceId } from "../types/events";
import type { RulesCtx } from "./types";
import { forceValue, normWord } from "./cardAttrs";
import { staticAbilitiesOf } from "./modifiers";

/** Posture de combat minimale (805.1) : qui bloque actuellement. */
export interface ForceStance {
  blockers?: InstanceId[];
}

export function effectiveForce(
  ctx: RulesCtx,
  id: InstanceId,
  stance?: ForceStance,
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
  // 805.2 — auras des AUTRES cartes du Monde, même contrôleur (la source
  // ne se compte jamais elle-même : « vos AUTRES Alliés … »)
  if (inst.location.zone === "monde" && card.mainType === "Allié") {
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
  }
  // 805.1 — « Tant qu'il bloque » (Maître Bolet)
  if (stance?.blockers?.includes(id)) {
    for (const s of statics) if (s.kind === "forceWhileBlocking") force += s.n;
  }
  return Math.max(0, force + (inst.counters.tokens?.forceMod ?? 0));
}
