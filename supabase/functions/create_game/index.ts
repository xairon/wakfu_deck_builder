// Edge Function : create_game — crée un salon 1v1 (siège A).
// Réf. CdC §5.1 (FR-01..05). L'appelant fournit SON deck (snapshot figé à T0).
import { adminClient, getUserId, makeRoomCode } from "../_shared/auth.ts";
import { json, preflight } from "../_shared/cors.ts";
import { reconcileAndValidateDeck } from "../_shared/deck.ts";

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(s),
  );
  return Array.from(new Uint8Array(buf), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  try {
    const uid = await getUserId(req);
    if (!uid) return json({ error: "UNAUTHENTICATED" }, 401);

    const { deck: rawDeck, assisted = false } = await req.json();

    const db = adminClient();
    // RÉCONCILIATION + VALIDATION autoritative (C1/M2) : on remplace les stats du
    // snapshot client par celles de la base (anti-forge PV/PA/PM/Résistance) et on
    // refuse un deck illégal (48/réserve/types/copies). On STOCKE le deck
    // réconcilié → tout le setup (setupEvents) part de stats de confiance.
    const rec = await reconcileAndValidateDeck(db, rawDeck);
    if (!rec.ok || !rec.deck) return json({ error: rec.error }, 400);
    const deck = rec.deck;
    const code = makeRoomCode();
    // masterSeed SECRÈTE : seul son hash est public (commit-reveal, §4.4).
    const masterSeed = crypto.randomUUID() + crypto.randomUUID();
    const masterSeedHash = await sha256Hex(masterSeed);

    const { data: game, error } = await db
      .from("games")
      .insert({
        code,
        status: "lobby",
        seat_a: uid,
        master_seed_hash: masterSeedHash,
        assisted: Boolean(assisted),
      })
      .select("id, code")
      .single();
    if (error || !game) {
      console.error("create_game insert games", error);
      return json({ error: "ERREUR_CREATION" }, 500);
    }

    const { error: gpErr } = await db
      .from("game_players")
      .insert({ game_id: game.id, seat: "A", user_id: uid, deck });
    const { error: gsErr } = await db
      .from("game_secrets")
      .insert({ game_id: game.id, master_seed: masterSeed });
    if (gpErr || gsErr) {
      console.error("create_game insert players/secret", gpErr, gsErr);
      // Nettoie le salon orphelin (sinon partie inutilisable sans joueur/secret).
      await db.from("games").delete().eq("id", game.id);
      return json({ error: "ERREUR_CREATION" }, 500);
    }

    return json({ gameId: game.id, code: game.code });
  } catch (e) {
    console.error("create_game", e);
    return json({ error: "ERREUR_SERVEUR" }, 500);
  }
});
