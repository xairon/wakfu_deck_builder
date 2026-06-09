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
import type { Deck } from "@/types/cards";
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
  sequence,
  setCounter as setCounterVerb,
  incCounter as incCounterVerb,
  setPhase,
  shuffle as shuffleVerb,
  undo as undoVerb,
} from "@/game";

function rndSeed(): string {
  return Math.random().toString(36).slice(2);
}

export type MatchPhase = "lobby" | "mulligan" | "playing" | "finished";

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

  function heroOf(seat: Seat) {
    const id = state.value.seats[seat].heroInstanceId;
    return id ? (state.value.instances[id] ?? null) : null;
  }
  function paOf(seat: Seat): number {
    return heroOf(seat)?.counters.pa ?? 6;
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
  const log = computed<LogLine[]>(() =>
    events.value
      .filter((e) => e.type !== "SAID")
      .map((e) => ({
        seq: e.seq,
        actor: e.actor,
        text: `${labelOf(e.actor)} ${describe(e)}`,
      })),
  );
  function labelOf(actor: Seat | "system"): string {
    return actor === "system" ? "Table" : players.value[actor].name;
  }

  // ── Dispatch bas niveau (local : on est l'autorité) ──────────────────────
  function dispatch(...drafts: DraftEvent[]): void {
    if (!drafts.length) return;
    events.value = [
      ...events.value,
      ...sequence(drafts, gameId.value, state.value.seq + 1),
    ];
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
  function reveal(): void {
    passPending.value = false;
  }

  /** Finit le tour : pioche jusqu'aux PA (règle Wakfu) puis passe la main. */
  function endTurn(): void {
    const active = state.value.turn.active;
    const need = paOf(active) - state.value.seats[active].main.length;
    if (need > 0) draw(active, need);
    nextTurn();
    perspective.value = state.value.turn.active;
    passPending.value = true;
  }

  function concede(seat: Seat): void {
    winner.value = otherSeat(seat);
    matchPhase.value = "finished";
  }

  function quitMatch(): void {
    events.value = [];
    matchPhase.value = "lobby";
    passPending.value = false;
    mulliganSeat.value = null;
    winner.value = null;
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
  }

  function moveTo(
    instanceId: string,
    to: ZoneRef,
    position: Position = { at: "any" },
  ): void {
    const inst = state.value.instances[instanceId];
    if (!inst) return;
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
    dispatch(
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
    );
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
  }

  function drawFromReserve(seat: Seat = perspective.value): void {
    const first = state.value.seats[seat].reserve[0];
    if (first) moveTo(first, { zone: "main", owner: seat });
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
    const drafts: DraftEvent[] = [
      setPhase(next, {
        active: next,
        number: s.turn.number + 1,
        phase: "principale",
      }),
    ];
    for (const inst of Object.values(s.instances)) {
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
  };
});
