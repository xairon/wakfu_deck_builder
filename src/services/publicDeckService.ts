/**
 * Galerie de decks publics — publication par SNAPSHOT découplé du deck de
 * travail (table `deck_publications`, migration 0009). Publier fige une copie ;
 * éditer son deck ne touche plus la galerie tant qu'on ne « met à jour ».
 * Lecture ouverte (anon inclus) ; écriture réservée au propriétaire (RLS).
 * Remplace l'ancienne publication « en direct » sur `decks` (0003/0005).
 */
import { supabase } from "./supabase";
import { useAuthStore } from "@/stores/authStore";
import type { Deck, DeckPublication } from "@/types/cards";
import type { SnapshotCard } from "@/utils/publicationSnapshot";

/** Une ligne `deck_publications` : le snapshot publié + sa fiche éditoriale. */
export interface PublishedDeck {
  id: string;
  deck_id: string;
  user_id: string;
  name: string;
  hero_id: string | null;
  havre_sac_id: string | null;
  cards: SnapshotCard[];
  source: string | null;
  tagline: string | null;
  guide: string | null;
  created_at: string;
  updated_at: string;
}

/** Extrait le snapshot de cartes d'un deck de travail (réserve incluse). */
export function snapshotCards(deck: Deck): SnapshotCard[] {
  return (deck.cards ?? []).map((dc) => ({
    cardId: dc.card.id,
    quantity: dc.quantity,
    ...(dc.isReserve ? { isReserve: true as const } : {}),
  }));
}

/**
 * Publie / met à jour un deck dans la galerie : fige un SNAPSHOT de son état
 * courant + la fiche éditoriale. Upsert sur `deck_id` → un seul snapshot par
 * deck. L'appartenance est garantie par la RLS.
 */
export async function publishDeck(
  deck: Deck,
  publication: DeckPublication,
): Promise<boolean> {
  if (!supabase) return false;
  const auth = useAuthStore();
  if (!auth.isAuthenticated || !auth.userId) return false;

  const row = {
    deck_id: deck.id,
    user_id: auth.userId,
    name: deck.name,
    hero_id: deck.hero?.id ?? null,
    havre_sac_id: deck.havreSac?.id ?? null,
    cards: snapshotCards(deck),
    source: publication.source?.trim() || null,
    tagline: publication.tagline?.trim() || null,
    guide: publication.guide?.trim() || null,
  };

  const { error } = await supabase
    .from("deck_publications")
    .upsert(row, { onConflict: "deck_id,user_id" });
  if (error) {
    console.error("Publication du deck impossible:", error.message ?? error);
    return false;
  }
  return true;
}

/** Retire un deck de la galerie (supprime son snapshot). Deck de travail intact. */
export async function unpublishDeck(deckId: string): Promise<boolean> {
  if (!supabase) return false;
  const auth = useAuthStore();
  if (!auth.isAuthenticated || !auth.userId) return false;
  const { error } = await supabase
    .from("deck_publications")
    .delete()
    .eq("deck_id", deckId);
  if (error) {
    console.error("Retrait du deck impossible:", error.message ?? error);
    return false;
  }
  return true;
}

/**
 * Publication existante de MON deck (ou null). Sert à l'état du bouton
 * (Publier / Publié / Mettre à jour) et à la comparaison « modifs en attente ».
 */
export async function getMyPublication(
  deckId: string,
): Promise<PublishedDeck | null> {
  if (!supabase) return null;
  const auth = useAuthStore();
  if (!auth.userId) return null;
  // Filtre aussi par user_id : la lecture est publique (RLS select=true), donc
  // sans ça un deck_id homonyme d'un autre auteur ferait échouer maybeSingle.
  const { data, error } = await supabase
    .from("deck_publications")
    .select("*")
    .eq("deck_id", deckId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (error) {
    console.warn(
      "Lecture de la publication impossible:",
      error.message ?? error,
    );
    return null;
  }
  return (data as PublishedDeck | null) ?? null;
}

/**
 * Charge les decks publics de la communauté (les plus récents d'abord). Repli
 * silencieux sur la bibliothèque curatée si Supabase est indisponible.
 */
export async function loadPublicDecks(limit = 60): Promise<PublishedDeck[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("deck_publications")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn(
      "Decks publics indisponibles — repli sur la bibliothèque curatée :",
      error.message ?? error,
    );
    return [];
  }
  return (data ?? []) as PublishedDeck[];
}
