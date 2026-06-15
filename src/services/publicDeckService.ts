/**
 * Galerie de decks publics — publication opt-in d'un deck (decks.is_public) et
 * parcours des decks publiés par la communauté. Lecture ouverte (anon inclus)
 * via la policy `decks_select_public` ; publication réservée au propriétaire
 * (RLS `decks_update_own`). Réf. supabase/migrations/0003_public_decks.sql.
 */
import { supabase } from "./supabase";
import type { CloudDeck } from "./cloudSync";

/**
 * Publie (ou retire) un deck dans la galerie. L'appartenance est garantie par
 * la RLS (un client ne peut modifier que ses propres decks). Renvoie `false`
 * si Supabase est absent ou en cas d'erreur.
 */
export async function setDeckPublic(
  deckId: string,
  isPublic: boolean,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("decks")
    .update({ is_public: isPublic })
    .eq("id", deckId);
  if (error) {
    console.error("Publication du deck impossible:", error);
    return false;
  }
  return true;
}

/**
 * Charge les decks publics de la communauté (les plus récents d'abord), au
 * format `CloudDeck` (ids de cartes + quantités) — à convertir pour l'affichage.
 */
export async function loadPublicDecks(limit = 60): Promise<CloudDeck[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("decks")
    .select(
      "id, user_id, name, hero_id, havre_sac_id, cards, created_at, updated_at",
    )
    .eq("is_public", true)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("Chargement des decks publics impossible:", error);
    return [];
  }
  return (data ?? []) as CloudDeck[];
}
