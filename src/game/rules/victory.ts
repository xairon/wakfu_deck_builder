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
export const XP_TEAM_VICTORY_2V2 = 36;

export function heroHp(ctx: RulesCtx, seat: Seat): number | null {
  const s = ctx.state.seats[seat];
  const id = s?.heroInstanceId;
  const hero = id ? ctx.state.instances[id] : null;
  return hero ? (hero.counters.hp ?? 1) : null;
}

/** Vainqueur d'après l'état : PV adverses ≤ 0 (103.2a) ou Niveau 3 / 36 XP Équipe (103.2b). */
export function victoryFromState(ctx: RulesCtx): Seat | null {
  const is2v2 = ctx.state.mode === "2v2";

  if (is2v2) {
    // 1. Victoire à l'Expérience d'Équipe (36 XP)
    const xp1 = ctx.state.teamXp?.team1 ?? 0;
    const xp2 = ctx.state.teamXp?.team2 ?? 0;
    if (xp1 >= XP_TEAM_VICTORY_2V2) return "A1";
    if (xp2 >= XP_TEAM_VICTORY_2V2) return "B1";

    // 2. Victoire au Combat (tous les Héros d'une équipe éliminés / à 0 PV)
    const eliminated = ctx.state.eliminatedSeats ?? [];
    const team1Alive = (["A1", "A2"] as Seat[]).filter(
      (s) => !eliminated.includes(s) && (heroHp(ctx, s) ?? 0) > 0,
    );
    const team2Alive = (["B1", "B2"] as Seat[]).filter(
      (s) => !eliminated.includes(s) && (heroHp(ctx, s) ?? 0) > 0,
    );

    if (team1Alive.length === 0 && team2Alive.length > 0) return "B1";
    if (team2Alive.length === 0 && team1Alive.length > 0) return "A1";
    return null;
  }

  // 103.3 : si les DEUX Héros tombent à 0 simultanément, personne ne gagne
  // (ils restent en jeu avec 1 PV — voir equalityRescueEvents).
  const hpA = heroHp(ctx, "A");
  const hpB = heroHp(ctx, "B");
  if (hpA !== null && hpB !== null && hpA <= 0 && hpB <= 0) return null;
  for (const seat of ["A", "B"] as Seat[]) {
    const s = ctx.state.seats[seat];
    const id = s?.heroInstanceId;
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
