/**
 * Client du module de jeu — appelle les Edge Functions autoritatives et
 * s'abonne au flux Realtime redacté. Réf. docs/GAME-MODULE-V1.md §6, CdC §8.
 *
 * Le client n'a AUCUNE autorité : il propose une intention (DraftEvent) via
 * submitEvent, et reçoit en retour des events redactés (sa vue uniquement).
 */
import { supabase } from "./supabase";
import type { DraftEvent, RedactedEvent, GameIntent } from "@/game";
import type { Seat } from "@/game";

/**
 * Extrait la raison FRANÇAISE d'un échec d'Edge Function. supabase-js range le
 * corps de la réponse non-2xx dans `error.context` (un `Response`) : on y lit
 * le `{ error }` renvoyé par submit_event (403 « Ce n'est pas votre tour. », « PA
 * insuffisants »…) pour l'afficher tel quel. Repli sur le message générique.
 */
async function fnErrorMessage(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.clone === "function") {
    try {
      const body = (await ctx.clone().json()) as { error?: unknown };
      if (body?.error) return String(body.error);
    } catch {
      /* corps non-JSON → message générique */
    }
  }
  return (error as Error)?.message ?? "Erreur réseau";
}

/** Retire le journal redacté du siège appelant depuis `sinceSeq` (résolu côté serveur). */
export async function pullEvents(
  gameId: string,
  sinceSeq: number,
): Promise<RedactedEvent[]> {
  const { data, error } = await client().functions.invoke("pull_events", {
    body: { gameId, sinceSeq },
  });
  if (error) throw error;
  return (data as { events: RedactedEvent[] }).events ?? [];
}

/** Partie ACTIVE de l'utilisateur courant (pour reprise après refresh). */
export async function findMyActiveGame(): Promise<{
  gameId: string;
  seat: Seat;
  assisted: boolean;
} | null> {
  const c = client();
  const { data: auth } = await c.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;
  const { data, error } = await c
    .from("games")
    .select("id, seat_a, seat_b, assisted")
    .or(`seat_a.eq.${uid},seat_b.eq.${uid}`)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    id: string;
    seat_a: string;
    seat_b: string;
    assisted: boolean;
  };
  return {
    gameId: row.id,
    seat: row.seat_a === uid ? "A" : "B",
    assisted: !!row.assisted,
  };
}

export interface CreateGameResult {
  gameId: string;
  code: string;
}
export interface JoinGameResult {
  gameId: string;
  firstPlayer: Seat;
}

function client() {
  if (!supabase) throw new Error("Supabase non configuré");
  return supabase;
}

/**
 * Crée un salon 1v1 avec son deck (siège A). Renvoie le code partageable.
 * `assisted` propage le mode de règles assistées choisi par le créateur :
 * stocké côté serveur et appliqué aux deux clients pour la partie.
 */
export async function createGame(
  deck: unknown,
  assisted = false,
): Promise<CreateGameResult> {
  const { data, error } = await client().functions.invoke("create_game", {
    body: { deck, assisted },
  });
  if (error) throw error;
  return data as CreateGameResult;
}

/** Rejoint un salon par code avec son deck (siège B) ; lance la partie. */
export async function joinGame(
  code: string,
  deck: unknown,
): Promise<JoinGameResult> {
  const { data, error } = await client().functions.invoke("join_game", {
    body: { code, deck },
  });
  if (error) throw error;
  return data as JoinGameResult;
}

/**
 * Résout l'id de partie depuis un code de salon (`games` est lisible par tout
 * utilisateur authentifié). Indispensable côté siège B : il faut s'abonner au
 * flux `game:<id>:B` AVANT d'appeler joinGame, sinon on rate les events de
 * mise en place diffusés pendant joinGame (pas encore de pull_events).
 */
export async function findGameByCode(
  code: string,
): Promise<{ id: string; assisted: boolean } | null> {
  const c = client();
  const { data, error } = await c.rpc("find_game_by_code", {
    p_code: code,
  });
  if (!error) {
    const row = (Array.isArray(data) ? data[0] : data) as {
      id: string;
      assisted: boolean;
    } | null;
    return row ? { id: row.id, assisted: !!row.assisted } : null;
  }

  // Repli direct sur la table `games` si la RPC n'est pas trouvée (ex: 404 / migration non jouée)
  if (typeof c.from === "function") {
    const { data: tblData, error: tblErr } = await c
      .from("games")
      .select("id, assisted")
      .eq("code", code)
      .in("status", ["lobby", "active"])
      .maybeSingle();

    if (!tblErr && tblData) {
      const row = tblData as { id: string; assisted: boolean };
      return { id: row.id, assisted: !!row.assisted };
    }
  }

  throw error;
}

/**
 * Demande un mulligan : le serveur recycle la main, re-mélange (RNG serveur),
 * repioche (n-1) puis marque le siège prêt (MULLIGAN_DONE). Méta-intention
 * expansée serveur — pas un event persisté tel quel.
 */
export async function requestMulligan(gameId: string): Promise<void> {
  const { error } = await client().functions.invoke("submit_event", {
    body: { gameId, draft: { type: "MULLIGAN" } },
  });
  if (error) throw error;
}

/**
 * Abandon : soumet la méta-intention CONCEDE. Le serveur écrit le GAME_OVER
 * (vainqueur = l'autre siège, raison `concede`) et passe la partie en
 * `finished` ; le résultat arrive aux deux clients via le broadcast redacté.
 */
export async function concede(gameId: string): Promise<void> {
  const { error } = await client().functions.invoke("submit_event", {
    body: { gameId, draft: { type: "CONCEDE" } },
  });
  if (error) throw error;
}

/**
 * Réclamation de victoire sur déconnexion adverse : soumet la méta-intention
 * CLAIM_VICTORY. Le serveur écrit le GAME_OVER (vainqueur = siège appelant,
 * raison `disconnect`). Le client garde la fenêtre de grâce (modèle clients de
 * confiance — cf. spec).
 */
export async function claimVictory(gameId: string): Promise<void> {
  const { error } = await client().functions.invoke("submit_event", {
    body: { gameId, draft: { type: "CLAIM_VICTORY" } },
  });
  if (error) throw error;
}

/** Soumet une intention de coup ; le serveur tranche et renvoie le seq. */
export async function submitEvent(
  gameId: string,
  draft: DraftEvent,
): Promise<{ seq: number }> {
  const { data, error } = await client().functions.invoke("submit_event", {
    body: { gameId, draft },
  });
  if (error) throw error;
  return data as { seq: number };
}

/**
 * Soumet une INTENTION de HAUT NIVEAU (contrat server-authoritative P2) : le
 * serveur valide tour → légalité → coût (`resolveIntent`) et applique les events
 * autoritatifs, ou refuse en 403. On relève alors la raison française pour
 * l'afficher (ruleError côté store). Le client n'applique RIEN localement :
 * l'état avance à la réception des echos diffusés.
 */
export async function submitIntent(
  gameId: string,
  intent: GameIntent,
): Promise<void> {
  const { error } = await client().functions.invoke("submit_event", {
    body: { gameId, intent },
  });
  if (error) throw new Error(await fnErrorMessage(error));
}

/**
 * S'abonne au flux REDACTÉ du siège `seat` sur un canal PRIVÉ game:<id>:<seat>.
 * Renvoie une fonction de désabonnement.
 *
 * Présence : chaque siège `track` sa présence sur un canal partagé
 * `game:<id>:presence` ; `onPresence(present)` reflète si l'AUTRE siège est en
 * ligne (sync/join/leave). Sert la fenêtre de grâce sur déconnexion adverse
 * (cf. gameStore). Optionnel pour ne pas casser les abonnements existants.
 */
export function broadcastTargetCard(
  gameId: string,
  seat: Seat,
  instanceId: string | null,
): void {
  const c = client();
  const presenceChannel = c.channel(`game:${gameId}:presence`);
  void presenceChannel.send({
    type: "broadcast",
    event: "card_targeted",
    payload: { seat, instanceId },
  });
}

export function subscribeToGame(
  gameId: string,
  seat: Seat,
  onEvent: (event: RedactedEvent) => void,
  onPresence?: (present: boolean) => void,
  onOpponentTarget?: (instanceId: string | null) => void,
  userName?: string,
  onPlayerName?: (seat: Seat, name: string) => void,
): () => void {
  const c = client();
  const channel = c
    .channel(`game:${gameId}:${seat}`, { config: { private: true } })
    .on("broadcast", { event: "game_event" }, (msg) => {
      onEvent(msg.payload as RedactedEvent);
    })
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error(
          `[gameClient] canal Realtime ${status} : game:${gameId}:${seat}`,
        );
      }
    });

  const other: Seat =
    seat === "A"
      ? "B"
      : seat === "B"
        ? "A"
        : seat === "A1"
          ? "B1"
          : seat === "B1"
            ? "A1"
            : seat === "A2"
              ? "B2"
              : "A2";

  let presence: ReturnType<typeof c.channel> | null = null;
  if (onPresence || onOpponentTarget || onPlayerName) {
    presence = c.channel(`game:${gameId}:presence`, {
      config: { presence: { key: seat } },
    });
    const computeOtherPresent = (): void => {
      if (presence) {
        const stateMap = presence.presenceState() as Record<
          string,
          { userName?: string }[]
        >;
        if (onPresence) {
          onPresence(!!stateMap[other]?.length);
        }
        if (onPlayerName) {
          for (const [s, list] of Object.entries(stateMap)) {
            const name = list?.[0]?.userName;
            if (name) onPlayerName(s as Seat, name);
          }
        }
      }
    };
    presence
      .on("presence", { event: "sync" }, computeOtherPresent)
      .on("presence", { event: "join" }, computeOtherPresent)
      .on("presence", { event: "leave" }, computeOtherPresent)
      .on("broadcast", { event: "card_targeted" }, (msg) => {
        const payload = msg.payload as {
          seat?: Seat;
          instanceId?: string | null;
        };
        if (payload && payload.seat !== seat && onOpponentTarget) {
          onOpponentTarget(payload.instanceId ?? null);
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && presence) {
          void presence.track({ seat, userName });
        }
      });
  }

  return () => {
    void c.removeChannel(channel);
    if (presence) void c.removeChannel(presence);
  };
}

// ── 2v2 Multijoueur en Ligne (Lobby & Matchmaking) ──────────────────────────
export type Seat2v2 = "A1" | "B1" | "A2" | "B2";

export interface Lobby2v2Slot {
  userId?: string;
  userName: string;
  deck: unknown;
  ready: boolean;
}

export interface Lobby2v2State {
  code: string;
  hostSeat: "A1";
  slots: {
    A1: Lobby2v2Slot | null;
    A2: Lobby2v2Slot | null;
    B1: Lobby2v2Slot | null;
    B2: Lobby2v2Slot | null;
  };
  status: "waiting" | "ready" | "started";
  gameId?: string;
}

export interface Lobby2v2Handle {
  broadcastUpdate: (state: Lobby2v2State) => void;
  broadcastClaimSlot: (seat: Seat2v2, slot: Lobby2v2Slot) => void;
  broadcastStart: (
    gameId: string,
    state: Lobby2v2State,
    initialEvents?: unknown[],
  ) => void;
  requestSync: () => void;
  unsubscribe: () => void;
}

/**
 * Diffuse l'état mis à jour du salon 2v2 à tous les participants connectés.
 */
export function broadcast2v2LobbyState(
  code: string,
  state: Lobby2v2State,
): void {
  const c = client();
  const channel = c.channel(`lobby:2v2:${code}`);
  void channel.send({
    type: "broadcast",
    event: "lobby_update",
    payload: state,
  });
}

/**
 * Diffuse le lancement effectif de la partie 2v2 à tous les participants.
 */
export function broadcast2v2GameStart(
  code: string,
  gameId: string,
  state: Lobby2v2State,
  initialEvents?: unknown[],
): void {
  const c = client();
  const channel = c.channel(`lobby:2v2:${code}`);
  void channel.send({
    type: "broadcast",
    event: "game_start",
    payload: { gameId, state, initialEvents },
  });
}

/**
 * S'abonne au canal Realtime d'un salon 2v2 avec gestion bidirectionnelle des slots.
 */
export function subscribeTo2v2Lobby(
  code: string,
  mySeat: Seat,
  callbacks: {
    onUpdate: (state: Lobby2v2State) => void;
    onClaimSlot?: (seat: Seat2v2, slot: Lobby2v2Slot) => void;
    onRequestSync?: () => void;
    onStart: (
      gameId: string,
      state: Lobby2v2State,
      initialEvents?: unknown[],
    ) => void;
  },
): Lobby2v2Handle {
  const c = client();
  const channel = c.channel(`lobby:2v2:${code}`, {
    config: {
      broadcast: { self: true },
      presence: { key: mySeat },
    },
  });

  let isSubscribed = false;
  const sendSafe = (msg: { type: "broadcast"; event: string; payload: unknown }) => {
    if (isSubscribed || channel.state === "joined") {
      void channel.send(msg);
    } else {
      setTimeout(() => {
        void channel.send(msg);
      }, 300);
    }
  };

  channel
    .on("broadcast", { event: "lobby_update" }, (msg) => {
      callbacks.onUpdate(msg.payload as Lobby2v2State);
    })
    .on("broadcast", { event: "claim_slot" }, (msg) => {
      const p = msg.payload as { seat: Seat2v2; slot: Lobby2v2Slot };
      if (p && p.seat && p.slot) {
        callbacks.onClaimSlot?.(p.seat, p.slot);
      }
    })
    .on("broadcast", { event: "request_sync" }, () => {
      callbacks.onRequestSync?.();
    })
    .on("broadcast", { event: "game_start" }, (msg) => {
      const p = msg.payload as {
        gameId: string;
        state: Lobby2v2State;
        initialEvents?: unknown[];
      };
      callbacks.onStart(p.gameId, p.state, p.initialEvents);
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        isSubscribed = true;
        void channel.track({ seat: mySeat });
        void channel.send({
          type: "broadcast",
          event: "request_sync",
          payload: {},
        });
      }
    });

  return {
    broadcastUpdate: (state: Lobby2v2State) => {
      sendSafe({
        type: "broadcast",
        event: "lobby_update",
        payload: state,
      });
    },
    broadcastClaimSlot: (seat: Seat2v2, slot: Lobby2v2Slot) => {
      sendSafe({
        type: "broadcast",
        event: "claim_slot",
        payload: { seat, slot },
      });
    },
    broadcastStart: (
      gameId: string,
      state: Lobby2v2State,
      initialEvents?: unknown[],
    ) => {
      sendSafe({
        type: "broadcast",
        event: "game_start",
        payload: { gameId, state, initialEvents },
      });
    },
    requestSync: () => {
      sendSafe({
        type: "broadcast",
        event: "request_sync",
        payload: {},
      });
    },
    unsubscribe: () => {
      isSubscribed = false;
      void c.removeChannel(channel);
    },
  };
}

/**
 * Crée un transport Realtime pair-à-pair pour la table de jeu 2v2.
 * Permet aux 4 joueurs de diffuser et recevoir directement tous les événements
 * de la partie via Supabase Realtime avec auto-écho et gestion de séquence.
 */
export function create2v2OnlineTransport(
  code: string,
  mySeat: Seat,
  getSeq: () => number = () => 0,
): {
  submit(gameId: string, draft: DraftEvent): Promise<{ seq: number }>;
  pull(gameId: string, sinceSeq: number): Promise<RedactedEvent[]>;
  subscribe(
    gameId: string,
    seat: Seat,
    onEvent: (e: RedactedEvent) => void,
    onPresence?: (present: boolean) => void,
    onOpponentTarget?: (instanceId: string | null) => void,
  ): () => void;
} {
  const c = client();
  const channel = c.channel(`game:2v2:${code}`, {
    config: {
      broadcast: { self: true },
      presence: { key: mySeat },
    },
  });

  let currentSeq = getSeq();
  let isReady = false;

  return {
    async submit(_gameId: string, draft: DraftEvent): Promise<{ seq: number }> {
      currentSeq = Math.max(currentSeq + 1, getSeq() + 1);
      const seq = currentSeq;
      const payload = {
        ...draft,
        seq,
        timestamp: new Date().toISOString(),
      };
      if (!isReady && channel.state !== "joined") {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 500);
          const check = () => {
            if (isReady || channel.state === "joined") {
              clearTimeout(timer);
              resolve();
            } else {
              setTimeout(check, 50);
            }
          };
          check();
        });
      }
      void channel.send({
        type: "broadcast",
        event: "game_event",
        payload,
      });
      return { seq };
    },
    async pull(): Promise<RedactedEvent[]> {
      return [];
    },
    subscribe(
      _gameId: string,
      seat: Seat,
      onEvent: (e: RedactedEvent) => void,
      onPresence?: (present: boolean) => void,
      onOpponentTarget?: (instanceId: string | null) => void,
    ) {
      channel
        .on("broadcast", { event: "game_event" }, (msg) => {
          const ev = msg.payload as RedactedEvent;
          if (ev && typeof ev.seq === "number") {
            currentSeq = Math.max(currentSeq, ev.seq);
          }
          onEvent(ev);
        })
        .on("broadcast", { event: "card_targeted" }, (msg) => {
          const payload = msg.payload as {
            seat?: Seat;
            instanceId?: string | null;
          };
          if (payload && payload.seat !== seat && onOpponentTarget) {
            onOpponentTarget(payload.instanceId ?? null);
          }
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            isReady = true;
            if (onPresence) {
              void channel.track({ seat });
              onPresence(true);
            }
          }
        });

      return () => {
        isReady = false;
        void c.removeChannel(channel);
      };
    },
  };
}

