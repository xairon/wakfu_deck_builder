// Edge Function : create_game — crée un salon 1v1 (siège A).
// Réf. CdC §5.1 (FR-01..05). L'appelant fournit SON deck (snapshot figé à T0).
import { adminClient, getUserId, makeRoomCode } from "../_shared/auth.ts";
import { json, preflight } from "../_shared/cors.ts";

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

    const { deck, assisted = false } = await req.json();
    if (!deck?.hero || !deck?.havreSac)
      return json({ error: "DECK_INVALIDE" }, 400);
    // La main de départ pioche 6 cartes/siège : un deck dont la Pioche compte
    // < 6 cartes ferait planter la mise en place (cf. join_game). Le client
    // valide 48 cartes ; ceci protège l'API.
    const piocheCount = (
      deck.cards as { quantity?: number; isReserve?: boolean }[] | undefined
    )?.reduce((s, c) => s + (c?.isReserve ? 0 : (c?.quantity ?? 0)), 0);
    if ((piocheCount ?? 0) < 6) return json({ error: "DECK_TROP_PETIT" }, 400);

    const db = adminClient();
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
    if (error) return json({ error: error.message }, 400);

    await db
      .from("game_players")
      .insert({ game_id: game.id, seat: "A", user_id: uid, deck });
    await db
      .from("game_secrets")
      .insert({ game_id: game.id, master_seed: masterSeed });

    return json({ gameId: game.id, code: game.code });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
