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
import { computed, ref, shallowRef } from "vue";
import type { Card, Deck } from "@/types/cards";
import type {
  DraftEvent,
  GameState,
  PersistedEvent,
  Position,
  RedactedGameState,
  Seat,
  ZoneRef,
} from "@/game";
import {
  createGame,
  deriveState,
  drawTop,
  move,
  otherSeat,
  redactStateFor,
  say,
  sequence,
  setCounter as setCounterVerb,
  incCounter as incCounterVerb,
  setPhase,
  shuffle as shuffleVerb,
  undo as undoVerb,
} from "@/game";
import type {
  CombatTarget,
  EffectOp,
  RuleEvent,
  RulesCtx,
  TargetingOp,
  TriggeredFrame,
} from "@/game/rules";
import type { ForceStance } from "@/game/rules";
import {
  activeGlobalMods,
  arrivalEffects,
  attackPmBonus,
  cannotBlock,
  collectTriggeredEffects,
  combatKeywords,
  effectTargetIds,
  effectiveForce,
  eligibleAttackers,
  eligibleBlockers,
  eligibleTargets,
  equalityRescueEvents,
  forceValue,
  grantXpEvents,
  havreSacHasRoom,
  heroLevel,
  isTargetingOp,
  isTurnToken,
  planCost,
  playDestination,
  playEffects,
  pmOf,
  printedEffects,
  producedElement,
  normElement,
  resolveBuffForceTarget,
  resolveCombat,
  resolveDamageTarget,
  resolveDestroyTarget,
  resolveHealHeroTarget,
  stateBasedDestroyEvents,
  tapPowers,
  turnStartEffects,
  victoryFromState,
  whyCannotDeclareAttack,
  whyCannotPlay,
} from "@/game/rules";
import { useCardStore } from "@/stores/cardStore";

function rndSeed(): string {
  return Math.random().toString(36).slice(2);
}

export type MatchPhase = "lobby" | "mulligan" | "playing" | "finished";

/**
 * Transport du jeu EN LIGNE (modèle « clients de confiance » : le serveur
 * diffuse l'état COMPLET, l'info cachée est respectée à l'affichage via
 * `redactStateFor`). Injecté (gameClient en prod, mock en test) pour découpler
 * le store de Supabase.
 */
export interface OnlineTransport {
  submit(gameId: string, draft: DraftEvent): Promise<{ seq: number }>;
  subscribe(gameId: string, onEvent: (e: PersistedEvent) => void): () => void;
}

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
  const gameId = ref("local");
  // ── Jeu en ligne (clients de confiance) ─────────────────────────────────
  const online = ref(false);
  const mySeat = ref<Seat>("A");
  let onlineTransport: OnlineTransport | null = null;
  let onlineUnsub: (() => void) | null = null;
  let submitChain: Promise<unknown> = Promise.resolve();

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
  const state = computed<GameState>(() => deriveState(events.value));
  const view = computed<RedactedGameState>(() =>
    redactStateFor(state.value, perspective.value),
  );
  const turn = computed(() => state.value.turn);
  const phaseLabel = computed(
    () => PHASE_LABEL[state.value.turn.phase] ?? state.value.turn.phase,
  );

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
  /** Tour où l'attaque du joueur actif a été déclarée (1 attaque/tour). */
  const attackedOnTurn = ref<number | null>(null);

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

  /** Applique un event diffusé par le serveur (complet, modèle de confiance). */
  function applyServerEvent(ev: PersistedEvent): void {
    if (events.value.some((e) => e.seq === ev.seq)) return; // dédoublonnage
    events.value = [...events.value, ev];
  }

  /** Connecte la table à une partie en ligne, au siège `seat`. */
  function connectOnline(
    id: string,
    seat: Seat,
    transport: OnlineTransport,
  ): void {
    disconnectOnline();
    online.value = true;
    assist.value = false; // jeu en ligne = résolution manuelle (Cockatrice)
    gameId.value = id;
    mySeat.value = seat;
    perspective.value = seat; // vue figée sur SON siège (info cachée à l'écran)
    events.value = [];
    matchPhase.value = "playing";
    onlineTransport = transport;
    submitChain = Promise.resolve();
    onlineUnsub = transport.subscribe(id, applyServerEvent);
  }

  function disconnectOnline(): void {
    onlineUnsub?.();
    onlineUnsub = null;
    onlineTransport = null;
    online.value = false;
    assist.value = true;
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
    effectChoices.value = [];
    effectTargeting.value = null;
    effectPicking.value = null;
    effectQueue.value = [];
    turnStartFiredOn.value = null;
  }

  /** Démarrage direct en partie (tests / bac à sable rapide). */
  function startSandbox(deckA: Deck, deckB: Deck, first: Seat = "A"): void {
    firstPlayer.value = first;
    players.value = { A: { name: "Joueur 1" }, B: { name: "Joueur 2" } };
    initEngine(deckA, deckB, first);
    mulliganSeat.value = null;
    perspective.value = first;
    matchPhase.value = "playing";
    passPending.value = false;
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
            enqueueEffect({
              seat,
              cardName: card.name,
              ops: [{ op: "destroySelf" }],
              sourceId: inst.instanceId,
            });
            continue;
          }
          effectChoices.value = [
            ...effectChoices.value,
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
        enqueueEffect({
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
    // 4873 : on ne passe pas la main avec un excédent — défausse d'abord
    if (assist.value && state.value.seats[active].main.length > paOf(active)) {
      enforceHandLimit(active);
      rejectMove("Main pleine : défausse l'excédent avant de finir le tour.");
      return;
    }
    combat.value = null;
    const need = paOf(active) - state.value.seats[active].main.length;
    if (need > 0) draw(active, need);
    nextTurn();
    perspective.value = state.value.turn.active;
    passPending.value = true;
  }

  function concede(seat: Seat): void {
    dispatch(say(seat, `${players.value[seat].name} abandonne la partie.`));
    winner.value = otherSeat(seat);
    matchPhase.value = "finished";
  }

  function quitMatch(): void {
    events.value = [];
    matchPhase.value = "lobby";
    passPending.value = false;
    mulliganSeat.value = null;
    winner.value = null;
    combat.value = null;
    attackedOnTurn.value = null;
    ruleError.value = null;
    effectChoices.value = [];
    effectTargeting.value = null;
    effectPicking.value = null;
    effectQueue.value = [];
    turnStartFiredOn.value = null;
  }

  // ── Verbes exposés au plateau ─────────────────────────────────────────────
  function draw(seat: Seat = perspective.value, n = 1): void {
    const drafts: DraftEvent[] = [];
    let working = state.value;
    for (let i = 0; i < n; i++) {
      if (!working.seats[seat].pioche.length) break;
      const d = drawTop(working, seat);
      drafts.push(d);
      working = deriveState([
        ...events.value,
        ...sequence(drafts, gameId.value, state.value.seq + 1),
      ]);
    }
    dispatch(...drafts);
    enforceHandLimit(seat);
  }

  function moveTo(
    instanceId: string,
    to: ZoneRef,
    position: Position = { at: "any" },
  ): void {
    const inst = state.value.instances[instanceId];
    if (!inst) return;
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
    if (!assist.value) {
      moveTo(instanceId, { zone: "monde" });
      return true;
    }
    const ctx = rulesCtx();
    const reason = whyCannotPlay(ctx, seat, instanceId);
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
      drafts.push(
        say(
          seat,
          `${players.value[seat].name} incline ${plan.producers.length} carte(s) pour payer ${card.name}.`,
        ),
      );
    }
    dispatch(...drafts);
    if (actionAtoms.length) {
      for (const atom of actionAtoms) {
        dispatch(say(seat, `Action résolue — ${card.name} : « ${atom.text} »`));
        enqueueEffect({ seat, cardName: card.name, ops: atom.ops });
      }
    } else {
      queueArrivalEffects(seat, card, instanceId);
    }
    return true;
  }

  /** Effets optionnels (« vous pouvez… ») en attente de confirmation. */
  const effectChoices = ref<
    {
      seat: Seat;
      cardName: string;
      text: string;
      ops: EffectOp[];
      /** Branche exécutée si le joueur décline (« ou détruisez X »). */
      declineOps?: EffectOp[];
      sourceId?: string;
    }[]
  >([]);
  const effectChoice = computed(() => effectChoices.value[0] ?? null);

  /** Op à cible en attente du clic du joueur (mode ciblage du plateau). */
  const effectTargeting = ref<{
    seat: Seat;
    cardName: string;
    op: TargetingOp;
    sourceId?: string;
  } | null>(null);

  /** Filtre de recherche dans une pile (type, famille, niveau max, élément). */
  interface PickFilter {
    mainType?: string;
    sub?: string;
    maxLevel?: number;
    /** « une carte [Feu] » : seules les cartes de cet Élément. */
    element?: string;
  }
  function normWord(s: string): string {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  }
  function matchesPickFilter(card: Card | null, f?: PickFilter): boolean {
    if (!f) return true;
    if (!card) return false;
    if (f.mainType && card.mainType !== f.mainType) return false;
    if (f.sub && !(card.subTypes ?? []).some((s) => normWord(s) === f.sub))
      return false;
    if (f.element && producedElement(card) !== normElement(f.element))
      return false;
    if (
      f.maxLevel !== undefined &&
      (card.stats?.niveau?.value ?? Number.POSITIVE_INFINITY) > f.maxLevel
    )
      return false;
    return true;
  }

  /** Choix de carte(s) dans une pile (recycler / défausser / chercher). */
  const effectPicking = ref<{
    seat: Seat;
    cardName: string;
    zone: "defausse" | "main" | "pioche";
    action: "recycle" | "discard" | "toHand" | "toMonde";
    /** Filtre de la recherche dans la Pioche. */
    filter?: PickFilter;
    /** « Il apparaît incliné. » — la carte mise en jeu arrive inclinée. */
    enterTapped?: boolean;
    /** Choix imposé par une règle (pas de bouton « Passer »). */
    mandatory?: boolean;
    remaining: number;
    sourceId?: string;
  } | null>(null);

  /**
   * Limite de main = PA (4873) : « à n'importe quel instant », l'excédent
   * doit être défaussé. Ouvre un choix OBLIGATOIRE dans la main.
   */
  function enforceHandLimit(seat: Seat): void {
    if (!assist.value || matchPhase.value !== "playing") return;
    if (effectPicking.value || effectTargeting.value) return; // re-vérifié après
    const excess = state.value.seats[seat].main.length - paOf(seat);
    if (excess <= 0) return;
    dispatch(
      say(
        seat,
        `Main pleine (maximum ${paOf(seat)} = PA) : défausse ${excess} carte(s).`,
      ),
    );
    effectPicking.value = {
      seat,
      cardName: "Limite de main",
      zone: "main",
      action: "discard",
      mandatory: true,
      remaining: excess,
    };
  }

  /**
   * FILE D'EXÉCUTION des effets : chaque effet est une « frame » d'ops.
   * Une op interactive (cible, pile) met la frame en pause — le reste de ses
   * ops reste en tête de file ; les effets déclenchés en cascade (carte mise
   * en jeu par un effet) s'ajoutent en queue. C'est l'embryon de la File
   * d'Attente du jeu (503).
   */
  interface EffectFrame {
    seat: Seat;
    cardName: string;
    ops: EffectOp[];
    sourceId?: string;
  }
  const effectQueue = ref<EffectFrame[]>([]);

  function enqueueEffect(frame: EffectFrame): void {
    effectQueue.value = [...effectQueue.value, frame];
    pumpEffects();
  }

  /**
   * Enfile les frames du bus de déclenchement (804.7) : « Quand [self]
   * attaque » à la déclaration, déclenchés des Dommages à la résolution.
   * L'ordre (joueur actif d'abord) est garanti par `collectTriggeredEffects`.
   */
  function enqueueTriggered(frames: TriggeredFrame[]): void {
    for (const f of frames) {
      if (f.text)
        dispatch(say(f.seat, `Déclenché — ${f.cardName} : « ${f.text} »`));
      enqueueEffect({
        seat: f.seat,
        cardName: f.cardName,
        ops: f.ops,
        sourceId: f.sourceId,
      });
    }
  }

  /** Avance la file tant qu'aucune interaction n'est en attente. */
  function pumpEffects(): void {
    while (
      effectQueue.value.length &&
      !effectTargeting.value &&
      !effectPicking.value
    ) {
      const frame = effectQueue.value[0];
      if (runFrame(frame)) return; // en pause — la frame reste en tête
      effectQueue.value = effectQueue.value.slice(1);
    }
    // file vidée : destructions d'état (1414/3019) puis limite de main
    // (« à n'importe quel instant »)
    if (
      !effectQueue.value.length &&
      !effectTargeting.value &&
      !effectPicking.value
    ) {
      checkVictory();
      enforceHandLimit(state.value.turn.active);
    }
  }

  /** Remplace les ops restantes de la frame en tête de file. */
  function holdRest(frame: EffectFrame, rest: EffectOp[]): void {
    effectQueue.value = [
      { ...frame, ops: rest },
      ...effectQueue.value.slice(1),
    ];
  }
  const effectPickIds = computed(() => {
    const p = effectPicking.value;
    if (!p) return [];
    const ids = [...state.value.seats[p.seat][p.zone]];
    if (!p.filter) return ids;
    return ids.filter((id) =>
      matchesPickFilter(
        getCard(state.value.instances[id]?.cardId ?? null),
        p.filter,
      ),
    );
  });

  /** Le joueur choisit une carte dans la pile ; continue l'effet une fois fini. */
  function effectPick(instanceId: string): void {
    const p = effectPicking.value;
    if (!p || !effectPickIds.value.includes(instanceId)) return;
    if (p.action === "recycle") {
      moveTo(instanceId, { zone: "pioche", owner: p.seat }, { at: "bottom" });
      dispatch(
        say(p.seat, `${p.cardName} : une carte est recyclée sous la Pioche.`),
      );
    } else if (p.action === "discard") {
      moveTo(instanceId, { zone: "defausse", owner: p.seat }, { at: "top" });
    } else if (p.action === "toHand") {
      moveTo(instanceId, { zone: "main", owner: p.seat });
      dispatch(
        say(
          p.seat,
          `${p.cardName} : ${getCard(state.value.instances[instanceId]?.cardId ?? null)?.name ?? "une carte"} rejoint la main.`,
        ),
      );
    } else {
      moveTo(instanceId, { zone: "monde" });
      if (p.enterTapped) {
        dispatch({
          actor: p.seat,
          type: "SET_ORIENTATION",
          payload: { instanceId, orientation: "tapped" },
        });
      }
      dispatch(
        say(
          p.seat,
          `${p.cardName} : la carte cherchée entre en jeu${p.enterTapped ? " (inclinée)" : ""}.`,
        ),
      );
      // la carte mise en jeu par l'effet « apparaît » : son propre effet
      // d'apparition part en cascade (en queue de file)
      queueArrivalEffects(
        p.seat,
        getCard(state.value.instances[instanceId]?.cardId ?? null),
        instanceId,
      );
    }
    const remaining = p.remaining - 1;
    const stillHas = effectPickIds.value.length > 0;
    if (remaining > 0 && stillHas) {
      effectPicking.value = { ...p, remaining };
      return;
    }
    effectPicking.value = null;
    pumpEffects();
  }

  /** Passe le choix en cours (pile vide / décision du joueur). */
  function effectPickSkip(): void {
    const p = effectPicking.value;
    if (!p || p.mandatory) return; // un choix imposé ne se passe pas
    effectPicking.value = null;
    dispatch(say(p.seat, `${p.cardName} : choix passé.`));
    pumpEffects();
  }
  const effectTargetIdsList = computed(() =>
    effectTargeting.value
      ? effectTargetIds(rulesCtx(), effectTargeting.value.op)
      : [],
  );

  /**
   * Exécute les ops de la frame de tête ; retourne `true` si une op
   * interactive met la frame en pause (le reste attend via `holdRest`).
   */
  function runFrame(frame: EffectFrame): boolean {
    const { seat, cardName, sourceId } = frame;
    const ops = frame.ops;
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      if (isTargetingOp(op)) {
        const eligible = effectTargetIds(rulesCtx(), op);
        if (!eligible.length) {
          dispatch(
            say(seat, `${cardName} : aucune cible légale, effet passé.`),
          );
          continue;
        }
        effectTargeting.value = { seat, cardName, op, sourceId };
        holdRest(frame, ops.slice(i + 1));
        return true;
      }
      if (op.op === "shuffleDeck") {
        shufflePioche(seat);
        continue;
      }
      if (op.op === "searchDeck") {
        const filter: PickFilter = {
          mainType: op.what,
          ...(op.sub ? { sub: op.sub } : {}),
          ...(op.maxLevel !== undefined ? { maxLevel: op.maxLevel } : {}),
        };
        const hasMatch = state.value.seats[seat].pioche.some((id) =>
          matchesPickFilter(
            getCard(state.value.instances[id]?.cardId ?? null),
            filter,
          ),
        );
        if (!hasMatch) {
          dispatch(
            say(
              seat,
              `${cardName} : aucune carte correspondante dans la Pioche.`,
            ),
          );
          continue;
        }
        effectPicking.value = {
          seat,
          cardName,
          zone: "pioche",
          action: op.dest === "main" ? "toHand" : "toMonde",
          filter,
          ...(op.tapped ? { enterTapped: true } : {}),
          remaining: 1,
          sourceId,
        };
        holdRest(frame, ops.slice(i + 1));
        return true;
      }
      if (op.op === "recycleFromDiscard" || op.op === "discardFromHand") {
        const zone = op.op === "recycleFromDiscard" ? "defausse" : "main";
        const filter: PickFilter | undefined =
          op.op === "recycleFromDiscard" && op.element
            ? { element: op.element }
            : undefined;
        const hasMatch = state.value.seats[seat][zone].some((id) =>
          matchesPickFilter(
            getCard(state.value.instances[id]?.cardId ?? null),
            filter,
          ),
        );
        if (!hasMatch) {
          dispatch(
            say(
              seat,
              `${cardName} : rien à ${op.op === "recycleFromDiscard" ? "recycler" : "défausser"}${filter ? ` (aucune carte ${op.element})` : ""}, effet passé.`,
            ),
          );
          continue;
        }
        effectPicking.value = {
          seat,
          cardName,
          zone,
          action: op.op === "recycleFromDiscard" ? "recycle" : "discard",
          ...(filter ? { filter } : {}),
          remaining: op.n,
          sourceId,
        };
        holdRest(frame, ops.slice(i + 1));
        return true;
      }
      if (op.op === "buffForceSelf") {
        const src = sourceId ? state.value.instances[sourceId] : null;
        const inPlay =
          src &&
          (src.location.zone === "monde" || src.location.zone === "havreSac");
        if (inPlay) {
          dispatch(
            incCounterVerb(seat, sourceId!, "forceMod", op.n, true),
            say(
              seat,
              `${cardName} gagne +${op.n} en Force jusqu'à la fin du tour.`,
            ),
          );
        }
      } else if (op.op === "draw") {
        draw(seat, op.n);
      } else if (op.op === "gainXp") {
        const grant = grantXpEvents(rulesCtx(), seat, op.n);
        dispatch(
          ...grant.events,
          ...grant.log.map((l) =>
            say(seat, `Le Héros de ${players.value[seat].name} ${l}`),
          ),
        );
        if (grant.won) {
          winner.value = seat;
          matchPhase.value = "finished";
        }
      } else if (op.op === "heroGainPv") {
        const heroId = state.value.seats[seat].heroInstanceId;
        if (heroId) adjustCounter(heroId, "hp", op.n);
      } else if (op.op === "heroLosePv") {
        const heroId = state.value.seats[seat].heroInstanceId;
        if (heroId) adjustCounter(heroId, "hp", -op.n);
      } else if (op.op === "damageOppHero") {
        const oppHeroId = state.value.seats[otherSeat(seat)].heroInstanceId;
        if (oppHeroId) adjustCounter(oppHeroId, "hp", -op.n);
      } else if (op.op === "havreSacGainResistance") {
        const sacId = state.value.seats[seat].havreSacInstanceId;
        if (sacId) adjustCounter(sacId, "resistance", op.n);
      } else if (op.op === "tapSelf") {
        const src = sourceId ? state.value.instances[sourceId] : null;
        const inPlay =
          src &&
          (src.location.zone === "monde" || src.location.zone === "havreSac");
        if (inPlay && src!.orientation === "upright") {
          dispatch({
            actor: seat,
            type: "SET_ORIENTATION",
            payload: { instanceId: sourceId!, orientation: "tapped" },
          });
        }
      } else if (op.op === "loseStatTurn") {
        const heroId = state.value.seats[seat].heroInstanceId;
        if (heroId) {
          dispatch(
            incCounterVerb(
              seat,
              heroId,
              op.stat === "pa" ? "paMod" : "pmMod",
              -op.n,
              true,
            ),
            say(
              seat,
              `${players.value[seat].name} perd ${op.n} ${op.stat.toUpperCase()} jusqu'à la fin du tour.`,
            ),
          );
        }
      } else if (op.op === "destroySelf") {
        const src = sourceId ? state.value.instances[sourceId] : null;
        const inPlay =
          src &&
          (src.location.zone === "monde" || src.location.zone === "havreSac");
        if (inPlay) {
          dispatch(
            move(seat, {
              instanceId: sourceId!,
              from: src!.location,
              to: { zone: "defausse", owner: src!.owner },
              position: { at: "top" },
              visibility: { faceDown: false, visibleTo: "all" },
              preservesIdentity: false,
            }),
            say(seat, `${cardName} est détruit.`),
          );
        }
      } else if (op.op === "combatModSelf") {
        const src = sourceId ? state.value.instances[sourceId] : null;
        const inPlay =
          src &&
          (src.location.zone === "monde" || src.location.zone === "havreSac");
        if (inPlay) {
          // Jetons de COMBAT posés sur la source (purgés en fin de combat/tour
          // par isTurnToken) : Force lue par effectiveForce, Géant par
          // effectiveKeywords. Le +PM a déjà servi au plafond d'attaquants.
          const drafts: DraftEvent[] = [];
          if (op.force)
            drafts.push(
              incCounterVerb(seat, sourceId!, "forceCombatMod", op.force, true),
            );
          if (op.pm)
            drafts.push(
              incCounterVerb(seat, sourceId!, "pmCombatMod", op.pm, true),
            );
          if (op.geant)
            drafts.push(
              setCounterVerb(seat, sourceId!, "geantCombatMod", 1, true),
            );
          const parts = [
            op.force ? `+${op.force} en Force` : null,
            op.geant ? "Géant" : null,
          ].filter(Boolean);
          dispatch(
            ...drafts,
            say(
              seat,
              `${cardName} — pendant ce combat : ${parts.join(" et ") || "modificateur"}.`,
            ),
          );
        }
      } else if (op.op === "buffForceAlliesMondeTurn") {
        const heroId = state.value.seats[seat].heroInstanceId;
        if (heroId) {
          // 812.3b — jeton de SIÈGE sur le Héros (ensemble dynamique) : tout
          // Allié du Monde du siège en profite. "heroLevel" est figé au Niveau
          // courant au moment de résoudre.
          const n = op.n === "heroLevel" ? heroLevel(rulesCtx(), seat) : op.n;
          dispatch(
            incCounterVerb(seat, heroId, "teamForceMod", n, true),
            say(
              seat,
              `Vos Alliés du Monde gagnent +${n} en Force jusqu'à la fin du tour.`,
            ),
          );
        }
      } else if (op.op === "globalDamageShield") {
        const heroId = state.value.seats[seat].heroInstanceId;
        if (heroId) {
          // « jusqu'au début de votre prochain tour » : actif pendant le tour
          // adverse, purgé à l'entrée de votre tour suivant (numéro + 2).
          dispatch(
            setCounterVerb(
              seat,
              heroId,
              "treveUntilTurn",
              state.value.turn.number + 2,
              true,
            ),
            say(
              seat,
              "Trêve — tous les Dommages sont réduits à 0 jusqu'au début de votre prochain tour.",
            ),
          );
        }
      }
    }
    return false;
  }

  /**
   * Met en file les effets d'apparition d'une carte qui vient d'entrer en
   * jeu (jouée de la main ou mise en jeu par un effet).
   */
  function queueArrivalEffects(
    seat: Seat,
    card: Card | null,
    sourceId?: string,
  ): void {
    if (!assistEffects.value || !card) return;
    for (const atom of arrivalEffects(card)) {
      if (atom.optional) {
        effectChoices.value = [
          ...effectChoices.value,
          {
            seat,
            cardName: card.name,
            text: atom.text,
            ops: atom.ops,
            sourceId,
          },
        ];
        continue;
      }
      dispatch(
        say(seat, `Effet automatique — ${card.name} : « ${atom.text} »`),
      );
      enqueueEffect({ seat, cardName: card.name, ops: atom.ops, sourceId });
    }
  }

  /** Le joueur clique une cible légale : résout l'op puis continue l'effet. */
  function effectTargetChoose(instanceId: string): void {
    const t = effectTargeting.value;
    if (!t || !effectTargetIdsList.value.includes(instanceId)) return;
    effectTargeting.value = null;
    const res =
      t.op.op === "destroyTarget"
        ? resolveDestroyTarget(rulesCtx(), t.seat, instanceId)
        : t.op.op === "healHeroTarget"
          ? resolveHealHeroTarget(rulesCtx(), t.seat, instanceId, t.op.n)
          : t.op.op === "buffForceTarget"
            ? resolveBuffForceTarget(rulesCtx(), t.seat, instanceId, t.op.n)
            : resolveDamageTarget(
                rulesCtx(),
                t.seat,
                instanceId,
                t.op.n,
                t.op.element,
                { mods: activeGlobalMods(rulesCtx()) },
              );
    dispatch(...res.events, ...res.log.map((l) => say(t.seat, l)));
    // 804.7 — bus : déclenchés des Dommages ciblés (riposte… dormant lot F).
    if (assistEffects.value && res.ruleEvents?.length)
      enqueueTriggered(collectTriggeredEffects(rulesCtx(), res.ruleEvents));
    checkVictory();
    pumpEffects();
  }

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
    enqueueEffect({
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

  /** Passe l'op à cible en cours (cible illégale / choix du joueur). */
  function effectTargetSkip(): void {
    const t = effectTargeting.value;
    if (!t) return;
    effectTargeting.value = null;
    dispatch(say(t.seat, `${t.cardName} : ciblage passé.`));
    pumpEffects();
  }

  /** Le joueur accepte (ou refuse) l'effet optionnel en tête de file. */
  function effectChoiceResolve(accept: boolean): void {
    const choice = effectChoices.value[0];
    if (!choice) return;
    effectChoices.value = effectChoices.value.slice(1);
    if (!accept) {
      dispatch(say(choice.seat, `Effet décliné — ${choice.cardName}.`));
      if (choice.declineOps?.length) {
        enqueueEffect({
          seat: choice.seat,
          cardName: choice.cardName,
          ops: choice.declineOps,
          sourceId: choice.sourceId,
        });
      }
      return;
    }
    dispatch(
      say(
        choice.seat,
        `Effet appliqué — ${choice.cardName} : « ${choice.text} »`,
      ),
    );
    enqueueEffect({
      seat: choice.seat,
      cardName: choice.cardName,
      ops: choice.ops,
      sourceId: choice.sourceId,
    });
  }

  function toggleTap(instanceId: string): void {
    const inst = state.value.instances[instanceId];
    if (!inst) return;
    dispatch({
      actor: inst.controller,
      type: "SET_ORIENTATION",
      payload: {
        instanceId,
        orientation: inst.orientation === "tapped" ? "upright" : "tapped",
      },
    });
  }

  function adjustCounter(
    instanceId: string,
    counter: string,
    delta: number,
  ): void {
    const inst = state.value.instances[instanceId];
    if (!inst) return;
    dispatch(incCounterVerb(inst.controller, instanceId, counter, delta));
    checkVictory();
  }

  // ── Combat assisté (702–708) ─────────────────────────────────────────────
  const combat = ref<{
    step: "attackers" | "blockers" | "strikes";
    target: CombatTarget | null;
    attackers: string[];
    blocks: Record<string, string>;
    /** 6105 : attackerId → bloqueur choisi pour encaisser sa Force. */
    strikes: Record<string, string>;
    /** Attaquant dont on choisit actuellement le bloqueur frappé. */
    strikeFor: string | null;
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

  /** Ouvre la déclaration d'attaque (1/tour, jamais au premier tour). */
  function beginCombat(firstAttacker?: string): boolean {
    const err = whyCannotDeclareAttack(
      rulesCtx(),
      perspective.value,
      attackedOnTurn.value,
    );
    if (err) return rejectMove(err);
    combat.value = {
      step: "attackers",
      target: null,
      attackers: [],
      blocks: {},
      strikes: {},
      strikeFor: null,
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
    const t = eligibleTargets(rulesCtx(), perspective.value).find(
      (x) => x.instanceId === instanceId,
    );
    if (t) c.target = t;
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
      enqueueTriggered(collectTriggeredEffects(rulesCtx(), declared));
    return true;
  }

  /** Le défenseur (même écran) assigne un bloqueur à l'attaquant le moins bloqué. */
  function combatToggleBlock(blockerId: string): void {
    const c = combat.value;
    if (!c || c.step !== "blockers" || !c.target) return;
    if (c.blocks[blockerId]) {
      const rest = { ...c.blocks };
      delete rest[blockerId];
      c.blocks = rest;
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
    const counts = new Map<string, number>(c.attackers.map((a) => [a, 0]));
    for (const a of Object.values(c.blocks))
      counts.set(a, (counts.get(a) ?? 0) + 1);
    const least = [...counts.entries()].sort((x, y) => x[1] - y[1])[0]?.[0];
    if (least) c.blocks = { ...c.blocks, [blockerId]: least };
  }

  /**
   * Demande de résolution : si des duels multi-bloqueurs attendent le choix
   * du bloqueur frappé (6105), ouvre l'étape « strikes » ; sinon résout.
   */
  function combatResolve(): void {
    const c = combat.value;
    if (!c || !c.target) return;
    const pending = pendingStrikes(c);
    if (pending.length) {
      c.step = "strikes";
      c.strikeFor = pending[0];
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
      },
      activeGlobalMods(rulesCtx()),
    );
    dispatch(
      ...result.events,
      ...result.log.map((l) => say(turn.value.active, l)),
    );
    // 804.7 — déclenchés des Dommages infligés (après la résolution complète).
    if (assistEffects.value)
      enqueueTriggered(collectTriggeredEffects(rulesCtx(), result.ruleEvents));
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
    combat.value = null;
  }

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

  function drawFromReserve(seat: Seat = perspective.value): void {
    const first = state.value.seats[seat].reserve[0];
    if (first) {
      moveTo(first, { zone: "main", owner: seat });
      enforceHandLimit(seat);
    }
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
    const s = state.value;
    const next = otherSeat(s.turn.active);
    const nextNumber = s.turn.number + 1;
    const drafts: DraftEvent[] = [
      setPhase(next, {
        active: next,
        number: nextNumber,
        phase: "principale",
      }),
    ];
    for (const inst of Object.values(s.instances)) {
      // « jusqu'à la fin du tour » : purge centralisée des jetons temporaires
      // (Force/PA/PM, *CombatMod, Résistance posée, usages de pouvoir, Trêve
      // expirée…) à chaque transition de tour, tout contrôleur. `isTurnToken`
      // tranche au cas par cas (la Trêve traverse le tour adverse).
      for (const [name, value] of Object.entries(inst.counters.tokens ?? {})) {
        if (value && isTurnToken(name, value, nextNumber)) {
          drafts.push(setCounterVerb(next, inst.instanceId, name, 0, true));
        }
      }
      const inPlay =
        inst.location.zone === "monde" || inst.location.zone === "havreSac";
      if (inst.controller !== next || !inPlay) continue;
      if (inst.orientation === "tapped") {
        drafts.push({
          actor: next,
          type: "SET_ORIENTATION",
          payload: { instanceId: inst.instanceId, orientation: "upright" },
        });
      }
      if (inst.counters.damage) {
        drafts.push(setCounterVerb(next, inst.instanceId, "damage", 0));
      }
    }
    dispatch(...drafts);
  }

  function undoLast(): void {
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
    // verbes
    draw,
    moveTo,
    toggleTap,
    adjustCounter,
    drawFromReserve,
    shufflePioche,
    nextTurn,
    undoLast,
    // moteur de règles (R1)
    assist,
    assistEffects,
    online,
    mySeat,
    connectOnline,
    disconnectOnline,
    ruleError,
    clearRuleError,
    playFromHand,
    attackedOnTurn,
    combat,
    combatAttackerIds,
    combatTargetIds,
    combatBlockerIds,
    beginCombat,
    combatToggleAttacker,
    combatChooseTarget,
    combatConfirmAttackers,
    combatToggleBlock,
    combatResolve,
    combatStrikeIds,
    combatChooseStrike,
    combatCancel,
    effectiveForceOf,
    effectChoice,
    effectChoiceResolve,
    effectTargeting,
    effectTargetIdsList,
    effectTargetChoose,
    effectTargetSkip,
    activateTapPower,
    hasTapPower,
    effectPicking,
    effectPickIds,
    effectPick,
    effectPickSkip,
    enqueueEffect,
  };
});
