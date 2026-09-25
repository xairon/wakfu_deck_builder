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
  upvote_count?: number;
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
 * Charge les decks publics de la communauté (les plus upvotés puis les plus récents).
 * Repli silencieux sur la bibliothèque curatée si Supabase est indisponible.
 */
export async function loadPublicDecks(limit = 100): Promise<PublishedDeck[]> {
  if (!supabase) return [];

  // Essai avec tri par upvote_count (migration 0016)
  try {
    let query: any = supabase
      .from("deck_publications")
      .select("*")
      .order("upvote_count", { ascending: false });

    if (typeof query.order === "function") {
      query = query.order("updated_at", { ascending: false });
    }

    const { data, error } = await query.limit(limit);
    if (!error && data) {
      return data as PublishedDeck[];
    }
  } catch {
    /* fallback ci-dessous */
  }

  // Repli si upvote_count n'existe pas encore sur la base distante
  try {
    const fallbackQuery: any = supabase
      .from("deck_publications")
      .select("*")
      .order("updated_at", { ascending: false });
    const { data, error } = await fallbackQuery.limit(limit);
    if (error) {
      console.warn(
        "Decks publics indisponibles — repli sur la bibliothèque curatée :",
        error.message ?? error,
      );
      return [];
    }
    return (data ?? []) as PublishedDeck[];
  } catch (err) {
    console.warn("Échec requête fallback decks publics:", err);
    return [];
  }
}

/** Bascule le upvote d'un deck pour l'utilisateur connecté (optimiste / RPC). */
export async function toggleDeckUpvote(
  deckId: string,
): Promise<{ upvoted: boolean; upvoteCount: number } | null> {
  if (!supabase) return null;
  const auth = useAuthStore();
  if (!auth.isAuthenticated || !auth.userId) return null;

  try {
    const { data, error } = await supabase.rpc("toggle_deck_upvote", {
      p_deck_id: deckId,
    });
    if (error) {
      console.warn("Échec toggle upvote via RPC:", error.message ?? error);
      return null;
    }
    return data as { upvoted: boolean; upvoteCount: number };
  } catch (err) {
    console.warn("Erreur toggle_deck_upvote:", err);
    return null;
  }
}

/** Récupère l'ensemble des deckId upvotés par l'utilisateur connecté. */
export async function getUserUpvotedDeckIds(): Promise<Set<string>> {
  if (!supabase) return new Set();
  const auth = useAuthStore();
  if (!auth.isAuthenticated || !auth.userId) return new Set();

  try {
    const { data, error } = await supabase
      .from("deck_upvotes")
      .select("deck_id")
      .eq("user_id", auth.userId);
    if (error || !data) return new Set();
    return new Set(data.map((row: { deck_id: string }) => row.deck_id));
  } catch {
    return new Set();
  }
}

