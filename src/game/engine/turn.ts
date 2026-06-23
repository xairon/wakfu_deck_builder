/**
 * Passage de tour (PUR) — autorité partagée serveur/navigateur.
 *
 * `nextTurnEvents(state)` calcule la suite d'events autoritatifs du changement
 * de tour, SANS dépendre du store ni du DOM (tourne identiquement dans Deno et
 * le navigateur). Consommé par `gameStore.nextTurn` (jeu local) et par
 * `resolveIntent` END_TURN (autorité serveur), pour que la transition de tour
 * vive en UN SEUL endroit.
 *
 * Effets :
 *  1. passe la main à l'adversaire (SET_PHASE, tour suivant, phase principale) ;
 *  2. purge les jetons « jusqu'à la fin du tour » de TOUTES les cartes
 *     (`isTurnToken` tranche : Force/PA/PM, *CombatMod, resMod_*, powerUses,
 *     metier_*, Trêve expirée…) ; `arrivedTurn` n'est jamais purgé (mal d'invo) ;
 *  3. pour le joueur ENTRANT : redresse ses cartes en jeu inclinées (1801) et
 *     efface les dommages cumulés (410.8).
 */
import type { GameState } from "../types/state";
import type { DraftEvent } from "../types/events";
import { otherSeat } from "../types/zones.ts";
import { setPhase, untap, setCounter } from "./verbs.ts";
import { isTurnToken } from "../rules/effects/limits.ts";

export function nextTurnEvents(state: GameState): DraftEvent[] {
  const next = otherSeat(state.turn.active);
  const nextNumber = state.turn.number + 1;
  const events: DraftEvent[] = [
    setPhase(next, { active: next, number: nextNumber, phase: "principale" }),
  ];
  for (const inst of Object.values(state.instances)) {
    // Purge centralisée des jetons temporaires, tout contrôleur confondu.
    for (const [name, value] of Object.entries(inst.counters.tokens ?? {})) {
      if (value && isTurnToken(name, value, nextNumber)) {
        events.push(setCounter(next, inst.instanceId, name, 0, true));
      }
    }
    const inPlay =
      inst.location.zone === "monde" || inst.location.zone === "havreSac";
    if (inst.controller !== next || !inPlay) continue;
    if (inst.orientation === "tapped") {
      events.push(untap(next, inst.instanceId));
    }
    if (inst.counters.damage) {
      events.push(setCounter(next, inst.instanceId, "damage", 0));
    }
  }
  return events;
}
