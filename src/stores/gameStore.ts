/**
 * gameStore — partie guidée hot-seat « façon MTGA, sauce Wakfu TCG ».
 * Réf. docs/superpowers/specs/2026-06-09-table-jeu-mtga-design.md.
 *
 * Machine à états du match : lobby → mulligan → playing → finished.
 * Vue par PERSPECTIVE (joueur actif) : la main adverse est cachée (dos). Un
 * écran de passation couvre la bascule de perspective entre deux joueurs.
 * Table ASSISTÉE : pioche/mulligan/tours automatisés, effets joués à la main.
 */
import { defineStore } from "pinia";
import { computed, ref, shallowRef, watch } from "vue";
import type { Card, Deck } from "@/types/cards";
import type {
  DraftEvent,
  GameIntent,
  GameOverPayload,
  GameState,
  PersistedEvent,
  Position,
  RedactedEvent,
  RedactedGameState,
  Seat,
  ZoneRef,
} from "@/game";
import {
  createGame,
  deriveState,
  drawTop,
  move,
  nextTurnEvents,
  otherSeat,
  redactStateFor,
  say,
  sequence,
  setCounter as setCounterVerb,
  incCounter as incCounterVerb,
  shuffle as shuffleVerb,
  undo as undoVerb,
} from "@/game";
import type { CombatTarget, RuleEvent, RulesCtx } from "@/game/rules";
import type { ForceStance } from "@/game/rules";
import {
  activeGlobalMods,
  attackPmBonus,
  cannotBlock,
  collectTriggeredEffects,
  combatKeywords,
  effectiveForce,
  eligibleAttackers,
  eligibleBlockers,
  eligibleTargets,
  equalityRescueEvents,
  forceValue,
  havreSacHasRoom,
  planCost,
  playDestination,
  playEffects,
  pmOf,
  printedEffects,
  resolveCombat,
  havreSacBanishEvents,
  resourceProducers,
  stateBasedDestroyEvents,
  tapPowers,
  turnStartEffects,
  victoryFromState,
  whyCannotDeclareAttack,
  whyCannotPlay,
} from "@/game/rules";
import { useCardStore } from "@/stores/cardStore";
import {
  createEffectEngine,
  matchesPickFilter,
} from "@/game/rules/effects/engine";

function rndSeed(): string {
  return Math.random().toString(36).slice(2);
}

export type MatchPhase = "lobby" | "mulligan" | "playing" | "finished";

/**
 * Phase de match DÉRIVÉE du journal (source de vérité en ligne, donc partagée
 * par les deux clients + reconstruite à la reconnexion) : pas de GAME_STARTED →
 * lobby ; les deux sièges ont un MULLIGAN_DONE → playing ; sinon → mulligan.
 */
function deriveMatchPhase(evs: PersistedEvent[]): MatchPhase {
  if (!evs.some((e) => e.type === "GAME_STARTED")) return "lobby";
  const done: Record<"A" | "B", boolean> = { A: false, B: false };
  for (const e of evs)
    if (e.type === "MULLIGAN_DONE")
      done[(e.payload as { seat: "A" | "B" }).seat] = true;
  return done.A && done.B ? "playing" : "mulligan";
}

/**
 * Transport du jeu EN LIGNE (modèle « clients de confiance » : le serveur
 * diffuse l'état COMPLET, l'info cachée est respectée à l'affichage via
 * `redactStateFor`). Injecté (gameClient en prod, mock en test) pour découpler
 * le store de Supabase.
 */
export interface OnlineTransport {
  submit(gameId: string, draft: DraftEvent): Promise<{ seq: number }>;
  /**
   * Soumet une INTENTION de haut niveau (contrat server-authoritative P2) : le
   * serveur valide tour → légalité → coût et applique les events. En cas de
   * refus, la promesse rejette avec la raison française (→ ruleError). Optionnel
   * le temps du câblage (PlayTableView) ; sans lui, on retombe sur le chemin
   * legacy `submit` (toujours gardé en tour côté serveur).
   */
  submitIntent?(gameId: string, intent: GameIntent): Promise<void>;
  /**
   * S'abonne au flux redacté du siège. `onPresence` (optionnel) reflète la
   * présence de l'AUTRE siège (sync/join/leave), pour la fenêtre de grâce sur
   * déconnexion adverse.
   */
  subscribe(
    gameId: string,
    seat: Seat,
    onEvent: (e: RedactedEvent) => void,
    onPresence?: (present: boolean) => void,
  ): () => void;
  pull(gameId: string, sinceSeq: number): Promise<RedactedEvent[]>;
  /**
   * Abandon : soumet l'intention CONCEDE ; le serveur écrit le GAME_OVER.
   * Optionnel le temps que le câblage `gameClient`/PlayTableView (T3/T6) le
   * fournisse — `concede()` route en `onlineTransport?.concede?.(…)`.
   */
  concede?(gameId: string): Promise<void>;
  /**
   * Réclamation de victoire sur déconnexion adverse : soumet l'intention
   * CLAIM_VICTORY ; le serveur écrit le GAME_OVER (raison `disconnect`). Le
   * client garde la fenêtre de grâce avant de l'autoriser.
   */
  claimVictory?(gameId: string): Promise<void>;
}

/** Fenêtre de grâce avant qu'une déconnexion adverse rende la victoire réclamable. */
export const DISCONNECT_GRACE_MS = 5 * 60 * 1000;

export interface LogLine {
  seq: number;
  actor: Seat | "system";
  text: string;
}

const PHASE_LABEL: Record<string, string> = {
  redressement: "Redressement",
  principale: "Principale",
  pioche: "Pioche",
  fin: "Fin",
};

export const useGameStore = defineStore("game", () => {
  // shallowRef : journal d'objets BRUTS (le reducer fait structuredClone, qui
  // échoue sur les proxies réactifs Vue). On réassigne toujours events.value.
  const events = shallowRef<PersistedEvent[]>([]);
  // Identités révélées progressivement (pioche/jeu) — monotone, survit à la
  // re-dérivation pure du journal redacté.
  const revealed = ref<Record<string, string>>({});
  const gameId = ref("local");
  // ── Jeu en ligne (clients de confiance) ─────────────────────────────────
  const online = ref(false);
  const mySeat = ref<Seat>("A");
  let onlineTransport: OnlineTransport | null = null;
  let onlineUnsub: (() => void) | null = null;
  let submitChain: Promise<unknown> = Promise.resolve();
  // Tampon des events reçus hors-ordre (en attente de seq contigus), + verrou
  // anti-pull-concurrent : le journal `events.value` reste STRICTEMENT contigu
  // depuis seq 1 pour que le fold pur `deriveState` reste correct.
  const pending = new Map<number, RedactedEvent>();
  let pulling = false;
  // ── Présence adverse + fenêtre de grâce sur déconnexion ──────────────────
  // `opponentPresent` reflète la présence Realtime de l'autre siège (true par
  // défaut : on ne pénalise pas avant d'avoir une info négative). Quand elle
  // tombe en pleine partie, on arme un minuteur ; à son terme la victoire
  // devient réclamable. Le retour de l'adversaire (présence true) annule tout.
  const opponentPresent = ref(true);
  const canClaimVictory = ref(false);
  let graceTimer: ReturnType<typeof setTimeout> | null = null;
  // Sécurité : n'armer la grâce QUE si la présence adverse a été observée
  // « vraie » au moins une fois. Sinon un canal de présence qui ne se connecte
  // jamais (mauvaise conf Realtime) ferait croire l'adversaire absent et
  // offrirait une victoire à réclamer à tort.
  let presenceSeen = false;
  // Combat-au-journal : a-t-on déjà vu un combat JOURNALISÉ (state.combat ≠ null) ?
  // Sert à `reconcileCombat` pour ne fermer le ref local QUE quand un vrai combat
  // se clôt (résolu/annulé) — et JAMAIS pendant l'assemblage local de l'attaquant
  // ou l'attente de confirmation de DECLARE_ATTACK (où state.combat est encore null).
  let hadJournaledCombat = false;

  function clearGraceTimer(): void {
    if (graceTimer) clearTimeout(graceTimer);
    graceTimer = null;
  }

  // ── État du match ────────────────────────────────────────────────────────
  const matchPhase = ref<MatchPhase>("lobby");
  const players = ref<Record<Seat, { name: string }>>({
    A: { name: "Joueur 1" },
    B: { name: "Joueur 2" },
  });
  const firstPlayer = ref<Seat>("A");
  /** Siège dont on affiche la vue (joueur actif / joueur en mulligan). */
  const perspective = ref<Seat>("A");
  /** Écran de passation actif (cache le plateau pendant la bascule). */
  const passPending = ref(false);
  const mulliganSeat = ref<Seat | null>(null);
  const mulliganDone = ref<Record<Seat, boolean>>({ A: false, B: false });
  const winner = ref<Seat | null>(null);

  // ── Dérivés moteur ───────────────────────────────────────────────────────
  const state = computed<GameState>(() => {
    const base = deriveState(events.value);
    const ids = Object.keys(revealed.value);
    if (!ids.length) return base;
    // `deriveState` est MÉMOÏSÉ : ne pas muter `base.instances[id]` (corromprait
    // le cache). On copie la map d'instances et on remplace les seules modifiées.
    const instances = { ...base.instances };
    for (const id of ids) {
      const inst = instances[id];
      if (inst && inst.cardId !== revealed.value[id]) {
        instances[id] = { ...inst, cardId: revealed.value[id] };
      }
    }
    return { ...base, instances };
  });
  const view = computed<RedactedGameState>(() =>
    redactStateFor(state.value, perspective.value),
  );
  const turn = computed(() => state.value.turn);
  // Libellé de la barre de tour : v1 replie les phases (redressement/pioche/fin
  // restent du ressort de J3 — fenêtre de réaction), mais on reflète les états
  // OBSERVABLES (mulligan, passation, fin) au lieu d'afficher toujours « Principale ».
  const phaseLabel = computed(() => {
    if (matchPhase.value === "mulligan") return "Mulligan";
    if (matchPhase.value === "finished") return "Partie terminée";
    if (passPending.value) return "Passation";
    return PHASE_LABEL[state.value.turn.phase] ?? state.value.turn.phase;
  });

  const opponent = computed<Seat>(() => otherSeat(perspective.value));
  const activeName = computed(() => players.value[turn.value.active].name);

  // ── Moteur de règles (R1) ────────────────────────────────────────────────
  const cardStore = useCardStore();
  /** Règles assistées (coûts, légalité, combat) ; off = table 100 % libre. */
  const assist = ref(true);
  /**
   * Automatisation des EFFETS de cartes (file DSL : onArrive/onPlay/onTap/
   * onTurnStart + déclencheurs). Distincte des règles : la v1 « à la
   * Cockatrice » joue RÈGLES ON / effets résolus À LA MAIN (false). Par défaut
   * ON (compat tests + futur mode assisté).
   */
  const assistEffects = ref(true);
  /** Dernier refus de coup, à afficher en toast. */
  const ruleError = ref<string | null>(null);
  /** Tour où l'attaque du joueur actif a été déclarée (1 attaque/tour, jeu LOCAL). */
  const attackedOnTurn = ref<number | null>(null);
  /**
   * Tour de la dernière attaque du siège (règle 1 attaque/tour, 603). En ligne
   * c'est le journal qui fait foi (`state.lastAttackTurn`, posé par le serveur à
   * la résolution) ; en local on suit le ref `attackedOnTurn`.
   */
  function attackedThisTurn(seat: Seat): number | null {
    return online.value
      ? (state.value.lastAttackTurn?.[seat] ?? null)
      : attackedOnTurn.value;
  }

  const cardIndex = computed(() => {
    const m = new Map<string, Card>();
    for (const c of cardStore.cards) m.set(c.id, c);
    return m;
  });
  function getCard(cardId: string | null): Card | null {
    return cardId ? (cardIndex.value.get(cardId) ?? null) : null;
  }
  function rulesCtx(): RulesCtx {
    return { state: state.value, getCard };
  }
  function rejectMove(reason: string): false {
    ruleError.value = reason;
    return false;
  }
  function clearRuleError(): void {
    ruleError.value = null;
  }

  /** Posture de combat courante (805.1) : bloqueurs déclarés, s'il y en a. */
  function currentStance(): ForceStance | undefined {
    const c = combat.value;
    if (!c) return undefined;
    const blockers = Object.keys(c.blocks).filter((b) =>
      c.attackers.includes(c.blocks[b]),
    );
    return blockers.length ? { blockers } : undefined;
  }

  /**
   * Fin de partie automatique d'après l'état (PV ≤ 0 / Niveau 3, 103.2).
   * S'applique MÊME en mode libre : la mort à 0 PV est fondamentale.
   * Égalité 103.3 : double 0 PV simultané → les deux Héros restent à 1 PV.
   */
  function checkVictory(): void {
    if (matchPhase.value !== "playing") return;
    // EN LIGNE : la victoire est LECTURE SEULE (deriveOnlineOutcome dérive l'issue
    // du journal partagé ; le serveur applique les destructions d'état / le
    // sauvetage d'égalité / l'auto-victoire). checkVictory ne doit RIEN dispatcher
    // ici — sinon il émettrait des drafts MOVE/INC_COUNTER refusés par l'autorité
    // (P4) et désynchroniserait. Garde-fou défensif (les appelants gardent déjà).
    if (online.value) return;
    // 1414 / 3019 — destructions d'état en point fixe (≤ 32 passes) AVANT
    // l'égalité et la victoire : Allié à Force effective 0 ou Dommages
    // létaux (la perte d'une aura peut tuer en cascade). Mode assisté
    // seulement : la table libre reste entièrement manuelle.
    if (assist.value) {
      for (let i = 0; i < 32; i++) {
        const sbd = stateBasedDestroyEvents(rulesCtx(), currentStance());
        if (!sbd.destroyed.length) break;
        dispatch(...sbd.events, ...sbd.log.map((l) => say("system", l)));
      }
      // 410.7 — Havre-Sac à 0 Résistance : banni, intérieur expulsé/détruit.
      const hsb = havreSacBanishEvents(rulesCtx());
      if (hsb.events.length)
        dispatch(...hsb.events, ...hsb.log.map((l) => say("system", l)));
    }
    const rescue = equalityRescueEvents(rulesCtx());
    if (rescue.length) {
      dispatch(
        ...rescue,
        say(
          "system",
          "Égalité (103.3) : les deux Héros restent en jeu avec 1 PV.",
        ),
      );
      return;
    }
    const w = victoryFromState(rulesCtx());
    if (w) {
      winner.value = w;
      matchPhase.value = "finished";
    }
  }

  function heroOf(seat: Seat) {
    const id = state.value.seats[seat].heroInstanceId;
    return id ? (state.value.instances[id] ?? null) : null;
  }
  /** PA effectifs = compteur + modificateurs temporaires (paMod, fin de tour). */
  function paOf(seat: Seat): number {
    const hero = heroOf(seat);
    const base = hero?.counters.pa ?? 6;
    const mod = hero?.counters.tokens?.paMod ?? 0;
    return Math.max(0, base + mod);
  }

  // ── Journal lisible ──────────────────────────────────────────────────────
  function describe(ev: PersistedEvent): string {
    const p = ev.payload as Record<string, unknown>;
    switch (ev.type) {
      case "GAME_STARTED":
        return "La partie commence.";
      case "SHUFFLE":
        return "mélange sa Pioche.";
      case "MOVE": {
        const from = (p.from as ZoneRef)?.zone;
        const to = (p.to as ZoneRef)?.zone;
        if (from === "pioche" && to === "main") return "pioche une carte.";
        if (from === "main" && to === "monde") return "joue une carte.";
        if (to === "defausse") return "défausse une carte.";
        if (to === "pioche") return "renvoie une carte dans la Pioche.";
        return `déplace une carte (${from} → ${to}).`;
      }
      case "SET_ORIENTATION":
        return (p.orientation as string) === "tapped"
          ? "incline une carte."
          : "redresse une carte.";
      case "SET_COUNTER":
      case "INC_COUNTER":
        return `ajuste « ${String(p.counter)} ».`;
      case "SET_PHASE":
        return `entame le tour ${String(p.number ?? "")}.`;
      case "UNDONE":
        return "annule un coup.";
      default:
        return ev.type;
    }
  }
  /** Événements techniques invisibles dans le journal. */
  function isInternalEvent(e: PersistedEvent): boolean {
    if (e.type !== "SET_COUNTER" && e.type !== "INC_COUNTER") return false;
    return (e.payload as { counter?: string }).counter === "arrivedTurn";
  }
  const log = computed<LogLine[]>(() =>
    events.value
      .filter((e) => !isInternalEvent(e))
      .map((e) =>
        e.type === "SAID"
          ? {
              seq: e.seq,
              actor: e.actor,
              text: String((e.payload as { text?: string }).text ?? ""),
            }
          : {
              seq: e.seq,
              actor: e.actor,
              text: `${labelOf(e.actor)} ${describe(e)}`,
            },
      ),
  );
  function labelOf(actor: Seat | "system"): string {
    return actor === "system" ? "Table" : players.value[actor].name;
  }

  // ── Dispatch bas niveau (local : on est l'autorité) ──────────────────────
  function dispatch(...drafts: DraftEvent[]): void {
    if (!drafts.length) return;
    // En ligne : on SOUMET les intentions au serveur, dans l'ordre, sans
    // appliquer localement — l'état avance à la réception des echos diffusés.
    if (online.value && onlineTransport) {
      const t = onlineTransport;
      const id = gameId.value;
      for (const d of drafts) {
        submitChain = submitChain
          .then(() => t.submit(id, d))
          .catch((e) => {
            ruleError.value = `Réseau : ${String(e)}`;
          });
      }
      return;
    }
    events.value = [
      ...events.value,
      ...sequence(drafts, gameId.value, state.value.seq + 1),
    ];
  }

  /**
   * Soumet une INTENTION au serveur (autorité). Sérialisé sur `submitChain` ;
   * un refus revient en français → `ruleError`. Renvoie `true` si soumis
   * (l'appelant s'arrête là), `false` hors-ligne / sans transport d'intentions.
   * Sans garde de combat → utilisé aussi par les intentions de COMBAT (P3).
   */
  function pushIntent(intent: GameIntent): boolean {
    if (!online.value || !onlineTransport?.submitIntent) return false;
    ruleError.value = null;
    const t = onlineTransport;
    const id = gameId.value;
    submitChain = submitChain
      .then(() => t.submitIntent!(id, intent))
      .catch((e) => {
        ruleError.value = (e as Error)?.message ?? String(e);
      });
    return true;
  }

  /**
   * Route une action de JEU (non-combat) en ligne via une intention (P2). Comme
   * `pushIntent` mais NE soumet PAS pendant un combat : les manipulations de
   * plateau hors-combat passent par là ; le combat a ses propres intentions
   * (DECLARE_ATTACK/BLOCK/RESOLVE) soumises via `pushIntent`.
   */
  function tryIntent(intent: GameIntent): boolean {
    if (combat.value) return false;
    return pushIntent(intent);
  }

  function lastSeq(): number {
    return events.value.length ? events.value[events.value.length - 1].seq : 0;
  }

  /**
   * Issue du match EN LIGNE, dérivée du flux PARTAGÉ (donc identique sur les deux
   * clients + reconstruite à la reconnexion). Tant que la partie n'est pas finie,
   * la phase suit le journal (deriveMatchPhase) ; puis la mort d'un Héros
   * (PV ≤ 0 / Niveau 3, 103.2) bascule en « finished ».
   *
   * Lecture SEULE : contrairement au checkVictory local (assisté), on ne dispatch
   * RIEN — destructions d'état (1414/3019) et sauvetage d'égalité (103.3) restent
   * manuels en ligne (« façon Cockatrice »), et auto-soumettre ferait soumettre
   * les MÊMES events par les deux clients. On déduit donc le vainqueur du seul
   * état partagé : pas de fausse fin tant que les PV ne sont pas tombés à 0.
   *
   * « finished » est TERMINAL : une fois atteint (victoire OU abandon, cf.
   * `concede`) on ne re-dérive plus, pour ne pas « dé-finir » la partie sur un
   * echo ultérieur (un SAID, etc. ramènerait sinon deriveMatchPhase à « playing »).
   */
  function deriveOnlineOutcome(): void {
    // Premier joueur = tirage serveur (coin flip dans join_game), porté par
    // l'état initial GAME_STARTED. On le synchronise sur le ref, sinon il reste
    // à "A" en ligne et fausse la règle « 1re activation au tour 2 ».
    const started = events.value.find((e) => e.type === "GAME_STARTED");
    if (started) {
      const t = (
        started.payload as {
          state?: { turn?: { active?: Seat; firstPlayer?: Seat } };
        }
      ).state?.turn;
      const fp = t?.firstPlayer ?? t?.active;
      if (fp) firstPlayer.value = fp;
    }
    if (matchPhase.value === "finished") return;
    // Fin AUTORITATIVE serveur : un GAME_OVER (concession/déconnexion/défaite,
    // émis par submit_event) prime sur la dérivation d'état. Il porte le
    // vainqueur (« draw » → match nul, on ne désigne personne) et fige la
    // partie sur les DEUX clients, y compris à la reconnexion.
    const over = events.value.find((e) => e.type === "GAME_OVER");
    if (over) {
      matchPhase.value = "finished";
      const w = (over.payload as GameOverPayload).winner;
      if (w !== "draw") winner.value = w;
      // Partie finie → la fenêtre de réclamation de victoire n'a plus lieu d'être
      // (évite qu'un minuteur de grâce armé déclenche un canClaimVictory tardif).
      clearGraceTimer();
      canClaimVictory.value = false;
      return;
    }
    matchPhase.value = deriveMatchPhase(events.value);
    if (matchPhase.value !== "playing") return;
    const w = victoryFromState(rulesCtx());
    if (w) {
      winner.value = w;
      matchPhase.value = "finished";
      clearGraceTimer();
      canClaimVictory.value = false;
    }
  }

  /** Applique un event diffusé/pullé : contigu par seq, hors-ordre mis en tampon. */
  function applyServerEvent(ev: RedactedEvent): void {
    if (ev.reveals) revealed.value = { ...revealed.value, ...ev.reveals }; // monotone
    if (ev.seq <= lastSeq()) return; // doublon / déjà appliqué
    pending.set(ev.seq, ev);
    let next = lastSeq() + 1;
    const toAppend: RedactedEvent[] = [];
    while (pending.has(next)) {
      toAppend.push(pending.get(next)!);
      pending.delete(next);
      next++;
    }
    if (toAppend.length) events.value = [...events.value, ...toAppend];
    // En ligne, phase ET fin de partie suivent le journal (main de départ →
    // mulligan → jeu → fin) : les deux clients les dérivent du même flux.
    if (online.value) {
      deriveOnlineOutcome();
      reconcileCombat();
    }
    if (pending.size && !pulling) void resyncFrom(lastSeq()); // trou → combler
  }

  /**
   * Combat-au-journal (P3) : aligne le ref de combat LOCAL sur `state.combat`
   * diffusé. Chaque siège conserve ses sélections EN COURS d'assemblage (curseurs
   * UI), et prend du serveur ce que l'AUTRE joueur contrôle : l'attaquant reçoit
   * les blocages/ripostes (du défenseur), le défenseur reçoit attaquants/cible.
   * Combat clos côté serveur (`null`) → on ferme le ref local.
   */
  function reconcileCombat(): void {
    if (!online.value) return;
    const sc = state.value.combat ?? null;
    if (!sc) {
      // On ne ferme le ref local QUE si un combat avait été JOURNALISÉ (donc
      // résolu/annulé côté serveur). Pendant l'assemblage local de l'attaquant OU
      // l'attente de confirmation de DECLARE_ATTACK (state.combat encore null), on
      // préserve la sélection : un echo sans rapport (SAID/présence) ou une course
      // ne doit pas l'effacer (sinon perte de la déclaration en cours).
      if (hadJournaledCombat) {
        combat.value = null;
        hadJournaledCombat = false;
      }
      return;
    }
    hadJournaledCombat = true;
    const me = mySeat.value;
    const local = combat.value;
    if (!local) {
      // Combat ouvert pour ce client (typiquement le défenseur) : pose la base.
      combat.value = {
        step: "blockers",
        target: sc.target,
        attackers: [...sc.attackers],
        blocks: { ...sc.blocks },
        strikes: { ...(sc.strikes ?? {}) },
        strikeFor: null,
        ripostes: { ...(sc.ripostes ?? {}) },
        riposteFrom: null,
        riposteCandidates: [],
        pendingBlocker: null,
        reactingSeat: sc.reactingSeat,
      };
      return;
    }
    if (me === sc.attackerSeat) {
      // Attaquant : autorité serveur sur blocages/ripostes (choix du défenseur).
      // `pendingBlocker` (curseur du défenseur) n'a aucun sens ici → réinitialisé.
      combat.value = {
        ...local,
        blocks: { ...sc.blocks },
        ripostes: { ...(sc.ripostes ?? {}) },
        pendingBlocker: null,
      };
    } else {
      // Défenseur : autorité serveur sur attaquants/cible (choix de l'attaquant).
      // On ne réinitialise `pendingBlocker` que si l'ensemble des attaquants a
      // RÉELLEMENT changé (curseur devenu caduc) — sinon on préserve l'assemblage
      // en cours du défenseur (un echo sans rapport ne doit pas le vider).
      const attackersChanged =
        local.attackers.length !== sc.attackers.length ||
        local.attackers.some((a, i) => a !== sc.attackers[i]);
      combat.value = {
        ...local,
        target: sc.target,
        attackers: [...sc.attackers],
        reactingSeat: sc.reactingSeat,
        pendingBlocker: attackersChanged ? null : local.pendingBlocker,
      };
    }
  }

  /** Retire le journal redacté depuis `sinceSeq` et l'applique (combler trous / connexion). */
  async function resyncFrom(sinceSeq: number): Promise<void> {
    if (!onlineTransport?.pull || pulling) return;
    pulling = true;
    try {
      const evs = await onlineTransport.pull(gameId.value, sinceSeq);
      for (const e of evs) applyServerEvent(e);
    } catch (e) {
      // Rattrapage BEST-EFFORT : un échec n'est pas fatal et ne doit PAS alarmer
      // l'utilisateur. Cas normal côté joueur qui rejoint : le pull de connexion
      // part AVANT que join_game l'enregistre dans game_players → 403 « pas encore
      // joueur ». La diffusion temps réel + les re-pulls sur trou couvrent. On
      // loggue sans toucher `ruleError` (réservé aux refus de coup réels).
      console.warn("[resync] pull échoué (non bloquant) :", e);
    } finally {
      pulling = false;
    }
  }

  /**
   * Connecte la table à une partie en ligne, au siège `seat`. `assisted` est le
   * mode de règles PARTAGÉ (choisi par le créateur, plumb depuis findGameByCode/
   * findMyActiveGame) : les deux clients tournent dans le même mode pour le
   * match. `assistEffects` reste OFF en ligne (automatisation séparée, risque de
   * double-soumission).
   */
  function connectOnline(
    id: string,
    seat: Seat,
    transport: OnlineTransport,
    assisted = false,
  ): void {
    disconnectOnline();
    online.value = true;
    assist.value = assisted; // mode de règles partagé (choisi à la création)
    gameId.value = id;
    mySeat.value = seat;
    perspective.value = seat; // vue figée sur SON siège (info cachée à l'écran)
    events.value = [];
    revealed.value = {};
    // Dérivée du journal (vide ici → "lobby") ; le pull de connexion la fera
    // évoluer vers mulligan/playing via applyServerEvent.
    matchPhase.value = deriveMatchPhase(events.value);
    onlineTransport = transport;
    submitChain = Promise.resolve();
    pending.clear();
    pulling = false;
    ruleError.value = null; // repartir sans message d'erreur résiduel
    // Présence : on repart d'un adversaire supposé présent, grâce désarmée.
    clearGraceTimer();
    opponentPresent.value = true;
    canClaimVictory.value = false;
    presenceSeen = false;
    hadJournaledCombat = false;
    combat.value = null;
    onlineUnsub = transport.subscribe(
      id,
      seat,
      applyServerEvent,
      onOpponentPresence,
    );
    void resyncFrom(0); // rattrape tout event émis avant que l'abonnement soit vivant
  }

  function disconnectOnline(): void {
    onlineUnsub?.();
    onlineUnsub = null;
    onlineTransport = null;
    online.value = false;
    assist.value = true;
    events.value = [];
    pending.clear();
    pulling = false;
    revealed.value = {};
    gameId.value = "local";
    matchPhase.value = "lobby";
    // Présence/grâce : minuteur coupé (test-safe) + état réinitialisé.
    clearGraceTimer();
    opponentPresent.value = true;
    canClaimVictory.value = false;
    presenceSeen = false;
    hadJournaledCombat = false;
    combat.value = null;
  }

  // ── Cycle de match ───────────────────────────────────────────────────────
  function initEngine(deckA: Deck, deckB: Deck, first: Seat): void {
    gameId.value = "local";
    winner.value = null;
    const { events: evs } = createGame(
      "local",
      { A: deckA, B: deckB },
      { firstPlayer: first, seedA: rndSeed(), seedB: rndSeed() },
    );
    events.value = evs;
  }

  /** Démarre une partie complète (lobby → mulligan). Premier joueur = pile/face. */
  function startMatch(
    deckA: Deck,
    deckB: Deck,
    opts: { nameA?: string; nameB?: string; first?: Seat } = {},
  ): void {
    const first = opts.first ?? (Math.random() < 0.5 ? "A" : "B");
    firstPlayer.value = first;
    players.value = {
      A: { name: opts.nameA?.trim() || "Joueur 1" },
      B: { name: opts.nameB?.trim() || "Joueur 2" },
    };
    initEngine(deckA, deckB, first);
    // Main de départ : chaque joueur pioche un nombre de cartes = ses PA.
    draw("A", paOf("A"));
    draw("B", paOf("B"));
    mulliganDone.value = { A: false, B: false };
    mulliganSeat.value = first;
    perspective.value = first;
    matchPhase.value = "mulligan";
    passPending.value = true;
    combat.value = null;
    attackedOnTurn.value = null;
    ruleError.value = null;
    engine.reset();
    turnStartFiredOn.value = null;
  }

  /** Démarrage direct en partie (tests / bac à sable rapide). */
  function startSandbox(deckA: Deck, deckB: Deck, first: Seat = "A"): void {
    firstPlayer.value = first;
    players.value = { A: { name: "Joueur 1" }, B: { name: "Joueur 2" } };
    initEngine(deckA, deckB, first);
    mulliganSeat.value = null;
    mulliganDone.value = { A: true, B: true };
    perspective.value = first;
    matchPhase.value = "playing";
    passPending.value = false;
    // Hygiène d'état : repartir d'un combat/effets/victoire vierges, sinon une
    // partie précédente fuit (ex. `attackedOnTurn` bloquant « 1 attaque/tour »).
    winner.value = null;
    combat.value = null;
    attackedOnTurn.value = null;
    ruleError.value = null;
    engine.reset();
    turnStartFiredOn.value = null;
  }

  /** Recycle toute la main du joueur, re-mélange, re-pioche (−1). */
  function mulligan(seat: Seat): void {
    const hand = [...state.value.seats[seat].main];
    const target = Math.max(0, hand.length - 1);
    for (const id of hand)
      moveTo(id, { zone: "pioche", owner: seat }, { at: "top" });
    shufflePioche(seat);
    if (target) draw(seat, target);
  }

  /** Le joueur garde sa main → joueur suivant, ou début de partie. */
  function keepHand(): void {
    const seat = mulliganSeat.value;
    if (!seat) return;
    mulliganDone.value = { ...mulliganDone.value, [seat]: true };
    const other = otherSeat(seat);
    if (!mulliganDone.value[other]) {
      mulliganSeat.value = other;
      perspective.value = other;
      passPending.value = true;
    } else {
      mulliganSeat.value = null;
      matchPhase.value = "playing";
      perspective.value = firstPlayer.value;
      passPending.value = true; // passe l'appareil au premier joueur
    }
  }

  /** Révèle le plateau après l'écran de passation. */
  /** Dernier tour dont les effets « Au début de votre tour » ont tiré. */
  const turnStartFiredOn = ref<number | null>(null);

  function reveal(): void {
    passPending.value = false;
    // En réaction, le hand-off est dans le MÊME tour : fireTurnStartEffects
    // no-ope déjà (assistEffects off en v1, et garde turnStartFiredOn).
    fireTurnStartEffects();
  }

  /** Déclenche les effets onTurnStart des cartes en jeu du joueur actif (602). */
  function fireTurnStartEffects(): void {
    if (!assistEffects.value || matchPhase.value !== "playing") return;
    const turnNo = state.value.turn.number;
    if (turnStartFiredOn.value === turnNo) return;
    turnStartFiredOn.value = turnNo;
    const seat = state.value.turn.active;
    for (const inst of Object.values(state.value.instances)) {
      if (inst.controller !== seat) continue;
      const zone = inst.location.zone;
      if (zone !== "monde" && zone !== "havreSac") continue;
      const card = getCard(inst.cardId);
      if (!card) continue;
      for (const atom of turnStartEffects(card)) {
        if (atom.optional || atom.orElse) {
          // 804.8 : un coût d'entretien IMPAYABLE ne laisse pas le choix —
          // la branche « ou détruisez » s'applique d'office (ex. officiel :
          // Chacha Noir sans carte [Feu] dans la Défausse).
          const first = atom.ops[0];
          if (
            atom.orElse === "destroySelf" &&
            first?.op === "recycleFromDiscard" &&
            !state.value.seats[seat].defausse.some((id) =>
              matchesPickFilter(
                getCard(state.value.instances[id]?.cardId ?? null),
                first.element ? { element: first.element } : undefined,
              ),
            )
          ) {
            dispatch(
              say(
                seat,
                `${card.name} : entretien impayable (rien à recycler${first.element ? ` en ${first.element}` : ""}) — détruit (804.8).`,
              ),
            );
            engine.enqueueEffect({
              seat,
              cardName: card.name,
              ops: [{ op: "destroySelf" }],
              sourceId: inst.instanceId,
            });
            continue;
          }
          engine.effectChoices.value = [
            ...engine.effectChoices.value,
            {
              seat,
              cardName: card.name,
              text: atom.text,
              ops: atom.ops,
              declineOps:
                atom.orElse === "destroySelf"
                  ? [{ op: "destroySelf" }]
                  : undefined,
              sourceId: inst.instanceId,
            },
          ];
          continue;
        }
        dispatch(
          say(seat, `Effet de début de tour — ${card.name} : « ${atom.text} »`),
        );
        engine.enqueueEffect({
          seat,
          cardName: card.name,
          ops: atom.ops,
          sourceId: inst.instanceId,
        });
      }
    }
  }

  /** Finit le tour : pioche jusqu'aux PA (règle Wakfu) puis passe la main. */
  function endTurn(): void {
    const active = state.value.turn.active;
    // En ligne, seul le joueur DONT c'est le tour peut le finir (en local
    // hot-seat, la perspective suit le joueur actif, donc la garde est neutre).
    if (online.value && active !== mySeat.value) {
      rejectMove("Ce n'est pas ton tour.");
      return;
    }
    // 4873 : on ne passe pas la main avec un excédent — défausse d'abord
    if (assist.value && state.value.seats[active].main.length > paOf(active)) {
      engine.enforceHandLimit(active);
      rejectMove("Main pleine : défausse l'excédent avant de finir le tour.");
      return;
    }
    combat.value = null;
    // EN LIGNE (P2) : une seule intention END_TURN — le serveur pioche jusqu'aux
    // PA, passe la main, redresse/efface les dégâts du joueur entrant et purge
    // les jetons de tour (resolveIntent → nextTurnEvents). On n'avance RIEN
    // localement : l'état suit les echos diffusés.
    if (tryIntent({ kind: "END_TURN" })) return;
    const need = paOf(active) - state.value.seats[active].main.length;
    if (need > 0) draw(active, need);
    nextTurn();
    // En LOCAL (hot-seat) : on bascule la perspective vers le nouveau joueur
    // actif + écran de passation. En ligne (repli sans transport d'intentions),
    // le tour avance via l'echo SET_PHASE — pas de bascule de perspective.
    if (!online.value) {
      perspective.value = state.value.turn.active;
      passPending.value = true;
    }
  }

  function concede(seat: Seat): void {
    // En ligne : on soumet l'intention CONCEDE ; le serveur force le perdant =
    // siège authentifié, écrit le GAME_OVER terminal et le diffuse → la fin
    // arrive par echo (deriveOnlineOutcome) sur les DEUX clients.
    if (online.value) {
      void onlineTransport?.concede?.(gameId.value);
      return;
    }
    dispatch(say(seat, `${players.value[seat].name} abandonne la partie.`));
    winner.value = otherSeat(seat);
    matchPhase.value = "finished";
  }

  /**
   * Réception d'un changement de présence adverse (transport Realtime). En
   * pleine partie, la disparition de l'adversaire arme la fenêtre de grâce :
   * au terme du minuteur, `canClaimVictory` passe à true. Son retour annule
   * tout (minuteur + drapeau). Hors « playing », on garde juste l'état brut.
   */
  function onOpponentPresence(present: boolean): void {
    opponentPresent.value = present;
    if (present) {
      presenceSeen = true;
      clearGraceTimer();
      canClaimVictory.value = false;
      return;
    }
    if (matchPhase.value !== "playing") return;
    if (!presenceSeen) return; // jamais vu connecté → ne pas armer (fail-safe)
    if (graceTimer) return; // minuteur déjà armé
    graceTimer = setTimeout(() => {
      graceTimer = null;
      // Toujours valable : l'adversaire est resté absent et la partie n'est
      // pas finie entre-temps (concession/déco déjà résolue ailleurs).
      if (!opponentPresent.value && matchPhase.value === "playing") {
        canClaimVictory.value = true;
      }
    }, DISCONNECT_GRACE_MS);
  }

  /**
   * Réclame la victoire après expiration de la grâce (déconnexion adverse) :
   * soumet l'intention CLAIM_VICTORY ; le serveur écrit le GAME_OVER terminal
   * (raison `disconnect`) qui revient par echo et fige la partie.
   */
  function claimVictory(): void {
    // Garde matchPhase : ne jamais réclamer sur une partie déjà finie (course
    // entre l'expiration de la grâce et un GAME_OVER reçu juste après).
    if (!online.value || !canClaimVictory.value) return;
    if (matchPhase.value !== "playing") return;
    void onlineTransport?.claimVictory?.(gameId.value);
  }

  function quitMatch(): void {
    // En ligne : quitter = abandonner (forfait) puis se déconnecter proprement.
    // La concession part au serveur ; on coupe la table ensuite.
    if (online.value) {
      concede(mySeat.value);
      disconnectOnline();
      return;
    }
    events.value = [];
    matchPhase.value = "lobby";
    passPending.value = false;
    mulliganSeat.value = null;
    winner.value = null;
    combat.value = null;
    attackedOnTurn.value = null;
    ruleError.value = null;
    engine.reset();
    turnStartFiredOn.value = null;
  }

  // ── Verbes exposés au plateau ─────────────────────────────────────────────
  /** 507.5 — Pioche vide : la Défausse est remélangée pour former une nouvelle Pioche. */
  function reshuffleDiscardIntoDeck(seat: Seat): void {
    const discard = [...state.value.seats[seat].defausse];
    if (!discard.length) return;
    for (const id of discard)
      moveTo(id, { zone: "pioche", owner: seat }, { at: "top" });
    shufflePioche(seat);
    dispatch(
      say(
        seat,
        `Pioche vide : la Défausse (${discard.length}) est remélangée (507.5).`,
      ),
    );
  }

  function draw(seat: Seat = perspective.value, n = 1): void {
    for (let i = 0; i < n; i++) {
      // 507.5 : si la Pioche est vide, remélanger la Défausse avant de piocher.
      // (Pas de défaite par deck-out dans Wakfu : on s'arrête si tout est vide.)
      if (!state.value.seats[seat].pioche.length) {
        if (!state.value.seats[seat].defausse.length) break;
        reshuffleDiscardIntoDeck(seat);
      }
      if (!state.value.seats[seat].pioche.length) break;
      dispatch(drawTop(state.value, seat));
    }
    engine.enforceHandLimit(seat);
  }

  function moveTo(
    instanceId: string,
    to: ZoneRef,
    position: Position = { at: "any" },
  ): void {
    const inst = state.value.instances[instanceId];
    if (!inst) return;
    // EN LIGNE (P2) : intention MOVE_CARD — le serveur impose le contrôle de tour
    // et applique le déplacement (échange Monde↔Havre-Sac préservé, jeton
    // d'arrivée à l'entrée en jeu). Hors combat uniquement (tryIntent l'exclut).
    if (tryIntent({ kind: "MOVE_CARD", instanceId, to, position })) return;
    // Règles assistées : pendant la phase de jeu, seul le joueur ACTIF manipule
    // le plateau (sauf fenêtre de réaction en combat). Sans ça, n'importe quel
    // MOVE hors « main → Monde » (ex. Havre-Sac ↔ Monde) contournait le contrôle
    // de tour que `playFromHand` applique déjà. (Le mode manuel = table libre.)
    if (assist.value && matchPhase.value === "playing") {
      const actor = perspective.value;
      const reacting = combat.value?.reactingSeat === actor;
      if (!reacting && state.value.turn.active !== actor) {
        rejectMove("Ce n'est pas votre tour.");
        return;
      }
    }
    // 4806 : un déplacement vers un Havre-Sac plein « n'a pas lieu »
    if (
      assist.value &&
      to.zone === "havreSac" &&
      inst.location.zone !== "havreSac"
    ) {
      const card = getCard(inst.cardId);
      const counted =
        card &&
        (card.mainType === "Héros" ||
          card.mainType === "Allié" ||
          card.mainType === "Salle");
      if (counted && !havreSacHasRoom(rulesCtx(), to.owner)) {
        rejectMove("Le Havre-Sac est plein (Taille atteinte).");
        return;
      }
    }
    const toHidden = to.zone === "pioche";
    const toPublic =
      to.zone === "monde" ||
      to.zone === "havreSac" ||
      to.zone === "defausse" ||
      to.zone === "fileAttente" ||
      to.zone === "exil";
    const swap =
      (inst.location.zone === "monde" && to.zone === "havreSac") ||
      (inst.location.zone === "havreSac" && to.zone === "monde");
    const drafts: DraftEvent[] = [
      move(inst.controller, {
        instanceId,
        from: inst.location,
        to,
        position,
        visibility: toHidden
          ? { faceDown: true, visibleTo: "none" }
          : toPublic
            ? { faceDown: false, visibleTo: "all" }
            : { faceDown: false, visibleTo: [inst.owner] },
        preservesIdentity: swap,
        orientationOnArrival:
          to.zone === "monde" || to.zone === "havreSac" ? "upright" : null,
      }),
    ];
    // entrée en jeu (hors échange Monde↔Havre-Sac) : tour d'arrivée, pour le
    // mal d'invocation (1821). Préservé par l'échange qui garde les compteurs.
    const entersPlay = (to.zone === "monde" || to.zone === "havreSac") && !swap;
    if (entersPlay) {
      drafts.push(
        setCounterVerb(
          inst.controller,
          instanceId,
          "arrivedTurn",
          state.value.turn.number,
          true,
        ),
      );
    }
    dispatch(...drafts);
    // un déplacement peut casser une aura / vider une main (Vrombyx) :
    // destructions d'état + fin de partie re-vérifiées (1414/3019)
    checkVictory();
  }

  /**
   * Jouer une carte de sa main (mode assisté) : légalité, inclinaison
   * automatique des producteurs de Ressources, arrivée dans la bonne zone.
   * Retourne `false` (avec `ruleError`) si le coup est refusé.
   */
  function playFromHand(instanceId: string): boolean {
    const seat = perspective.value;
    // EN LIGNE (P2) : intention PLAY_CARD — le serveur valide tour/zone/coût et
    // choisit la destination (Salle → Havre-Sac), incline les producteurs, pose
    // le jeton d'arrivée. Un refus revient en français via ruleError.
    if (tryIntent({ kind: "PLAY_CARD", instanceId })) return true;
    if (!assist.value) {
      moveTo(instanceId, { zone: "monde" });
      return true;
    }
    const ctx = rulesCtx();
    // 706.5 — en fenêtre de réaction, ce siège joue hors de son tour.
    const reaction = combat.value?.reactingSeat === seat;
    const reason = whyCannotPlay(ctx, seat, instanceId, reaction);
    if (reason) return rejectMove(reason);
    const inst = state.value.instances[instanceId];
    const card = getCard(inst?.cardId ?? null);
    if (!inst || !card) return rejectMove("Carte inconnue.");
    const plan = planCost(ctx, seat, card);
    if (!plan.ok) return rejectMove(plan.reason);

    const drafts: DraftEvent[] = plan.producers.map((id) => ({
      actor: seat,
      type: "SET_ORIENTATION" as const,
      payload: { instanceId: id, orientation: "tapped" },
    }));
    // Action dont TOUS les effets sont compilés : elle se résout puis va en
    // défausse (302.1). Un seul effet incompris (ex. restriction de jeu
    // « Ne jouez cette carte que… ») → la carte reste jouée manuellement.
    const effectsCount = printedEffects(card).length;
    const playAtoms =
      assistEffects.value && card.mainType === "Action"
        ? playEffects(card)
        : [];
    const actionAtoms = playAtoms.length === effectsCount ? playAtoms : [];
    const dest: ZoneRef = actionAtoms.length
      ? { zone: "defausse", owner: seat }
      : playDestination(card, seat);
    drafts.push(
      move(seat, {
        instanceId,
        from: inst.location,
        to: dest,
        position: actionAtoms.length ? { at: "top" } : { at: "any" },
        visibility: { faceDown: false, visibleTo: "all" },
        preservesIdentity: false,
        orientationOnArrival: actionAtoms.length ? null : "upright",
      }),
    );
    if (!actionAtoms.length) {
      drafts.push(
        setCounterVerb(
          seat,
          instanceId,
          "arrivedTurn",
          state.value.turn.number,
          true,
        ),
      );
    }
    if (plan.producers.length) {
      // 2342 : le Havre-Sac doublé apparaît deux fois dans plan.producers (même
      // instanceId, tap idempotent) → compter les cartes RÉELLEMENT inclinées.
      const tappedCount = new Set(plan.producers).size;
      drafts.push(
        say(
          seat,
          `${players.value[seat].name} incline ${tappedCount} carte(s) pour payer ${card.name}.`,
        ),
      );
    }
    // 2342 : le bonus de doublement du Havre-Sac est à USAGE UNIQUE par tour —
    // dès qu'il est incliné pour payer, on pose un jeton pour qu'il ne se
    // redouble pas s'il est redressé à la main ensuite (RES-1).
    const sacId = state.value.seats[seat].havreSacInstanceId;
    if (
      sacId &&
      seat !== firstPlayer.value &&
      state.value.turn.number === 2 &&
      plan.producers.includes(sacId)
    ) {
      drafts.push(setCounterVerb(seat, sacId, "sacBonusUsed", 1, true));
    }
    dispatch(...drafts);
    if (actionAtoms.length) {
      // actionAtoms n'est rempli que si TOUS les effets imprimés se compilent
      // (playAtoms.length === effectsCount) : il n'y a donc aucun effet manuel
      // à signaler ici. Une Action partielle/non couverte tombe dans le `else`
      // → queueArrivalEffects, qui pousse les rappels.
      for (const atom of actionAtoms) {
        dispatch(say(seat, `Action résolue — ${card.name} : « ${atom.text} »`));
        engine.enqueueEffect({ seat, cardName: card.name, ops: atom.ops });
      }
    } else {
      engine.queueArrivalEffects(seat, card, instanceId);
    }
    return true;
  }

  /**
   * Moteur de résolution d'effets : possède la file et le modèle d'interaction
   * (ciblage / pile / choix). Les dépendances couplées au store sont injectées
   * ici ; le reste vit dans `src/game/rules/effects/engine.ts`.
   */
  const engine = createEffectEngine({
    getState: () => state.value,
    rulesCtx,
    getCard,
    isAssist: () => assist.value,
    isAssistEffects: () => assistEffects.value,
    getMatchPhase: () => matchPhase.value,
    playerName: (s) => players.value[s].name,
    paOf,
    dispatch,
    moveTo,
    shufflePioche,
    checkVictory,
    draw,
    adjustCounter,
    onMatchWon: (s) => {
      winner.value = s;
      matchPhase.value = "finished";
    },
  });

  /**
   * Active un pouvoir à inclinaison compilé : incline la carte puis exécute
   * ses ops. Retourne `false` (avec raison) si l'activation est illégale.
   */
  function activateTapPower(instanceId: string): boolean {
    if (!assistEffects.value) return false;
    const inst = state.value.instances[instanceId];
    const card = getCard(inst?.cardId ?? null);
    if (!inst || !card) return rejectMove("Carte inconnue.");
    const atoms = tapPowers(card);
    if (!atoms.length)
      return rejectMove("Pas de pouvoir à inclinaison automatisé.");
    if (inst.controller !== perspective.value)
      return rejectMove("Vous ne contrôlez pas cette carte.");
    if (inst.location.zone !== "monde" && inst.location.zone !== "havreSac")
      return rejectMove("La carte doit être en jeu.");
    if (inst.orientation !== "upright")
      return rejectMove("La carte est déjà inclinée.");
    if (state.value.turn.active !== perspective.value)
      return rejectMove("Ce n'est pas votre tour.");
    const seat = perspective.value;
    const atom = atoms[0];
    if (atom.cost === "sacrificeSelf") {
      // « Détruisez [cette carte] : … » — le sacrifice remplace l'inclinaison
      dispatch(
        move(seat, {
          instanceId,
          from: inst.location,
          to: { zone: "defausse", owner: inst.owner },
          position: { at: "top" },
          visibility: { faceDown: false, visibleTo: "all" },
          preservesIdentity: false,
        }),
        say(
          seat,
          `Pouvoir activé (sacrifice) — ${card.name} : « ${atom.text} »`,
        ),
      );
    } else {
      dispatch(
        {
          actor: seat,
          type: "SET_ORIENTATION",
          payload: { instanceId, orientation: "tapped" },
        },
        say(seat, `Pouvoir activé — ${card.name} : « ${atom.text} »`),
      );
    }
    engine.enqueueEffect({
      seat,
      cardName: card.name,
      ops: atom.ops,
      sourceId: instanceId,
    });
    return true;
  }

  /** La carte sélectionnée a-t-elle un pouvoir à inclinaison activable ? */
  function hasTapPower(instanceId: string): boolean {
    const inst = state.value.instances[instanceId];
    const card = getCard(inst?.cardId ?? null);
    return !!card && tapPowers(card).length > 0;
  }

  function toggleTap(instanceId: string): void {
    const inst = state.value.instances[instanceId];
    if (!inst) return;
    const tapped = inst.orientation === "tapped";
    // EN LIGNE (P2) : intention TAP/UNTAP (autorité serveur, gardée en tour).
    if (
      tryIntent(
        tapped ? { kind: "UNTAP", instanceId } : { kind: "TAP", instanceId },
      )
    )
      return;
    dispatch({
      actor: inst.controller,
      type: "SET_ORIENTATION",
      payload: { instanceId, orientation: tapped ? "upright" : "tapped" },
    });
  }

  function adjustCounter(
    instanceId: string,
    counter: string,
    delta: number,
  ): void {
    const inst = state.value.instances[instanceId];
    if (!inst) return;
    // EN LIGNE (P2) : intention INC_COUNTER (autorité serveur, gardée en tour).
    if (tryIntent({ kind: "INC_COUNTER", instanceId, counter, delta })) return;
    dispatch(incCounterVerb(inst.controller, instanceId, counter, delta));
    checkVictory();
  }

  // ── Combat assisté (702–708) ─────────────────────────────────────────────
  const combat = ref<{
    step: "attackers" | "blockers" | "strikes" | "riposte";
    target: CombatTarget | null;
    attackers: string[];
    blocks: Record<string, string>;
    /** 6105 : attackerId → bloqueur choisi pour encaisser sa Force. */
    strikes: Record<string, string>;
    /** Attaquant dont on choisit actuellement le bloqueur frappé. */
    strikeFor: string | null;
    /** 707.1 : targetId → attaquant frappé par la riposte de la Cible. */
    ripostes: Record<string, string>;
    /** Cible en train de choisir sa riposte (étape riposte). */
    riposteFrom: string | null;
    /** Attaquants candidats à la riposte (≥2 → choix demandé). */
    riposteCandidates: string[];
    /** Bloqueur en attente d'assignation à un attaquant (≥2 attaquants). */
    pendingBlocker: string | null;
    /** 706.5 : siège qui réagit HORS de son tour (fenêtre de réaction). */
    reactingSeat: Seat | null;
  } | null>(null);

  /** Attaquants à duel multi-bloqueurs (sans Géant) sans frappe choisie. */
  function pendingStrikes(c: NonNullable<typeof combat.value>): string[] {
    const byAttacker = new Map<string, number>();
    for (const atk of Object.values(c.blocks))
      byAttacker.set(atk, (byAttacker.get(atk) ?? 0) + 1);
    return c.attackers.filter((a) => {
      if ((byAttacker.get(a) ?? 0) < 2) return false;
      if (c.strikes[a]) return false;
      const card = getCard(state.value.instances[a]?.cardId ?? null);
      return !(card && combatKeywords(card).geant); // Géant répartit déjà
    });
  }

  /** Bloqueurs candidats à la frappe de l'attaquant courant. */
  const combatStrikeIds = computed(() => {
    const c = combat.value;
    if (!c || c.step !== "strikes" || !c.strikeFor) return [];
    return Object.entries(c.blocks)
      .filter(([, atk]) => atk === c.strikeFor)
      .map(([blocker]) => blocker);
  });

  /** 707.1 — attaquants libres l'ayant frappée si la Cible est Allié/Héros. */
  function riposteCandidatesOf(c: NonNullable<typeof combat.value>): string[] {
    if (!c.target || c.target.kind === "havreSac") return [];
    const blocked = new Set(Object.values(c.blocks));
    return c.attackers.filter((a) => !blocked.has(a));
  }

  /** Attaquants ciblables par la riposte de la Cible (étape riposte). */
  const combatRiposteIds = computed(() =>
    combat.value?.step === "riposte" ? combat.value.riposteCandidates : [],
  );

  /** Choisit le bloqueur frappé par l'attaquant courant (6105). */
  function combatChooseStrike(blockerId: string): void {
    const c = combat.value;
    if (!c || c.step !== "strikes" || !c.strikeFor) return;
    if (!combatStrikeIds.value.includes(blockerId)) return;
    c.strikes = { ...c.strikes, [c.strikeFor]: blockerId };
    const next = pendingStrikes(c);
    if (next.length) {
      c.strikeFor = next[0];
      return;
    }
    // EN LIGNE : toutes les frappes choisies → on quitte le sous-état local et on
    // soumet la résolution avec les frappes. En local, on résout directement.
    if (online.value) {
      c.step = "blockers";
      pushIntent({ kind: "RESOLVE_COMBAT", strikes: c.strikes });
      return;
    }
    doResolveCombat();
  }

  const combatAttackerIds = computed(() =>
    combat.value?.step === "attackers"
      ? eligibleAttackers(rulesCtx(), turn.value.active)
      : [],
  );
  const combatTargetIds = computed(() =>
    combat.value?.step === "attackers"
      ? eligibleTargets(rulesCtx(), turn.value.active).map((t) => t.instanceId)
      : [],
  );
  const combatBlockerIds = computed(() =>
    combat.value?.step === "blockers" && combat.value.target
      ? eligibleBlockers(
          rulesCtx(),
          otherSeat(turn.value.active),
          combat.value.target,
        )
      : [],
  );
  /** Attaquants légaux du joueur actif HORS combat — gate du bouton « Attaquer ». */
  const eligibleAttackerIds = computed(() =>
    eligibleAttackers(rulesCtx(), turn.value.active),
  );
  /** Une attaque peut-elle être déclarée maintenant ? (tour, phase, 1/tour, premier tour) */
  const canDeclareAttack = computed(
    () =>
      whyCannotDeclareAttack(
        rulesCtx(),
        turn.value.active,
        attackedThisTurn(turn.value.active),
      ) === null,
  );

  // ── Coordination du combat EN LIGNE (P3) — dérivée du journal `state.combat`.
  /** L'attaquant peut résoudre : le défenseur a déclaré ses blocages (« resolve »). */
  const combatCanResolve = computed(() => {
    if (!combat.value) return false;
    if (!online.value) return combat.value.step === "blockers"; // local : l'attaquant pilote
    const sc = state.value.combat;
    return !!sc && sc.step === "resolve" && sc.attackerSeat === mySeat.value;
  });
  /** Je suis le défenseur, à qui de déclarer ses blocages (fenêtre de réaction). */
  const combatCanConfirmBlocks = computed(() => {
    if (!online.value) return false;
    const sc = state.value.combat;
    return !!sc && sc.step === "blockers" && sc.attackerSeat !== mySeat.value;
  });
  /** Je suis l'attaquant, en attente des blocages adverses. */
  const combatWaitingForBlocks = computed(() => {
    if (!online.value) return false;
    const sc = state.value.combat;
    return !!sc && sc.step === "blockers" && sc.attackerSeat === mySeat.value;
  });

  /**
   * Aperçu du combat AVANT résolution : simule `resolveCombat` en LECTURE (pure,
   * aucun dispatch) pour projeter qui meurt (`lethal`) et les PV/Résistance des
   * Héros/Havre-Sac APRÈS (`hpAfter`). Réactif aux déclarations en cours (le
   * défenseur voit l'effet de ses blocages, l'attaquant celui de sa déclaration).
   * `null` hors combat ou si non calculable.
   */
  const combatPreview = computed<{
    lethal: string[];
    hpAfter: Record<string, number>;
  } | null>(() => {
    const c = combat.value;
    if (!c || !c.target || !c.attackers.length) return null;
    let result;
    try {
      result = resolveCombat(
        rulesCtx(),
        {
          attackerSeat: turn.value.active, // l'attaquant = le joueur actif
          target: c.target,
          attackers: c.attackers,
          blocks: c.blocks,
          strikes: c.strikes,
          ripostes: c.ripostes,
        },
        activeGlobalMods(rulesCtx()),
      );
    } catch {
      return null;
    }
    const hpAfter: Record<string, number> = {};
    for (const ev of result.events) {
      if (ev.type !== "INC_COUNTER") continue;
      const p = ev.payload as {
        instanceId: string;
        counter: string;
        delta: number;
      };
      if (p.counter !== "hp" && p.counter !== "resistance") continue;
      const cur =
        (
          state.value.instances[p.instanceId]?.counters as Record<
            string,
            number
          >
        )?.[p.counter] ?? 0;
      hpAfter[p.instanceId] = (hpAfter[p.instanceId] ?? cur) + p.delta;
    }
    const lethal = new Set(result.destroyed);
    // Un Héros tombé à ≤ 0 PV n'est pas "détruit" (winner) mais on le marque ☠.
    for (const [id, hp] of Object.entries(hpAfter)) {
      const inst = state.value.instances[id];
      if (
        inst &&
        state.value.seats[inst.controller]?.heroInstanceId === id &&
        hp <= 0
      )
        lethal.add(id);
    }
    return { lethal: [...lethal], hpAfter };
  });

  /** « Mana » disponible par Élément : producteurs redressés du siège (4261). */
  function resourcesOf(seat: Seat): Record<string, number> {
    const out: Record<string, number> = {};
    for (const p of resourceProducers(rulesCtx(), seat))
      out[p.element] = (out[p.element] ?? 0) + 1;
    return out;
  }

  /** Ouvre la déclaration d'attaque (1/tour, jamais au premier tour). */
  function beginCombat(firstAttacker?: string): boolean {
    const err = whyCannotDeclareAttack(
      rulesCtx(),
      perspective.value,
      attackedThisTurn(perspective.value),
    );
    if (err) return rejectMove(err);
    combat.value = {
      step: "attackers",
      target: null,
      attackers: [],
      blocks: {},
      strikes: {},
      strikeFor: null,
      ripostes: {},
      riposteFrom: null,
      riposteCandidates: [],
      pendingBlocker: null,
      reactingSeat: null,
    };
    if (firstAttacker) combatToggleAttacker(firstAttacker);
    return true;
  }

  function combatToggleAttacker(instanceId: string): void {
    const c = combat.value;
    if (!c || c.step !== "attackers") return;
    if (c.attackers.includes(instanceId)) {
      c.attackers = c.attackers.filter((a) => a !== instanceId);
      return;
    }
    if (
      !eligibleAttackers(rulesCtx(), perspective.value).includes(instanceId)
    ) {
      const inst = state.value.instances[instanceId];
      if (inst && inst.controller === perspective.value) {
        ruleError.value =
          "Cette carte ne peut pas attaquer (inclinée, arrivée ce tour, ou type non combattant).";
      }
      return;
    }
    // 703 + ruling Bruss : le +1 PM d'un « Quand il attaque » s'applique AVANT
    // la vérification de légalité de la déclaration (jetons pas encore posés).
    const ctxNow = rulesCtx();
    const cap =
      pmOf(ctxNow, perspective.value) +
      attackPmBonus(ctxNow, [...c.attackers, instanceId]);
    if (c.attackers.length >= cap) {
      ruleError.value = `Maximum ${cap} attaquant(s) — limite de PM (703).`;
      return;
    }
    c.attackers = [...c.attackers, instanceId];
  }

  function combatChooseTarget(instanceId: string): void {
    const c = combat.value;
    if (!c || c.step !== "attackers") return;
    // Re-cliquer la cible déjà désignée la désélectionne (même logique de bascule
    // que pour les attaquants).
    if (c.target?.instanceId === instanceId) {
      c.target = null;
      return;
    }
    const t = eligibleTargets(rulesCtx(), perspective.value).find(
      (x) => x.instanceId === instanceId,
    );
    // refus EXPLIQUÉ (jamais silencieux), comme l'attaque et le blocage (702.2).
    if (t) c.target = t;
    else
      ruleError.value =
        "Cible illégale : vise le Héros, un Allié du Monde ou le Havre-Sac adverse (702.2).";
  }

  function combatConfirmAttackers(): boolean {
    const c = combat.value;
    if (!c) return false;
    if (!c.target)
      return rejectMove(
        "Choisis une cible : Héros, Allié ou Havre-Sac adverse (702.2).",
      );
    if (!c.attackers.length)
      return rejectMove("Déclare au moins un attaquant redressé.");
    // EN LIGNE (P3) : on soumet l'intention DECLARE_ATTACK — le serveur valide,
    // incline les attaquants et ouvre le combat (SET_COMBAT diffusé aux deux).
    // On passe optimistement en « blockers » (attente des blocages adverses) ;
    // l'echo réaligne via reconcileCombat.
    if (online.value) {
      const ok = pushIntent({
        kind: "DECLARE_ATTACK",
        attackers: c.attackers,
        target: c.target,
      });
      if (ok) {
        c.step = "blockers";
        return true;
      }
    }
    const seat = turn.value.active;
    // 703 / A6 — l'inclinaison des attaquants part de la DÉCLARATION (et non
    // de la résolution) : les jetons posés par « Quand [self] attaque »
    // (Bruss) doivent l'être AVANT les frappes.
    const taps: DraftEvent[] = c.attackers
      .filter((id) => state.value.instances[id]?.orientation !== "tapped")
      .map(
        (id): DraftEvent => ({
          actor: seat,
          type: "SET_ORIENTATION",
          payload: { instanceId: id, orientation: "tapped" },
        }),
      );
    if (taps.length) dispatch(...taps);
    c.step = "blockers";
    // 804.5 — bus de déclenchement : « Quand [self] attaque ».
    const declared: RuleEvent[] = c.attackers.map((id) => ({
      kind: "attackerDeclared",
      seat,
      instanceId: id,
    }));
    if (assistEffects.value)
      engine.enqueueTriggered(collectTriggeredEffects(rulesCtx(), declared));
    return true;
  }

  /**
   * Le défenseur (même écran) déclare un bloqueur. 1 seul attaquant → assigné
   * d'office ; ≥2 attaquants → met le bloqueur « en attente » (pendingBlocker),
   * le défenseur choisit ensuite l'attaquant via combatChooseBlockTarget (704).
   */
  function combatToggleBlock(blockerId: string): void {
    const c = combat.value;
    if (!c || c.step !== "blockers" || !c.target) return;
    // EN LIGNE : seul le DÉFENSEUR (≠ joueur actif) assemble les blocages. Sans
    // cette garde, l'attaquant (qui voit aussi l'étape « blockers ») pourrait
    // muter ses blocages localement → désync (le serveur les rejetterait).
    if (online.value && otherSeat(turn.value.active) !== mySeat.value) return;
    if (c.blocks[blockerId]) {
      const rest = { ...c.blocks };
      delete rest[blockerId];
      c.blocks = rest;
      if (c.pendingBlocker === blockerId) c.pendingBlocker = null;
      return;
    }
    const def = otherSeat(turn.value.active);
    if (!eligibleBlockers(rulesCtx(), def, c.target).includes(blockerId)) {
      // refus EXPLIQUÉ (jamais silencieux) : pouvoir continu ou état
      const inst = state.value.instances[blockerId];
      if (inst && inst.controller === def) {
        const card = getCard(inst.cardId);
        ruleError.value = cannotBlock(rulesCtx(), blockerId)
          ? `${card?.name ?? "Cette carte"} ne peut pas bloquer.`
          : "Cette carte ne peut pas bloquer (inclinée, cible de l'attaque, ou type non combattant).";
      }
      return;
    }
    const pm = pmOf(rulesCtx(), def);
    if (Object.keys(c.blocks).length >= pm) {
      ruleError.value = `Maximum ${pm} bloqueur(s) — limite de PM (704).`;
      return;
    }
    // 704 — assignation : 1 seul attaquant → auto ; sinon le défenseur choisit
    // (clic du bloqueur puis clic de l'attaquant via combatChooseBlockTarget).
    if (c.attackers.length === 1) {
      c.blocks = { ...c.blocks, [blockerId]: c.attackers[0] };
    } else {
      c.pendingBlocker = blockerId;
    }
  }

  /** Le défenseur assigne le bloqueur en attente à un attaquant (704). */
  function combatChooseBlockTarget(attackerId: string): void {
    const c = combat.value;
    if (!c || c.step !== "blockers" || !c.pendingBlocker) return;
    if (online.value && otherSeat(turn.value.active) !== mySeat.value) return;
    if (!c.attackers.includes(attackerId)) return;
    c.blocks = { ...c.blocks, [c.pendingBlocker]: attackerId };
    c.pendingBlocker = null;
  }

  /**
   * Demande de résolution : si des duels multi-bloqueurs attendent le choix
   * du bloqueur frappé (6105), ouvre l'étape « strikes » ; sinon résout.
   */
  function combatResolve(): void {
    const c = combat.value;
    if (!c || !c.target) return;
    // EN LIGNE (P3) : l'attaquant soumet RESOLVE_COMBAT (le défenseur a déjà
    // déclaré ses blocages → state.combat.step === "resolve"). Le serveur
    // applique resolveCombat et clôt le combat (echo). La riposte (707.1) est
    // portée par le blocage du défenseur (DECLARE_BLOCK).
    if (online.value) {
      // 6105 : duels multi-bloqueurs sans Géant → l'attaquant choisit LOCALEMENT
      // quel bloqueur encaisse la Force, puis on soumet (sinon défaut serveur).
      const pending = pendingStrikes(c);
      if (pending.length) {
        c.step = "strikes";
        c.strikeFor = pending[0];
        return;
      }
      pushIntent({ kind: "RESOLVE_COMBAT", strikes: c.strikes });
      return;
    }
    // Sécurité : si une réaction traînait, on la clôt et on rend la main à
    // l'attaquant avant de résoudre.
    if (c.reactingSeat) {
      c.reactingSeat = null;
      perspective.value = turn.value.active;
    }
    const pending = pendingStrikes(c);
    if (pending.length) {
      c.step = "strikes";
      c.strikeFor = pending[0];
      return;
    }
    // 707.1 — riposte : si ≥2 attaquants libres et pas encore choisi, demander.
    const cands = riposteCandidatesOf(c);
    if (cands.length >= 2 && !c.ripostes[c.target.instanceId]) {
      c.step = "riposte";
      c.riposteFrom = c.target.instanceId;
      c.riposteCandidates = cands;
      return;
    }
    doResolveCombat();
  }

  /**
   * EN LIGNE (P3) : le DÉFENSEUR confirme ses blocages (même vides = « laisser
   * passer ») → intention DECLARE_BLOCK. Le serveur passe le combat en
   * « resolve » : l'attaquant pourra alors résoudre. Inopérant hors-ligne (en
   * hot-seat l'attaquant pilote tout).
   */
  function combatConfirmBlocks(): void {
    const c = combat.value;
    if (!c || !online.value) return;
    // 707.1 : si ≥2 attaquants libres frappent une Cible Allié/Héros et qu'aucune
    // riposte n'est encore choisie, le défenseur choisit LOCALEMENT l'attaquant
    // riposté avant de soumettre (sinon défaut serveur = premier attaquant).
    const cands = riposteCandidatesOf(c);
    if (c.target && cands.length >= 2 && !c.ripostes[c.target.instanceId]) {
      c.step = "riposte";
      c.riposteFrom = c.target.instanceId;
      c.riposteCandidates = cands;
      return;
    }
    pushIntent({
      kind: "DECLARE_BLOCK",
      blocks: c.blocks,
      ripostes: c.ripostes,
    });
  }

  /** 706.5 — l'attaquant cède la main au défenseur pour réagir avant résolution. */
  function combatOfferReaction(): void {
    // EN LIGNE, aucune passation : le défenseur agit sur SON client (le combat
    // est au journal). La fenêtre de réaction hot-seat ne s'applique qu'en local.
    if (online.value) return;
    const c = combat.value;
    if (!c || c.step !== "blockers") return;
    const def = otherSeat(turn.value.active);
    c.reactingSeat = def;
    perspective.value = def;
    passPending.value = true; // overlay de passation (cache l'écran)
  }

  /** Fin de la réaction du défenseur : retour à l'attaquant pour résoudre. */
  function combatEndReaction(): void {
    const c = combat.value;
    if (!c) return;
    c.reactingSeat = null;
    perspective.value = turn.value.active;
    passPending.value = false;
  }

  /** Le défenseur choisit l'attaquant frappé par la riposte de la Cible (707.1). */
  function combatChooseRiposte(attackerId: string): void {
    const c = combat.value;
    if (!c || c.step !== "riposte" || !c.riposteFrom) return;
    if (!c.riposteCandidates.includes(attackerId)) return;
    c.ripostes = { ...c.ripostes, [c.riposteFrom]: attackerId };
    // EN LIGNE : la riposte choisie, on revient à l'état partagé et on soumet le
    // blocage (avec la riposte). En local, on enchaîne sur la résolution.
    if (online.value) {
      c.step = "blockers";
      pushIntent({
        kind: "DECLARE_BLOCK",
        blocks: c.blocks,
        ripostes: c.ripostes,
      });
      return;
    }
    doResolveCombat();
  }

  function doResolveCombat(): void {
    const c = combat.value;
    if (!c || !c.target) return;
    const result = resolveCombat(
      rulesCtx(),
      {
        attackerSeat: turn.value.active,
        target: c.target,
        attackers: c.attackers,
        blocks: c.blocks,
        strikes: c.strikes,
        ripostes: c.ripostes,
      },
      activeGlobalMods(rulesCtx()),
    );
    dispatch(
      ...result.events,
      ...result.log.map((l) => say(turn.value.active, l)),
    );
    // 804.7 — déclenchés des Dommages infligés (après la résolution complète).
    if (assistEffects.value)
      engine.enqueueTriggered(
        collectTriggeredEffects(rulesCtx(), result.ruleEvents),
      );
    attackedOnTurn.value = turn.value.number;
    combat.value = null;
    if (result.winner) {
      winner.value = result.winner;
      matchPhase.value = "finished";
    } else {
      checkVictory();
    }
  }

  function combatCancel(): void {
    const c = combat.value;
    // EN LIGNE (P3) : si le combat est DÉJÀ déclaré côté serveur, on soumet
    // CANCEL_COMBAT (le serveur redresse les attaquants + clôt). S'il n'est
    // qu'en assemblage local (pas encore déclaré), on ferme juste le ref local.
    if (online.value) {
      if (state.value.combat) pushIntent({ kind: "CANCEL_COMBAT" });
      else combat.value = null;
      return;
    }
    // Annuler APRÈS la déclaration : les attaquants ont été inclinés à la
    // déclaration (A6). On les redresse pour ne pas laisser le joueur avec des
    // cartes tapées « pour rien » s'il renonce au combat.
    if (c && c.step !== "attackers") {
      const seat = turn.value.active;
      const untaps: DraftEvent[] = c.attackers
        .filter((id) => state.value.instances[id]?.orientation === "tapped")
        .map(
          (id): DraftEvent => ({
            actor: seat,
            type: "SET_ORIENTATION",
            payload: { instanceId: id, orientation: "upright" },
          }),
        );
      if (untaps.length) dispatch(...untaps);
    }
    combat.value = null;
  }

  // P2.6 — désactiver « Règles assistées » en plein combat laisserait un combat
  // ouvert que plus rien ne résout (les destructions d'état sont gated sur
  // assist). On annule proprement le combat à la bascule pour éviter l'impasse.
  watch(assist, (on) => {
    if (!on && combat.value) combatCancel();
  });

  /**
   * Force EFFECTIVE d'une instance en jeu pour l'UI (812.2/805) :
   * base|taille de main + auras + « tant qu'il bloque » + jetons. `delta` =
   * écart à la Force imprimée (pastille verte si > 0, rouge si < 0).
   * `null` hors du jeu ou pour les cartes sans Force (Zones, Havre-Sac…).
   */
  function effectiveForceOf(
    instanceId: string,
  ): { value: number; delta: number } | null {
    const inst = state.value.instances[instanceId];
    if (!inst) return null;
    const zone = inst.location.zone;
    if (zone !== "monde" && zone !== "havreSac") return null;
    const card = getCard(inst.cardId);
    if (!card || (card.mainType !== "Allié" && card.mainType !== "Héros"))
      return null;
    const value = effectiveForce(rulesCtx(), instanceId, currentStance());
    const printed = forceValue(card, inst.face === "verso" ? "verso" : "recto");
    return { value, delta: value - printed };
  }

  function shufflePioche(seat: Seat = perspective.value): void {
    const size = state.value.seats[seat].pioche.length;
    if (size < 2) return;
    dispatch(
      shuffleVerb(seat, { zone: "pioche", owner: seat }, size, rndSeed()),
    );
  }

  /** Passe au joueur suivant : redresse ses cartes + retire les Dommages. */
  function nextTurn(): void {
    // Transition de tour PURE et partagée (cf. `nextTurnEvents`) : SET_PHASE +
    // purge des jetons de tour + redressement/effacement des dégâts du joueur
    // entrant. Même chemin que l'autorité serveur (`resolveIntent` END_TURN).
    dispatch(...nextTurnEvents(state.value));
  }

  function undoLast(): void {
    // L'annulation est une commodité LOCALE (hot-seat). En ligne, annuler un
    // event du journal partagé est non-standard (et l'event ciblé peut être
    // l'adversaire) → on la désactive ; le jeu passe par les intentions.
    if (online.value) {
      rejectMove("L'annulation n'est pas disponible en ligne.");
      return;
    }
    for (let i = events.value.length - 1; i >= 0; i--) {
      const e = events.value[i];
      if (
        e.type === "UNDONE" ||
        e.type === "GAME_STARTED" ||
        e.actor === "system"
      )
        continue;
      const already = events.value.some(
        (u) =>
          u.type === "UNDONE" &&
          (u.payload as { targetSeq: number }).targetSeq === e.seq,
      );
      if (already) continue;
      dispatch(undoVerb(e.actor as Seat, e.seq));
      return;
    }
  }

  const started = computed(() => matchPhase.value !== "lobby");

  return {
    // état
    events,
    state,
    view,
    turn,
    phaseLabel,
    log,
    started,
    matchPhase,
    players,
    firstPlayer,
    perspective,
    opponent,
    passPending,
    mulliganSeat,
    winner,
    activeName,
    paOf,
    // cycle
    startMatch,
    startSandbox,
    mulligan,
    keepHand,
    reveal,
    endTurn,
    concede,
    quitMatch,
    // présence adverse + fenêtre de grâce (déconnexion)
    opponentPresent,
    canClaimVictory,
    claimVictory,
    // verbes
    draw,
    moveTo,
    toggleTap,
    adjustCounter,
    shufflePioche,
    nextTurn,
    undoLast,
    // moteur de règles (R1)
    assist,
    assistEffects,
    online,
    mySeat,
    gameId: () => gameId.value,
    connectOnline,
    disconnectOnline,
    applyServerEvent,
    /** Force un rattrapage du journal (pull depuis lastSeq). À appeler quand on
     *  SAIT que des events viennent d'être créés serveur (ex. juste après
     *  joinGame) : le pull de connexion a pu tourner sur un journal encore vide. */
    resyncOnline: () => resyncFrom(lastSeq()),
    onlineJournalSeqs: () => events.value.map((e) => e.seq),
    /** Sièges ayant validé leur décision de mulligan (dérivé du journal). */
    mulliganDoneOnline: (): Record<"A" | "B", boolean> => {
      const done: Record<"A" | "B", boolean> = { A: false, B: false };
      for (const e of events.value)
        if (e.type === "MULLIGAN_DONE")
          done[(e.payload as { seat: "A" | "B" }).seat] = true;
      return done;
    },
    revealedCardId: (id: string) => revealed.value[id] ?? null,
    ruleError,
    clearRuleError,
    playFromHand,
    attackedOnTurn,
    combat,
    combatAttackerIds,
    combatTargetIds,
    combatBlockerIds,
    eligibleAttackerIds,
    canDeclareAttack,
    combatCanResolve,
    combatCanConfirmBlocks,
    combatWaitingForBlocks,
    combatPreview,
    resourcesOf,
    beginCombat,
    combatToggleAttacker,
    combatChooseTarget,
    combatConfirmAttackers,
    combatToggleBlock,
    combatChooseBlockTarget,
    combatConfirmBlocks,
    combatResolve,
    combatOfferReaction,
    combatEndReaction,
    combatStrikeIds,
    combatChooseStrike,
    combatRiposteIds,
    combatChooseRiposte,
    combatCancel,
    effectiveForceOf,
    effectChoice: engine.effectChoice,
    effectChoiceResolve: engine.effectChoiceResolve,
    effectTargeting: engine.effectTargeting,
    effectTargetIdsList: engine.effectTargetIdsList,
    effectTargetChoose: engine.effectTargetChoose,
    effectTargetSkip: engine.effectTargetSkip,
    activateTapPower,
    hasTapPower,
    effectPicking: engine.effectPicking,
    effectPickIds: engine.effectPickIds,
    effectPick: engine.effectPick,
    effectPickSkip: engine.effectPickSkip,
    enqueueEffect: engine.enqueueEffect,
    manualReminders: engine.manualReminders,
    dismissManualReminder: engine.dismissManualReminder,
  };
});
