/**
 * Détermination du vainqueur d'après l'ÉTAT (règle 103.2). Module ISOLÉ, sans
 * aucune dépendance « carte » (pas de cardAttrs) : son seul import de VALEUR est
 * `otherSeat` (../types/zones.ts, déjà Deno-safe). Il est donc importable tel
 * quel par les Edge Functions Deno (submit_event) — contrairement à `progress.ts`
 * qui tire `cardAttrs` → `@/types/cards` (alias Vite irrésoluble côté Deno).
 */
import type { Seat } from "../types/zones";
import { otherSeat } from "../types/zones.ts"; // value import → .ts for Deno
import type { RulesCtx } from "./types";

/** XP requis pour le Niveau 3 (victoire à l'Expérience). 307.5 */
export const XP_LEVEL_3 = 18;

export function heroHp(ctx: RulesCtx, seat: Seat): number | null {
  const id = ctx.state.seats[seat].heroInstanceId;
  const hero = id ? ctx.state.instances[id] : null;
  return hero ? (hero.counters.hp ?? 1) : null;
}

/** Vainqueur d'après l'état : PV adverses ≤ 0 (103.2a) ou Niveau 3 (103.2b). */
export function victoryFromState(ctx: RulesCtx): Seat | null {
  // 103.3 : si les DEUX Héros tombent à 0 simultanément, personne ne gagne
  // (ils restent en jeu avec 1 PV — voir equalityRescueEvents).
  const hpA = heroHp(ctx, "A");
  const hpB = heroHp(ctx, "B");
  if (hpA !== null && hpB !== null && hpA <= 0 && hpB <= 0) return null;
  for (const seat of ["A", "B"] as Seat[]) {
    const id = ctx.state.seats[seat].heroInstanceId;
    const hero = id ? ctx.state.instances[id] : null;
    // 103.2c — le Héros a quitté le jeu (instance disparue ou hors du Monde /
    // Havre-Sac, sa zone d'origine) → son contrôleur perd.
    const zone = hero?.location.zone;
    if (!hero || (zone !== "monde" && zone !== "havreSac"))
      return otherSeat(seat);
    if ((hero.counters.hp ?? 1) <= 0) return otherSeat(seat);
    if ((hero.counters.xp ?? 0) >= XP_LEVEL_3) return seat;
  }
  return null;
}
