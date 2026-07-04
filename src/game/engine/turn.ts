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
import type { RulesCtx } from "../rules/types";
import { resolveDestroyTarget } from "../rules/effects/targeting.ts";

/**
 * DESTRUCTIONS DE FIN DE TOUR (« détruisez … à la fin du tour » — Katsou Mee) :
 * détruit FIDÈLEMENT (resolveDestroyTarget → Défausse + XP 415.1) les créatures
 * du joueur SORTANT portant le flag `destroyAtTurnEnd`, AVANT la transition (donc
 * avant la purge des jetons). Partagé jeu local (`nextTurn`) + autorité serveur
 * (`resolveIntent` END_TURN). NB : ne fait pas tourner les déclenchés de mort
 * (onSelfDestroyed / hand-watchers) — fidèle pour Katsou (aucun), à étendre si un
 * futur flag-porteur en a.
 */
export function turnEndDestroyEvents(ctx: RulesCtx): DraftEvent[] {
  const ending = ctx.state.turn.active;
  const events: DraftEvent[] = [];
  for (const inst of Object.values(ctx.state.instances)) {
    if (inst.controller !== ending) continue;
    const zone = inst.location.zone;
    if (zone !== "monde" && zone !== "havreSac") continue;
    if (!inst.counters.tokens?.destroyAtTurnEnd) continue;
    events.push(...resolveDestroyTarget(ctx, ending, inst.instanceId).events);
  }
  return events;
}

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
    // « ne peut pas se redresser jusqu'au début de votre prochain tour »
    // (noUntapUntilTurn, posé par tapTarget{cannotRedress}) : on SAUTE le
    // redressement tant que le jeton est actif (valeur > tour entrant — même
    // borne que la Trêve, lue sur l'INSTANTANÉ : la purge ci-dessus n'est pas
    // encore appliquée). Le jeton expire au début du tour de l'auteur de
    // l'effet (isTurnToken : nextNumber ≥ valeur), libérant le redressement
    // au tour suivant du contrôleur de la cible.
    const noUntapUntil = inst.counters.tokens?.noUntapUntilTurn ?? 0;
    if (inst.orientation === "tapped" && noUntapUntil <= nextNumber) {
      events.push(untap(next, inst.instanceId));
    }
    if (inst.counters.damage) {
      events.push(setCounter(next, inst.instanceId, "damage", 0));
    }
  }
  return events;
}
