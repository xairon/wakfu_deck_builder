/**
 * Résolveur d'intentions PUR (jeu + combat) — autorité partagée serveur/nav.
 * Réf. docs/superpowers/specs/2026-06-23-server-authoritative-rules-design.md.
 *
 * `resolveIntent(state, getCard, intent, seat)` valide tour → légalité → coût →
 * combat et émet les `DraftEvent[]` autoritatifs (ou une raison d'échec FR).
 * Aucun DOM/réseau : tourne identiquement dans Deno (Edge Function) et le
 * navigateur. Le combat (P3) vit dans le journal (state.combat via SET_COMBAT) :
 * DECLARE_ATTACK/RESOLVE/CANCEL = l'attaquant, DECLARE_BLOCK = le défenseur
 * (réaction HORS de son tour, donc hors garde TURN_BOUND).
 *
 * Deno-safe : toute la chaîne de VALEURS atteignable depuis ce module (verbs, turn,
 * legality, resources → cardAttrs/modifiers/dsl → cards/config) utilise des imports
 * relatifs en `.ts` (pas d'alias `@/` runtime, élidé pour les `import type`). Vérifié
 * au déploiement (invoke anonyme de submit_event → 401 = le graphe Deno se charge).
 */
import type { Card } from "@/types/cards";
import type { CombatState, GameState } from "../types/state";
import type { GameIntent } from "../types/intents";
import type {
  DraftEvent,
  MovePayload,
  AttachPayload,
  DetachPayload,
} from "../types/events";
import type { Seat, ZoneRef } from "../types/zones";
import { otherSeat, ZONE_SPECS, zoneOwner } from "../types/zones.ts";
import {
  move,
  worldHavenSwap,
  tap,
  untap,
  setCounter,
  incCounter,
  setCombat,
  say,
} from "../engine/verbs.ts";
import { nextTurnEvents } from "../engine/turn.ts";
import {
  whyCannotPlay,
  playDestination,
  whyCannotDeclareAttack,
  eligibleAttackers,
  eligibleTargets,
  eligibleBlockers,
  pmOf,
} from "../rules/legality.ts";
import { planCost } from "../rules/resources.ts";
import { attackPmBonus, cannotCarryEquipment } from "../rules/modifiers.ts";
import { resolveCombat } from "../rules/combat.ts";
import { activeGlobalMods } from "../rules/effects/damageMods.ts";
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

/**
 * PA du Héros du siège = compteur de table + modificateur temporaire `paMod`
 * (miroir du `paOf` client + du `pmOf` de legality) ; repli 6 si absent.
 */
function paOf(state: GameState, seat: Seat): number {
  const heroId = state.seats[seat].heroInstanceId;
  const hero = heroId ? state.instances[heroId] : null;
  const mod = hero?.counters.tokens?.paMod ?? 0;
  return Math.max(0, (hero?.counters.pa ?? 6) + mod);
}

// ── Garde-fous d'AUTORITÉ pour les intentions de mutation bas niveau ─────────
// Sur le chemin EN LIGNE, `resolveIntent` est l'UNIQUE autorité : être le joueur
// actif (TURN_BOUND) ne suffit PAS à légitimer une mutation. Sans ces gardes, un
// client trafiqué pouvait, pendant son tour, forger une victoire (xp/level/hp),
// s'octroyer des ressources (pa/pm), ou voler/détruire/déplacer une carte adverse.

/** Compteurs dont la valeur DÉRIVE du jeu (combat/progression/tour) : le client
 *  ne doit JAMAIS les écrire via une intention. xp/level → victoire forgée ;
 *  hp → kill ; pa/pm → ressources infinies ; resistance/damage → combat faussé. */
const PROTECTED_COUNTERS = new Set([
  "hp",
  "xp",
  "level",
  "pa",
  "pm",
  "resistance",
  "damage",
]);
/** Jetons protégés (dans `counters.tokens`) : paMod alimente paOf (PA effective). */
const PROTECTED_TOKENS = new Set(["paMod"]);
function counterIsProtected(counter: string, token?: boolean): boolean {
  return token
    ? PROTECTED_TOKENS.has(counter)
    : PROTECTED_COUNTERS.has(counter);
}

/** L'instance existe ET est contrôlée par le siège ? (raison FR sinon). Empêche
 *  toute mutation d'une carte de l'adversaire (vol / destruction / kill). */
function controlError(state: GameState, seat: Seat, id: string): string | null {
  const inst = state.instances[id];
  if (!inst) return "Carte inconnue.";
  if (inst.controller !== seat) return "Tu ne contrôles pas cette carte.";
  return null;
}

/** La destination est-elle une zone PRIVÉE de l'adversaire ? (interdit d'y
 *  déposer une carte : main / pioche / réserve adverse). */
function destIsForbidden(to: ZoneRef, seat: Seat): boolean {
  const owner = zoneOwner(to);
  return !ZONE_SPECS[to.zone].public && owner !== null && owner !== seat;
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
      // 309.1 — la zone d'arrivée dépend du type (Salle → Havre-Sac, sinon Monde).
      const dest = playDestination(card, seat);
      const events: DraftEvent[] = plan.producers.map((id) => tap(seat, id));
      events.push(
        move(seat, {
          instanceId: intent.instanceId,
          from: inst.location,
          to: dest,
          position: intent.position ?? { at: "any" },
          visibility: { faceDown: false, visibleTo: "all" },
          preservesIdentity: false,
          orientationOnArrival: "upright",
        }),
      );
      // Mal d'invocation (1821) : jeton du tour d'arrivée.
      events.push(
        setCounter(
          seat,
          intent.instanceId,
          "arrivedTurn",
          state.turn.number,
          true,
        ),
      );
      // 2342 — bonus de doublement du Havre-Sac à USAGE UNIQUE : si le Havre-Sac
      // doublé du 2e joueur sert à payer au tour 2, on pose le jeton anti-redouble.
      const sacId = state.seats[seat].havreSacInstanceId;
      if (
        sacId &&
        seat !== state.turn.firstPlayer &&
        state.turn.number === 2 &&
        plan.producers.includes(sacId)
      ) {
        events.push(setCounter(seat, sacId, "sacBonusUsed", 1, true));
      }
      return { events };
    }

    case "MOVE_CARD": {
      const inst = state.instances[intent.instanceId];
      if (!inst) return { error: "Carte inconnue." };
      // Autorité : on ne déplace QUE ses propres cartes, et jamais vers une zone
      // privée adverse (sinon vol/destruction/exil du Héros adverse = défaite).
      if (inst.controller !== seat)
        return { error: "Tu ne contrôles pas cette carte." };
      if (destIsForbidden(intent.to, seat))
        return { error: "Destination interdite (zone privée adverse)." };
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
      const events: DraftEvent[] = [move(seat, payload)];
      // Entrée en jeu (hors échange Monde↔Havre-Sac, traité plus haut) : jeton du
      // tour d'arrivée pour le mal d'invocation (1821).
      if (toZone === "monde" || toZone === "havreSac") {
        events.push(
          setCounter(
            seat,
            intent.instanceId,
            "arrivedTurn",
            state.turn.number,
            true,
          ),
        );
      }
      return { events };
    }

    case "TAP": {
      const err = controlError(state, seat, intent.instanceId);
      if (err) return { error: err };
      return { events: [tap(seat, intent.instanceId)] };
    }

    case "UNTAP": {
      const err = controlError(state, seat, intent.instanceId);
      if (err) return { error: err };
      return { events: [untap(seat, intent.instanceId)] };
    }

    case "SET_COUNTER": {
      const err = controlError(state, seat, intent.instanceId);
      if (err) return { error: err };
      if (counterIsProtected(intent.counter, intent.token))
        return {
          error:
            "Compteur protégé : il dérive du jeu (combat/progression), non modifiable manuellement en ligne.",
        };
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
    }

    case "INC_COUNTER": {
      const err = controlError(state, seat, intent.instanceId);
      if (err) return { error: err };
      if (counterIsProtected(intent.counter, intent.token))
        return {
          error:
            "Compteur protégé : il dérive du jeu (combat/progression), non modifiable manuellement en ligne.",
        };
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
    }

    // Le Niveau/XP dérivent EXCLUSIVEMENT de la progression (combat →
    // grantXpEvents, côté serveur). Un SET_LEVEL client serait une victoire
    // forgée (level/xp = condition de victoire) → refusé en ligne.
    case "SET_LEVEL":
      return {
        error:
          "Le niveau dérive de la progression (combat), non modifiable manuellement en ligne.",
      };

    case "ATTACH": {
      const e1 = controlError(state, seat, intent.equipmentId);
      if (e1) return { error: e1 };
      const e2 = controlError(state, seat, intent.bearerId);
      if (e2) return { error: e2 };
      // « [bearer] ne peut pas porter d'Équipement. » (Allies Élémentaires) —
      // pouvoir continu refusant à cette créature le rôle de Porteur.
      if (cannotCarryEquipment(ctx, intent.bearerId))
        return { error: "Cette carte ne peut pas porter d'Équipement." };
      const payload: AttachPayload = {
        equipmentId: intent.equipmentId,
        bearerId: intent.bearerId,
      };
      return { events: [{ actor: seat, type: "ATTACH", payload }] };
    }

    case "DETACH": {
      const err = controlError(state, seat, intent.equipmentId);
      if (err) return { error: err };
      if (destIsForbidden(intent.to, seat))
        return { error: "Destination interdite (zone privée adverse)." };
      const payload: DetachPayload = {
        equipmentId: intent.equipmentId,
        to: intent.to,
        position: intent.position,
      };
      return { events: [{ actor: seat, type: "DETACH", payload }] };
    }

    case "END_TURN": {
      // 4873 — on ne passe pas la main avec un excédent : il faut défausser
      // l'excédent d'abord (le client gate déjà ; le serveur fait autorité).
      if (state.seats[seat].main.length > paOf(state, seat))
        return {
          error: "Main pleine : défausse l'excédent avant de finir le tour.",
        };
      // Pioche jusqu'aux PA puis passe la main. On NE génère PAS N drawTop ici :
      // chaque pioche dépend de l'état COURANT (sommet de la Pioche), donc émettre
      // N drawTop depuis le MÊME pré-état pointerait toutes la même carte. On
      // renvoie `draws` ; `submit_event` résout `draws` pioches séquentielles en
      // re-dérivant l'état entre chacune (comme la redite du MULLIGAN).
      const need = Math.max(
        0,
        paOf(state, seat) - state.seats[seat].main.length,
      );
      // Transition de tour COMPLÈTE (partagée avec gameStore.nextTurn) : SET_PHASE
      // + purge des jetons de tour + redressement/effacement des dégâts du joueur
      // entrant. Les `need` pioches du joueur SORTANT sont appliquées par
      // `submit_event` après ces events (l'acteur des pioches reste le siège).
      const events = nextTurnEvents(state);
      return { events, draws: need };
    }

    // ── Combat (P3) — adjugé par le serveur. DECLARE_BLOCK vient du DÉFENSEUR
    // HORS de son tour (réaction légitime) : ces intentions ne sont donc PAS
    // dans TURN_BOUND ; chacune impose son propre contrôle d'autorité. ────────
    case "DECLARE_ATTACK": {
      if (state.combat) return { error: "Un combat est déjà en cours." };
      if (state.turn.active !== seat)
        return { error: "Ce n'est pas votre tour." };
      const reason = whyCannotDeclareAttack(
        ctx,
        seat,
        state.lastAttackTurn?.[seat] ?? null,
      );
      if (reason) return { error: reason };
      if (!intent.attackers.length)
        return { error: "Déclare au moins un attaquant." };
      const eligibleA = new Set(eligibleAttackers(ctx, seat));
      for (const a of intent.attackers) {
        if (!eligibleA.has(a))
          return {
            error:
              "Attaquant illégal (incliné, arrivé ce tour, ou non combattant).",
          };
      }
      const target = eligibleTargets(ctx, seat).find(
        (t) => t.instanceId === intent.target.instanceId,
      );
      if (!target)
        return {
          error: "Cible illégale : Héros, Allié ou Havre-Sac adverse (702.2).",
        };
      // 703 + ruling Bruss : le +1 PM d'un « Quand il attaque » compte AVANT la
      // vérification de la limite (jetons pas encore posés).
      const cap = pmOf(ctx, seat) + attackPmBonus(ctx, intent.attackers);
      if (intent.attackers.length > cap)
        return { error: `Maximum ${cap} attaquant(s) — limite de PM (703).` };
      // 703/A6 : les attaquants s'inclinent dès la DÉCLARATION.
      const events: DraftEvent[] = intent.attackers
        .filter((id) => state.instances[id]?.orientation !== "tapped")
        .map((id) => tap(seat, id));
      const combat: CombatState = {
        attackerSeat: seat,
        step: "blockers",
        target,
        attackers: [...intent.attackers],
        blocks: {},
        strikes: {},
        ripostes: {},
        reactingSeat: otherSeat(seat),
      };
      events.push(setCombat(seat, combat));
      return { events };
    }

    case "DECLARE_BLOCK": {
      const c = state.combat;
      if (!c || c.step !== "blockers")
        return { error: "Aucun combat à bloquer." };
      const def = otherSeat(c.attackerSeat);
      if (seat !== def)
        return { error: "Seul le défenseur peut déclarer des blocages." };
      const pm = pmOf(ctx, def);
      if (Object.keys(intent.blocks).length > pm)
        return { error: `Maximum ${pm} bloqueur(s) — limite de PM (704).` };
      const eligibleB = new Set(eligibleBlockers(ctx, def, c.target));
      const attackerSet = new Set(c.attackers);
      for (const [blockerId, attackerId] of Object.entries(intent.blocks)) {
        if (!eligibleB.has(blockerId))
          return {
            error: "Bloqueur illégal (incliné, cible, ou ne peut pas bloquer).",
          };
        if (!attackerSet.has(attackerId))
          return { error: "Blocage assigné à un non-attaquant." };
      }
      // Ripostes (707.1) : le serveur REJETTE les choix illégaux (clé ≠ Cible,
      // ou valeur hors des attaquants déclarés) plutôt que de les persister et
      // laisser resolveCombat les corriger silencieusement (autorité serveur).
      for (const [targetId, attackerId] of Object.entries(
        intent.ripostes ?? {},
      )) {
        if (targetId !== c.target.instanceId)
          return { error: "Riposte invalide (cible inattendue)." };
        if (!attackerSet.has(attackerId))
          return { error: "Riposte assignée à un non-attaquant." };
      }
      // Déclaration des blocages → step "resolve" : l'attaquant peut maintenant
      // résoudre (le défenseur a eu sa fenêtre de blocage, même s'il bloque 0).
      const next: CombatState = {
        ...c,
        step: "resolve",
        blocks: { ...intent.blocks },
        ripostes: intent.ripostes ?? c.ripostes,
      };
      return { events: [setCombat(seat, next)] };
    }

    case "RESOLVE_COMBAT": {
      const c = state.combat;
      if (!c) return { error: "Aucun combat à résoudre." };
      if (seat !== c.attackerSeat)
        return { error: "Seul l'attaquant peut résoudre le combat." };
      if (c.step !== "resolve")
        return { error: "Le défenseur n'a pas encore déclaré ses blocages." };
      // Frappes (6105) : on REJETTE les choix illégaux (attaquant non déclaré, ou
      // bloqueur qui ne bloque pas cet attaquant) au lieu de laisser resolveCombat
      // retomber silencieusement sur le premier bloqueur (autorité serveur).
      for (const [attackerId, blockerId] of Object.entries(
        intent.strikes ?? {},
      )) {
        if (!c.attackers.includes(attackerId))
          return { error: "Frappe d'un non-attaquant." };
        if (c.blocks[blockerId] !== attackerId)
          return {
            error: "Frappe vers un bloqueur qui ne bloque pas cet attaquant.",
          };
      }
      // resolveCombat applique les défauts (premier bloqueur frappé, première
      // riposte) si strikes/ripostes manquent → robuste même sans choix fins.
      const result = resolveCombat(
        ctx,
        {
          attackerSeat: c.attackerSeat,
          target: c.target,
          attackers: c.attackers,
          blocks: c.blocks,
          strikes: intent.strikes ?? c.strikes,
          ripostes: c.ripostes,
        },
        activeGlobalMods(ctx),
      );
      const events: DraftEvent[] = [
        ...result.events,
        ...result.log.map((l) => say(seat, l)),
        // Clôt le combat + enregistre l'attaque du tour (603). L'auto-victoire
        // est vérifiée par submit_event sur l'état résultant (PV ≤ 0).
        setCombat(seat, null, seat),
      ];
      return { events };
    }

    case "CANCEL_COMBAT": {
      const c = state.combat;
      if (!c) return { events: [] };
      if (seat !== c.attackerSeat)
        return { error: "Seul l'attaquant peut annuler le combat." };
      // A6 : on redresse les attaquants inclinés à la déclaration (combat avorté).
      const untaps: DraftEvent[] = c.attackers
        .filter((id) => state.instances[id]?.orientation === "tapped")
        .map((id) => untap(seat, id));
      return { events: [...untaps, setCombat(seat, null)] };
    }

    // Garde défensive : une intention malformée (kind inconnu venu du réseau)
    // est REJETÉE proprement plutôt que de retomber sur `undefined` (qui ferait
    // planter submit_event). `intent` est `never` ici pour le type-checker.
    default:
      return {
        error: `Intention inconnue : ${String((intent as { kind?: string }).kind)}`,
      };
  }
}
