/**
 * Galerie de decks publics — publication opt-in d'un deck (decks.is_public +
 * fiche `publication`) et parcours des decks publiés. Lecture ouverte (anon
 * inclus) via `decks_select_public` ; écriture réservée au propriétaire (RLS).
 * Réf. supabase/migrations/0003_public_decks.sql & 0005_deck_publication.sql.
 */
import { supabase } from "./supabase";
import type { CloudDeck } from "./cloudSync";
import type { DeckPublication } from "@/types/cards";

/**
 * Publie / retire un deck dans la galerie, avec sa fiche optionnelle (source,
 * accroche, guide). L'appartenance est garantie par la RLS. `publication` n'est
 * écrite que si fournie (un simple retrait ne l'efface pas).
 */
export async function publishDeck(
  deckId: string,
  isPublic: boolean,
  publication?: DeckPublication,
): Promise<boolean> {
  if (!supabase) return false;
  const patch: Record<string, unknown> = { is_public: isPublic };
  if (publication !== undefined) patch.publication = publication;
  const { error } = await supabase.from("decks").update(patch).eq("id", deckId);
  if (error) {
    console.error("Publication du deck impossible:", error);
    return false;
  }
  return true;
}

/**
 * Charge les decks publics de la communauté (les plus récents d'abord), au
 * format `CloudDeck` (ids de cartes + fiche `publication`) — à convertir pour
 * l'affichage.
 */
export async function loadPublicDecks(limit = 60): Promise<CloudDeck[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("decks")
    .select(
      "id, user_id, name, hero_id, havre_sac_id, cards, publication, created_at, updated_at",
    )
    .eq("is_public", true)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) {
    // Repli silencieux sur la bibliothèque curatée (cf. CommunityDecksView) :
    // on n'effraie pas l'utilisateur, on loggue le message lisible (pas l'objet).
    console.warn(
      "Decks publics indisponibles — repli sur la bibliothèque curatée :",
      error.message ?? error,
    );
    return [];
  }
  return (data ?? []) as CloudDeck[];
}
