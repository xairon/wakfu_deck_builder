/**
 * Moteur de règles — statistiques effectives d'une instance en jeu.
 * La Force effective = Force imprimée (face courante) + modificateurs
 * temporaires (`tokens.forceMod`, purgés à la fin de chaque tour). Elle sert
 * aux deux sens de la Force (204.4) : dommages infligés ET seuil de létalité.
 */
import type { InstanceId } from "../types/events";
import type { RulesCtx } from "./types";
import { forceValue } from "./cardAttrs";

export function effectiveForce(ctx: RulesCtx, id: InstanceId): number {
  const inst = ctx.state.instances[id];
  const card = inst ? ctx.getCard(inst.cardId) : null;
  if (!inst || !card) return 0;
  const base = forceValue(card, inst.face === "verso" ? "verso" : "recto");
  return Math.max(0, base + (inst.counters.tokens?.forceMod ?? 0));
}
