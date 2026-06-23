/**
 * Résolveur d'intentions PUR (non-combat) — autorité partagée serveur/navigateur.
 * Réf. docs/superpowers/specs/2026-06-23-server-authoritative-rules-design.md.
 *
 * `resolveIntent(state, getCard, intent, seat)` valide tour → légalité → coût et
 * émet les `DraftEvent[]` autoritatifs (ou une raison d'échec en français). Aucun
 * DOM/réseau : tourne identiquement dans Deno (Edge Function) et le navigateur.
 *
 * NOTE Deno (Task 6) : ce module importe (indirectement, via `legality`/`resources`
 * → `cardAttrs`/`modifiers`) des VALEURS depuis `@/types/cards` (alias Vite) et des
 * imports relatifs sans extension `.ts`. L'Edge bundle ne résout NI l'alias `@/` ni
 * les imports sans extension : avant d'importer ce fichier dans `submit_event`, il
 * faudra rendre cette chaîne Deno-safe (extraire la lecture de `Card` côté Deno ou
 * réécrire ces imports en `.ts`/relatifs). Voir STATUS du commit Task 5.
 */
import type { Card } from "@/types/cards";
import type { GameState } from "../types/state";
import type { GameIntent } from "../types/intents";
import type {
  DraftEvent,
  MovePayload,
  AttachPayload,
  DetachPayload,
} from "../types/events";
import type { Seat } from "../types/zones";
import { otherSeat } from "../types/zones";
import {
  move,
  playToWorld,
  worldHavenSwap,
  tap,
  untap,
  setCounter,
  incCounter,
  flipLevel,
  setPhase,
} from "../engine/verbs";
import { whyCannotPlay } from "../rules/legality";
import { planCost } from "../rules/resources";
import type { RulesCtx } from "../rules/types";

/** Résultat d'une intention : events seuls, erreur, ou events + N pioches (END_TURN). */
export type IntentResult =
  | { events: DraftEvent[] }
  | { error: string }
  | { events: DraftEvent[]; draws: number };

/** Toutes les intentions de P1 sont liées au tour (le combat hors-tour viendra en P3). */
const TURN_BOUND = new Set<GameIntent["kind"]>([
  "PLAY_CARD",
  "MOVE_CARD",
  "TAP",
  "UNTAP",
  "SET_COUNTER",
  "INC_COUNTER",
  "SET_LEVEL",
  "ATTACH",
  "DETACH",
  "END_TURN",
]);

/** PA du Héros du siège (suivi de table) ; repli 6 si Héros/compteur absent. */
function paOf(state: GameState, seat: Seat): number {
  const heroId = state.seats[seat].heroInstanceId;
  const hero = heroId ? state.instances[heroId] : null;
  return hero?.counters.pa ?? 6;
}

/**
 * Valide + résout une intention de jeu en events autoritatifs.
 * L'acteur (`seat`) est IMPOSÉ par l'appelant (siège authentifié) — jamais lu
 * dans le payload, pour qu'un client ne puisse pas forger l'action de l'adversaire.
 */
export function resolveIntent(
  state: GameState,
  getCard: (id: string | null) => Card | null,
  intent: GameIntent,
  seat: Seat,
): IntentResult {
  const ctx: RulesCtx = { state, getCard };

  // Garde de tour : une intention liée au tour ne peut venir que du joueur actif.
  if (TURN_BOUND.has(intent.kind) && state.turn.active !== seat) {
    return { error: "Ce n'est pas votre tour." };
  }

  switch (intent.kind) {
    case "PLAY_CARD": {
      const reason = whyCannotPlay(ctx, seat, intent.instanceId, false);
      if (reason) return { error: reason };
      const inst = state.instances[intent.instanceId];
      const card = getCard(inst?.cardId ?? null);
      if (!inst || !card) return { error: "Carte inconnue." };
      const plan = planCost(ctx, seat, card);
      if (!plan.ok) return { error: plan.reason };
      const events: DraftEvent[] = plan.producers.map((id) => tap(seat, id));
      events.push(playToWorld(seat, intent.instanceId, intent.position));
      return { events };
    }

    case "MOVE_CARD": {
      const inst = state.instances[intent.instanceId];
      if (!inst) return { error: "Carte inconnue." };
      const fromZone = inst.location.zone;
      const toZone = intent.to.zone;
      // Monde↔Havre-Sac conserve l'identité (501.5) — worldHavenSwap.
      if (
        (fromZone === "monde" && toZone === "havreSac") ||
        (fromZone === "havreSac" && toZone === "monde")
      ) {
        return {
          events: [
            worldHavenSwap(
              seat,
              intent.instanceId,
              fromZone as "monde" | "havreSac",
            ),
          ],
        };
      }
      const toHidden = toZone === "pioche";
      const toPublic =
        toZone === "monde" ||
        toZone === "havreSac" ||
        toZone === "defausse" ||
        toZone === "fileAttente" ||
        toZone === "exil";
      const payload: MovePayload = {
        instanceId: intent.instanceId,
        from: inst.location,
        to: intent.to,
        position: intent.position ?? { at: "any" },
        visibility: toHidden
          ? { faceDown: true, visibleTo: "none" }
          : toPublic
            ? { faceDown: false, visibleTo: "all" }
            : { faceDown: false, visibleTo: [inst.owner] },
        preservesIdentity: false,
        orientationOnArrival:
          toZone === "monde" || toZone === "havreSac" ? "upright" : null,
      };
      return { events: [move(seat, payload)] };
    }

    case "TAP":
      return { events: [tap(seat, intent.instanceId)] };

    case "UNTAP":
      return { events: [untap(seat, intent.instanceId)] };

    case "SET_COUNTER":
      return {
        events: [
          setCounter(
            seat,
            intent.instanceId,
            intent.counter,
            intent.value,
            intent.token,
          ),
        ],
      };

    case "INC_COUNTER":
      return {
        events: [
          incCounter(
            seat,
            intent.instanceId,
            intent.counter,
            intent.delta,
            intent.token,
          ),
        ],
      };

    case "SET_LEVEL":
      return {
        events: [
          flipLevel(
            seat,
            intent.instanceId,
            intent.face,
            intent.level,
            intent.xp,
          ),
        ],
      };

    case "ATTACH": {
      const payload: AttachPayload = {
        equipmentId: intent.equipmentId,
        bearerId: intent.bearerId,
      };
      return { events: [{ actor: seat, type: "ATTACH", payload }] };
    }

    case "DETACH": {
      const payload: DetachPayload = {
        equipmentId: intent.equipmentId,
        to: intent.to,
        position: intent.position,
      };
      return { events: [{ actor: seat, type: "DETACH", payload }] };
    }

    case "END_TURN": {
      // Pioche jusqu'aux PA puis passe la main. On NE génère PAS N drawTop ici :
      // chaque pioche dépend de l'état COURANT (sommet de la Pioche), donc émettre
      // N drawTop depuis le MÊME pré-état pointerait toutes la même carte. On
      // renvoie `draws` ; `submit_event` résout `draws` pioches séquentielles en
      // re-dérivant l'état entre chacune (comme la redite du MULLIGAN).
      const need = Math.max(
        0,
        paOf(state, seat) - state.seats[seat].main.length,
      );
      const next = otherSeat(seat);
      const events: DraftEvent[] = [
        setPhase(next, {
          active: next,
          number: state.turn.number + 1,
          phase: "principale",
        }),
      ];
      return { events, draws: need };
    }
  }
}
