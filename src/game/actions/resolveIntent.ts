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
  attach,
  move,
  worldHavenSwap,
  tap,
  untap,
  setCounter,
  incCounter,
  setCombat,
  say,
} from "../engine/verbs.ts";
import { eligibleBearers, requiresBearer } from "../rules/bearer.ts";
import { nextTurnEvents, turnEndDestroyEvents } from "../engine/turn.ts";
import {
  whyCannotPlay,
  resolvedPlayDestination,
  whyCannotDeclareAttack,
  eligibleAttackers,
  eligibleTargets,
  eligibleBlockers,
  blockerBlockedByAgilite,
  pmOf,
} from "../rules/legality.ts";
import { planCost } from "../rules/resources.ts";
import {
  normWord,
  onceNameToken,
  recentPlayKindsOf,
  recetteOf,
  RECENT_PLAY_TOKENS,
} from "../rules/cardAttrs.ts";
import { whyCannotCraft } from "../rules/legality.ts";
import { metierOf } from "../rules/effects/keywords.ts";
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
  "CRAFT",
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
      const reason = whyCannotPlay(
        ctx,
        seat,
        intent.instanceId,
        false,
        intent.destination,
      );
      if (reason) return { error: reason };
      const inst = state.instances[intent.instanceId];
      const card = getCard(inst?.cardId ?? null);
      if (!inst || !card) return { error: "Carte inconnue." };
      const plan = planCost(ctx, seat, card);
      if (!plan.ok) return { error: plan.reason };
      // 305.x (lot F) — un ÉQUIPEMENT / une Monture se joue ATTACHÉ : le
      // Porteur est OBLIGATOIRE et validé SERVEUR (anti-triche : un bearerId
      // forgé — créature adverse, Monstre, hors jeu — est refusé net ; jouer
      // sans Porteur ne pose plus l'Équipement standalone).
      if (requiresBearer(card)) {
        if (!intent.bearerId)
          return { error: "Choisis le Porteur de cet Équipement (305.x)." };
        if (
          !eligibleBearers(ctx, seat, intent.instanceId).includes(
            intent.bearerId,
          )
        )
          return { error: "Cible de Porteur invalide (305.x)." };
      }
      // 309.1/303.1 — zone d'arrivée selon le type (Salle → Havre-Sac ; Allié →
      // Monde OU Havre-Sac au choix du contrôleur, forcé Havre-Sac au 1er tour
      // de la partie, 506.3). La destination demandée ne peut viser que la
      // zone du joueur lui-même (playDestination renvoie owner: seat).
      const dest = resolvedPlayDestination(ctx, seat, card, intent.destination);
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
      // 305.x (lot F) — ATTACH autoritatif au Porteur validé ci-dessus.
      if (requiresBearer(card) && intent.bearerId)
        events.push(attach(seat, intent.instanceId, intent.bearerId));
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
      // RÉCENCE D'APPARITION (W74, « … qui vient d'apparaître ») : marqueur
      // `justAppeared` sur le permanent qui entre en jeu (jamais une Action),
      // réinitialisé sur les autres instances — MIROIR du chemin local
      // (gameStore.justAppearedDrafts). Sans ça, Homar Chérif / Potion
      // d'Agression seraient inertes en ligne (le filtre lit ce jeton).
      if (card.mainType !== "Action") {
        for (const other of Object.values(state.instances)) {
          if (other.instanceId === intent.instanceId) continue;
          if (other.counters.tokens?.justAppeared)
            events.push(
              setCounter(seat, other.instanceId, "justAppeared", 0, true),
            );
          // Provenance (W78) : nettoyée avec le marqueur.
          if (other.counters.tokens?.justAppearedFromDefausse)
            events.push(
              setCounter(
                seat,
                other.instanceId,
                "justAppearedFromDefausse",
                0,
                true,
              ),
            );
        }
        events.push(
          setCounter(seat, intent.instanceId, "justAppeared", 1, true),
        );
      }
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
      // RÉCENCE DE JEU (Fécaline) : jeton `recentQuestParch` sur le Héros (1 si la
      // carte jouée est Quête/Parchemin, 0 sinon), écrasé à chaque jeu — MIROIR du
      // chemin local (gameStore playFromHand). Sans ça, le pouvoir de Fécaline
      // serait injouable en ligne (le gate lit ce jeton).
      const heroId = state.seats[seat].heroInstanceId;
      if (heroId) {
        const isQuestParch = (card.subTypes ?? []).some((s) => {
          const n = normWord(s);
          return n === "quete" || n === "parchemin";
        });
        events.push(
          setCounter(
            seat,
            heroId,
            "recentQuestParch",
            isQuestParch ? 1 : 0,
            true,
          ),
        );
        // GÉNÉRALISATION PAR CATÉGORIE (recentPlay<Kind>) — miroir du chemin
        // local (gameStore.playFromHand) : tous écrasés à chaque jeu.
        const kinds = new Set<string>(recentPlayKindsOf(card));
        for (const [kind, token] of Object.entries(RECENT_PLAY_TOKENS)) {
          events.push(
            setCounter(seat, heroId, token, kinds.has(kind) ? 1 : 0, true),
          );
        }
        // « Une seule <Nom> par tour » (onceNamePerTurn) — miroir local.
        if ((card.effects ?? []).some((e) => e.compiled?.onceNamePerTurn)) {
          events.push(
            setCounter(seat, heroId, onceNameToken(card.name), 1, true),
          );
        }
      }
      return { events };
    }

    case "CRAFT": {
      // A19 / lot F — FABRICATION AUTORITATIVE (305.4 / 401.4a / 418.6) :
      // TOUT est revalidé serveur sur la soumission atomique des choix — un
      // client forgé ne peut ni fabriquer sans Artisan du Métier, ni recycler
      // des cartes du mauvais Élément / d'une autre pile, ni équiper une
      // créature adverse.
      const reason = whyCannotCraft(ctx, seat, intent.equipmentId);
      if (reason) return { error: reason };
      // Portes d'arrivée hors coût (1er tour, Havre-Sac plein, Porteur
      // éligible, restrictions de jeu) — coût de lancement REMPLACÉ (freeCost).
      const playReason = whyCannotPlay(
        ctx,
        seat,
        intent.equipmentId,
        false,
        intent.destination,
        true,
      );
      if (playReason) return { error: playReason };
      const inst = state.instances[intent.equipmentId];
      const card = getCard(inst?.cardId ?? null);
      const recette = card ? recetteOf(card) : null;
      if (!inst || !card || !recette) return { error: "Carte inconnue." };
      // 401.4a — l'ARTISAN : contrôlé, DRESSÉ, en jeu, du Métier de la Recette.
      const artisan = state.instances[intent.artisanId];
      const artisanCard = getCard(artisan?.cardId ?? null);
      const az = artisan?.location.zone;
      if (
        !artisan ||
        !artisanCard ||
        artisan.controller !== seat ||
        artisan.orientation !== "upright" ||
        (az !== "monde" && az !== "havreSac") ||
        artisanCard.mainType !== "Allié" ||
        !metierOf(artisan, artisanCard).includes(recette.metier)
      )
        return { error: `Artisan ${recette.metier} invalide (401.4a).` };
      // 418.6 — le RECYCLAGE : n cartes DISTINCTES de l'Élément, dans SA Défausse.
      const ids = intent.recycledIds ?? [];
      if (ids.length !== recette.n || new Set(ids).size !== ids.length)
        return {
          error: `Recette : recycler exactement ${recette.n} carte(s) ${recette.element} (418.6).`,
        };
      for (const rid of ids) {
        const rc = getCard(state.instances[rid]?.cardId ?? null);
        if (
          !state.seats[seat].defausse.includes(rid) ||
          rc?.stats?.niveau?.element !== recette.element
        )
          return {
            error: `Recette : carte recyclée invalide (${recette.element} de ta Défausse requis, 418.6).`,
          };
      }
      // 305.x — le PORTEUR (Équipement) : obligatoire et éligible.
      if (requiresBearer(card)) {
        if (!intent.bearerId)
          return { error: "Choisis le Porteur de cet Équipement (305.x)." };
        if (
          !eligibleBearers(ctx, seat, intent.equipmentId).includes(
            intent.bearerId,
          )
        )
          return { error: "Cible de Porteur invalide (305.x)." };
      }
      // ── Événements autoritatifs : coût de Recette PUIS mise en jeu. ────────
      const events: DraftEvent[] = [tap(seat, intent.artisanId)];
      for (const rid of ids) {
        const rInst = state.instances[rid];
        events.push(
          move(seat, {
            instanceId: rid,
            from: rInst.location,
            to: { zone: "pioche", owner: rInst.owner },
            position: { at: "bottom" },
            visibility: { faceDown: true, visibleTo: "none" },
            preservesIdentity: false,
          }),
        );
      }
      const dest = resolvedPlayDestination(ctx, seat, card, intent.destination);
      events.push(
        move(seat, {
          instanceId: intent.equipmentId,
          from: inst.location,
          to: dest,
          position: { at: "any" },
          visibility: { faceDown: false, visibleTo: "all" },
          preservesIdentity: false,
          orientationOnArrival: "upright",
        }),
      );
      if (requiresBearer(card) && intent.bearerId)
        events.push(attach(seat, intent.equipmentId, intent.bearerId));
      // MIROIR du tail PLAY_CARD (mal d'invocation + récences) — toute
      // évolution là-bas doit être répercutée ici.
      events.push(
        setCounter(
          seat,
          intent.equipmentId,
          "arrivedTurn",
          state.turn.number,
          true,
        ),
      );
      for (const other of Object.values(state.instances)) {
        if (other.instanceId === intent.equipmentId) continue;
        if (other.counters.tokens?.justAppeared)
          events.push(
            setCounter(seat, other.instanceId, "justAppeared", 0, true),
          );
        if (other.counters.tokens?.justAppearedFromDefausse)
          events.push(
            setCounter(
              seat,
              other.instanceId,
              "justAppearedFromDefausse",
              0,
              true,
            ),
          );
      }
      events.push(
        setCounter(seat, intent.equipmentId, "justAppeared", 1, true),
      );
      const craftHeroId = state.seats[seat].heroInstanceId;
      if (craftHeroId) {
        const kinds = new Set<string>(recentPlayKindsOf(card));
        for (const [kind, token] of Object.entries(RECENT_PLAY_TOKENS)) {
          events.push(
            setCounter(seat, craftHeroId, token, kinds.has(kind) ? 1 : 0, true),
          );
        }
      }
      events.push(
        say(
          seat,
          `${card.name} est fabriqué (Recette : ${recette.metier}, ${recette.n} carte(s) ${recette.element} recyclée(s), 418.6).`,
        ),
      );
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
        // Récence d'apparition (W74) — miroir du site PLAY_CARD ci-dessus.
        const movedCard = getCard(inst.cardId);
        if (movedCard && movedCard.mainType !== "Action") {
          for (const other of Object.values(state.instances)) {
            if (other.instanceId === intent.instanceId) continue;
            if (other.counters.tokens?.justAppeared)
              events.push(
                setCounter(seat, other.instanceId, "justAppeared", 0, true),
              );
            if (other.counters.tokens?.justAppearedFromDefausse)
              events.push(
                setCounter(
                  seat,
                  other.instanceId,
                  "justAppearedFromDefausse",
                  0,
                  true,
                ),
              );
          }
          events.push(
            setCounter(seat, intent.instanceId, "justAppeared", 1, true),
          );
          // PROVENANCE (W78 — Échappé des Glaces) : apparition DEPUIS LA
          // DÉFAUSSE (fromZone lue AVANT le move).
          if (fromZone === "defausse")
            events.push(
              setCounter(
                seat,
                intent.instanceId,
                "justAppearedFromDefausse",
                1,
                true,
              ),
            );
        }
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
      // DESTRUCTIONS DE FIN DE TOUR (Katsou : « détruisez … à la fin du tour ») :
      // AVANT la transition (avant la purge des jetons) — miroir de
      // gameStore.nextTurn. Les ruleEvents `destroyed` sont ignorés ici : le
      // serveur n'a pas de moteur d'effets (les déclenchés tournent côté client).
      const events = [
        ...turnEndDestroyEvents(ctx).events,
        ...nextTurnEvents(state),
      ];
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
      const newlyInclined = intent.attackers.filter(
        (id) => state.instances[id]?.orientation !== "tapped",
      );
      const events: DraftEvent[] = newlyInclined.map((id) => tap(seat, id));
      // « … qui vient de s'incliner » (Flèche) : réinitialise `justInclined` puis
      // le pose sur les nouveaux inclinés — miroir de gameStore.combatDeclareAttack.
      for (const inst of Object.values(state.instances))
        if (inst.counters.tokens?.justInclined)
          events.push(
            setCounter(seat, inst.instanceId, "justInclined", 0, true),
          );
      for (const id of newlyInclined)
        events.push(setCounter(seat, id, "justInclined", 1, true));
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
        // Agilité (glossaire) : un attaquant possédant Agilité ne peut être
        // bloqué que par un bloqueur possédant lui aussi Agilité.
        if (blockerBlockedByAgilite(ctx, blockerId, attackerId))
          return {
            error:
              "Bloqueur sans Agilité ne peut pas bloquer un attaquant possédant Agilité.",
          };
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
      // riposte, répartition Géant automatique) si strikes/ripostes/geantAssign
      // manquent OU sont invalides (whyBadGeantAssign) → robuste sans choix fins.
      const result = resolveCombat(
        ctx,
        {
          attackerSeat: c.attackerSeat,
          target: c.target,
          attackers: c.attackers,
          blocks: c.blocks,
          strikes: intent.strikes ?? c.strikes,
          ripostes: c.ripostes,
          geantAssign: intent.geantAssign,
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
