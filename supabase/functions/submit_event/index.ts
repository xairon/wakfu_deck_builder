// Edge Function : submit_event — UNIQUE chemin d'écriture autoritatif (§6.3).
// 1. authentifie l'appelant → son siège ; 2. dérive l'état depuis le journal ;
// 3. calcule l'event autoritatif (RNG serveur, redaction) ; 4. append atomique ;
// 5. diffuse l'event REDACTÉ à chaque siège. Le client ne décide jamais le coup.
import { adminClient, getUserId } from "../_shared/auth.ts";
import { json, preflight } from "../_shared/cors.ts";
import { deriveState } from "../../../src/game/engine/reducer.ts";
import {
  resolveDraft,
  redactEventForBroadcast,
} from "../../../src/game/engine/authority.ts";
import type { PersistedEvent } from "../../../src/game/types/events.ts";

function rowToEvent(r: Record<string, unknown>): PersistedEvent {
  return {
    gameId: r.game_id as string,
    seq: r.seq as number,
    parentSeq: r.parent_seq as number,
    actor: r.actor as PersistedEvent["actor"],
    type: r.type as PersistedEvent["type"],
    payload: r.payload,
    payloadPrivate:
      (r.payload_private as PersistedEvent["payloadPrivate"]) ?? undefined,
    ts: 0,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  try {
    const uid = await getUserId(req);
    if (!uid) return json({ error: "UNAUTHENTICATED" }, 401);

    const { gameId, draft } = await req.json();
    const db = adminClient();

    // Siège de l'appelant (sécurité : l'acteur est imposé par le serveur).
    const { data: me } = await db
      .from("game_players")
      .select("seat")
      .eq("game_id", gameId)
      .eq("user_id", uid)
      .single();
    if (!me) return json({ error: "PAS_JOUEUR_DE_CETTE_PARTIE" }, 403);

    const { data: game } = await db
      .from("games")
      .select("last_seq, status")
      .eq("id", gameId)
      .single();
    if (!game || game.status !== "active")
      return json({ error: "PARTIE_INACTIVE" }, 409);

    const { data: secret } = await db
      .from("game_secrets")
      .select("master_seed")
      .eq("game_id", gameId)
      .single();
    const { data: rows } = await db
      .from("game_events")
      .select("*")
      .eq("game_id", gameId)
      .order("seq", { ascending: true });

    const state = deriveState((rows ?? []).map(rowToEvent));

    // L'acteur est FORCÉ au siège authentifié (on ne fait pas confiance au client).
    const ev = resolveDraft(
      state,
      { ...draft, actor: me.seat },
      {
        gameId,
        seq: state.seq + 1,
        ts: Date.now(),
        masterSeed: secret!.master_seed,
      },
    );

    const { error: appendErr } = await db.rpc("append_event", {
      p_game_id: gameId,
      p_parent_seq: state.seq,
      p_actor: ev.actor,
      p_type: ev.type,
      p_payload: ev.payload,
      p_payload_private: ev.payloadPrivate ?? null,
    });
    if (appendErr) return json({ error: appendErr.message }, 409); // OUT_OF_ORDER → resync client

    for (const seat of ["A", "B"] as const) {
      await db.channel(`game:${gameId}:${seat}`).send({
        type: "broadcast",
        event: "game_event",
        payload: redactEventForBroadcast(ev, seat),
      });
    }
    await db.channel(`game:${gameId}:spectator`).send({
      type: "broadcast",
      event: "game_event",
      payload: redactEventForBroadcast(ev, "spectator"),
    });

    return json({ seq: ev.seq });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
