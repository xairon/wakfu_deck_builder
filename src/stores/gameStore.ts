/**
 * gameStore — pilote la table de jeu. Réf. docs/GAME-MODULE-V1.md §7.
 *
 * V1 : mode LOCAL (bac à sable / hot-seat sur une machine) entièrement piloté
 * par le moteur event-sourcé. Le mode EN LIGNE (Edge + Realtime) se branchera
 * ici une fois les fonctions déployées (src/services/gameClient.ts).
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
  sequence,
  setCounter as setCounterVerb,
  incCounter as incCounterVerb,
  setPhase,
  shuffle as shuffleVerb,
  undo as undoVerb,
  omniscientView,
  redactStateFor,
  otherSeat,
} from "@/game";

function rndSeed(): string {
  return Math.random().toString(36).slice(2);
}

export interface LogLine {
  seq: number;
  actor: Seat | "system";
  text: string;
}

const ACTOR_LABEL: Record<Seat | "system", string> = {
  A: "Joueur A",
  B: "Joueur B",
  system: "Table",
};

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
    case "SET_LEVEL":
      return "change le niveau d'une carte.";
    case "SET_COUNTER":
    case "INC_COUNTER":
      return `ajuste « ${String(p.counter)} ».`;
    case "SET_PHASE":
      return `commence le tour ${String(p.number ?? "")}.`;
    case "UNDONE":
      return "annule un coup.";
    default:
      return ev.type;
  }
}

export const useGameStore = defineStore("game", () => {
  // shallowRef : le journal reste un tableau d'objets BRUTS (non proxifiés par
  // Vue) — indispensable car le reducer utilise structuredClone, qui échoue sur
  // les proxies réactifs. On réassigne toujours events.value (jamais de mutation).
  const events = shallowRef<PersistedEvent[]>([]);
  const gameId = ref("local");
  const mode = ref<"local" | "online">("local");
  const mySeat = ref<Seat>("A");
  /** Côté contrôlé par la barre d'outils (bac à sable : on joue les deux). */
  const controlSeat = ref<Seat>("A");
  /** Vue omnisciente (bac à sable) vs vue d'un siège (hot-seat). */
  const omniscient = ref(true);

  const started = computed(() => events.value.length > 0);
  const state = computed<GameState>(() => deriveState(events.value));
  const view = computed<RedactedGameState>(() =>
    omniscient.value
      ? omniscientView(state.value)
      : redactStateFor(state.value, mySeat.value),
  );
  const turn = computed(() => state.value.turn);
  const log = computed<LogLine[]>(() =>
    events.value
      .filter((e) => e.type !== "SAID")
      .map((e) => ({
        seq: e.seq,
        actor: e.actor,
        text: `${ACTOR_LABEL[e.actor]} ${describe(e)}`,
      })),
  );

  // ── Cycle de partie ────────────────────────────────────────────────────────

  function startSandbox(deckA: Deck, deckB: Deck, first: Seat = "A"): void {
    mode.value = "local";
    gameId.value = "local";
    omniscient.value = true;
    controlSeat.value = first;
    const { events: evs } = createGame(
      "local",
      { A: deckA, B: deckB },
      { firstPlayer: first, seedA: rndSeed(), seedB: rndSeed() },
    );
    events.value = evs;
  }

  function reset(): void {
    events.value = [];
  }

  // ── Dispatch (local : on est l'autorité ; en ligne : on proposerait au serveur) ──

  function dispatch(...drafts: DraftEvent[]): void {
    if (!drafts.length) return;
    const start = state.value.seq + 1;
    events.value = [...events.value, ...sequence(drafts, gameId.value, start)];
  }

  // ── Verbes exposés à l'UI ────────────────────────────────────────────────────

  function draw(seat: Seat = controlSeat.value, n = 1): void {
    const drafts: DraftEvent[] = [];
    let working = state.value;
    for (let i = 0; i < n; i++) {
      if (!working.seats[seat].pioche.length) break;
      const d = drawTop(working, seat);
      drafts.push(d);
      working = deriveState([
        ...events.value,
        ...sequence(drafts, gameId.value, working.seq + 1),
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
    counter: "hp" | "damage" | "xp" | "level" | "resistance",
    delta: number,
  ): void {
    const inst = state.value.instances[instanceId];
    if (!inst) return;
    dispatch(incCounterVerb(inst.controller, instanceId, counter, delta));
  }

  function setCounter(
    instanceId: string,
    counter: string,
    value: number,
  ): void {
    const inst = state.value.instances[instanceId];
    if (!inst) return;
    dispatch(setCounterVerb(inst.controller, instanceId, counter, value));
  }

  function shufflePioche(seat: Seat = controlSeat.value): void {
    const size = state.value.seats[seat].pioche.length;
    if (size < 2) return;
    dispatch(
      shuffleVerb(seat, { zone: "pioche", owner: seat }, size, rndSeed()),
    );
  }

  /** Passe le tour : joueur suivant, redresse ses cartes, retire les Dommages. */
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

  /** Annule le dernier coup d'un joueur (journal immuable → event UNDONE). */
  function undoLast(): void {
    for (let i = events.value.length - 1; i >= 0; i--) {
      const e = events.value[i];
      if (
        e.type === "UNDONE" ||
        e.type === "GAME_STARTED" ||
        e.actor === "system"
      )
        continue;
      // déjà annulé ?
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

  function setControlSeat(seat: Seat): void {
    controlSeat.value = seat;
  }
  function toggleOmniscient(): void {
    omniscient.value = !omniscient.value;
  }

  return {
    // état
    events,
    started,
    state,
    view,
    turn,
    log,
    mode,
    mySeat,
    controlSeat,
    omniscient,
    // cycle
    startSandbox,
    reset,
    // verbes
    draw,
    moveTo,
    toggleTap,
    adjustCounter,
    setCounter,
    shufflePioche,
    nextTurn,
    undoLast,
    setControlSeat,
    toggleOmniscient,
  };
});
