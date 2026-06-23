// Helper Edge (Deno) : charge les données de cartes côté serveur depuis la
// table `cards` pour la validation autoritative des règles (coûts, types).
// `Card` est un import de TYPE (élidé à la compilation → Deno-safe, n'entraîne
// aucun alias `@/` runtime dans le bundle).
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { Card } from "../../../src/types/cards.ts";

/** Charge les cartes référencées (par id) en une Map id→Card pour getCard. */
export async function loadCards(
  db: SupabaseClient,
  ids: string[],
): Promise<Map<string, Card>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, Card>();
  for (let i = 0; i < uniq.length; i += 500) {
    const { data, error } = await db
      .from("cards")
      .select("id, data")
      .in("id", uniq.slice(i, i + 500));
    if (error) throw new Error(error.message);
    for (const r of data ?? []) map.set(r.id as string, r.data as Card);
  }
  return map;
}
