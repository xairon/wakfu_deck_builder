// Edge Function : pull_events — renvoie le journal REDACTÉ par siège depuis sinceSeq.
// Filet de sécurité (rattrapage / reconnexion) : le client reconstruit sa vue.
import { adminClient, getUserId } from "../_shared/auth.ts";
import { json, preflight } from "../_shared/cors.ts";
import { deriveState } from "../../../src/game/engine/reducer.ts";
import { redactEventForSeat } from "../../../src/game/engine/authority.ts";
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
    const { gameId, sinceSeq } = await req.json();
    const since = typeof sinceSeq === "number" ? sinceSeq : 0;
    const db = adminClient();

    const { data: me } = await db
      .from("game_players")
      .select("seat")
      .eq("game_id", gameId)
      .eq("user_id", uid)
      .single();
    if (!me) return json({ error: "PAS_JOUEUR_DE_CETTE_PARTIE" }, 403);

    const { data: rows } = await db
      .from("game_events")
      .select("*")
      .eq("game_id", gameId)
      .order("seq", { ascending: true });

    const all = (rows ?? []).map(rowToEvent);
    const out = [];
    const acc: PersistedEvent[] = [];
    let pre = deriveState(acc);
    for (const ev of all) {
      const post = deriveState([...acc, ev]);
      if (ev.seq > since) out.push(redactEventForSeat(ev, me.seat, pre, post));
      acc.push(ev);
      pre = post;
    }
    return json({ events: out });
  } catch (e) {
    console.error("pull_events", e);
    return json({ error: "ERREUR_SERVEUR" }, 500);
  }
});
