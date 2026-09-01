/**
 * Moteur de règles R1 — Expérience, montée de niveau, victoire.
 * 415.1 (gain d'XP), 307.4/307.5 (verso à 6 XP, Niveau 3 à 18 XP),
 * 103.2 (défaite à 0 PV / victoire au Niveau 3).
 */
import type { DraftEvent } from "../types/events";
import type { Seat } from "../types/zones";
import type { RulesCtx } from "./types";
import { flipLevel, incCounter, setCounter } from "../engine/verbs.ts";
import { heroStats } from "./cardAttrs.ts";
import { getTeam } from "../types/zones.ts";
import { heroHp, victoryFromState, XP_LEVEL_3, XP_TEAM_VICTORY_2V2 } from "./victory.ts";

// La détermination du vainqueur vit dans `./victory` (module Deno-safe, sans
// dépendance carte) pour être importable côté serveur ; on la ré-exporte ici
// pour ne pas casser les imports existants (store, barrel @/game/rules).
export { victoryFromState, XP_LEVEL_3, XP_TEAM_VICTORY_2V2 };

export const XP_LEVEL_2 = 6;

export interface XpGrant {
  events: DraftEvent[];
  log: string[];
  /** Niveau atteint par ce gain (2 = flip verso, 3 = victoire). */
  leveledTo: 2 | 3 | null;
  won: boolean;
}

/**
 * Événements pour faire gagner `amount` XP au Héros de `seat` : INC xp,
 * flip verso + ajustement PA/PM/PV au 6ᵉ XP, victoire au 18ᵉ (en 1v1) ou 36ᵉ d'équipe (en 2v2).
 */
export function grantXpEvents(
  ctx: RulesCtx,
  seat: Seat,
  amount: number,
): XpGrant {
  const none: XpGrant = { events: [], log: [], leveledTo: null, won: false };
  if (amount <= 0) return none;
  const s = ctx.state.seats[seat];
  const heroId = s?.heroInstanceId;
  const hero = heroId ? ctx.state.instances[heroId] : null;
  if (!heroId || !hero) return none;

  const is2v2 = ctx.state.mode === "2v2";
  const before = hero.counters.xp ?? 0;
  // En 2v2, un Héros individuel plafonne à 18 XP (Niveau 2 max)
  const after = is2v2 ? Math.min(18, before + amount) : before + amount;
  const actualGrant = after - before;
  const events: DraftEvent[] = actualGrant > 0 ? [incCounter(seat, heroId, "xp", actualGrant)] : [];
  const log: string[] = [`gagne ${amount} XP (${after} au total).`];
  let leveledTo: 2 | 3 | null = null;

  if (before < XP_LEVEL_2 && after >= XP_LEVEL_2 && hero.face !== "verso") {
    leveledTo = 2;
    events.push(flipLevel(seat, heroId, "verso", 2, after));
    const card = ctx.getCard(hero.cardId);
    const recto = card ? heroStats(card, "recto") : undefined;
    const verso = card ? heroStats(card, "verso") : undefined;
    if (verso?.pa !== undefined)
      events.push(setCounter(seat, heroId, "pa", verso.pa));
    if (verso?.pm !== undefined)
      events.push(setCounter(seat, heroId, "pm", verso.pm));
    const pvDelta = (verso?.pv ?? 0) - (recto?.pv ?? 0);
    if (pvDelta > 0) events.push(incCounter(seat, heroId, "hp", pvDelta));
    log.push("passe au Niveau 2 (verso) !");
  }

  const team = getTeam(seat);
  const currentTeamXp = (ctx.state.teamXp?.[team] ?? 0) + amount;
  const won = is2v2 ? currentTeamXp >= XP_TEAM_VICTORY_2V2 : after >= XP_LEVEL_3;

  if (won) {
    if (!is2v2) {
      leveledTo = 3;
      events.push(setCounter(seat, heroId, "level", 3));
      log.push("atteint le Niveau 3 — victoire à l'Expérience !");
    } else {
      log.push(`L'équipe ${team === "team1" ? "1" : "2"} atteint ${currentTeamXp}/36 XP — victoire à l'Expérience d'Équipe !`);
    }
  }
  return { events, log, leveledTo, won };
}

/**
 * Égalité 103.3 : les deux Héros à 0 PV ou moins au même instant → les deux
 * restent en jeu avec 1 PV. Retourne les événements de sauvetage (ou []).
 */
export function equalityRescueEvents(ctx: RulesCtx): DraftEvent[] {
  const hpA = heroHp(ctx, "A");
  const hpB = heroHp(ctx, "B");
  if (hpA === null || hpB === null || hpA > 0 || hpB > 0) return [];
  const events: DraftEvent[] = [];
  for (const seat of ["A", "B"] as Seat[]) {
    const id = ctx.state.seats[seat].heroInstanceId;
    if (id) events.push(setCounter(seat, id, "hp", 1));
  }
  return events;
}
