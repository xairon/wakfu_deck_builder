import { supabase } from "@/services/supabase";
import { useAuthStore } from "@/stores/authStore";
import type { Card, Deck, DeckCard } from "@/types/cards";

export interface CloudCollection {
  user_id: string;
  card_id: string;
  normal_quantity: number;
  foil_quantity: number;
  updated_at: string;
}

export interface CloudDeck {
  id: string;
  user_id: string;
  name: string;
  hero_id: string | null;
  havre_sac_id: string | null;
  cards: Array<{ cardId: string; quantity: number; isReserve?: boolean }>;
  created_at: string;
  updated_at: string;
}

export async function saveCollectionToCloud(
  collection: Record<string, { normal: number; foil: number }>,
) {
  if (!supabase) return false;
  const authStore = useAuthStore();
  if (!authStore.isAuthenticated || !authStore.userId) return false;

  try {
    const entries = Object.entries(collection).map(([cardId, qty]) => ({
      user_id: authStore.userId,
      card_id: cardId,
      normal_quantity: qty.normal,
      foil_quantity: qty.foil,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("collections")
      .upsert(entries, { onConflict: "user_id,card_id" });

    return !error;
  } catch {
    return false;
  }
}

export async function loadCollectionFromCloud(): Promise<Record<
  string,
  { normal: number; foil: number }
> | null> {
  if (!supabase) return null;
  const authStore = useAuthStore();
  if (!authStore.isAuthenticated || !authStore.userId) return null;

  try {
    const { data, error } = await supabase
      .from("collections")
      .select("card_id, normal_quantity, foil_quantity")
      .eq("user_id", authStore.userId);

    if (error || !data) return null;

    const collection: Record<string, { normal: number; foil: number }> = {};
    for (const row of data) {
      collection[row.card_id] = {
        normal: row.normal_quantity,
        foil: row.foil_quantity,
      };
    }
    return collection;
  } catch {
    return null;
  }
}

export async function saveDecksToCloud(decks: CloudDeck[]) {
  if (!supabase) return false;
  const authStore = useAuthStore();
  if (!authStore.isAuthenticated || !authStore.userId) return false;

  try {
    // On conserve l'updated_at propre à chaque deck (le trigger SQL
    // set_updated_at met à jour les lignes réellement modifiées).
    const entries = decks.map((deck) => ({
      ...deck,
      user_id: authStore.userId,
    }));

    const { error } = await supabase
      .from("decks")
      .upsert(entries, { onConflict: "id,user_id" });

    return !error;
  } catch {
    return false;
  }
}

export async function loadDecksFromCloud(): Promise<CloudDeck[] | null> {
  if (!supabase) return null;
  const authStore = useAuthStore();
  if (!authStore.isAuthenticated || !authStore.userId) return null;

  try {
    const { data, error } = await supabase
      .from("decks")
      .select("*")
      .eq("user_id", authStore.userId)
      .order("updated_at", { ascending: false });

    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

export async function deleteDeckFromCloud(deckId: string): Promise<boolean> {
  if (!supabase) return false;
  const authStore = useAuthStore();
  if (!authStore.isAuthenticated || !authStore.userId) return false;

  try {
    const { error } = await supabase
      .from("decks")
      .delete()
      .eq("id", deckId)
      .eq("user_id", authStore.userId);
    return !error;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Conversions Deck (local, cartes complètes) <-> CloudDeck (ids + quantités)
// ---------------------------------------------------------------------------

/** Convertit un deck local vers le format stocké en base. */
export function deckToCloud(deck: Deck, userId: string): CloudDeck {
  const cards: CloudDeck["cards"] = [];
  for (const dc of deck.cards ?? []) {
    cards.push({ cardId: dc.card.id, quantity: dc.quantity });
  }
  for (const dc of deck.reserve ?? []) {
    cards.push({ cardId: dc.card.id, quantity: dc.quantity, isReserve: true });
  }
  const now = new Date().toISOString();
  return {
    id: deck.id,
    user_id: userId,
    name: deck.name,
    hero_id: deck.hero?.id ?? null,
    havre_sac_id: deck.havreSac?.id ?? null,
    cards,
    created_at: deck.createdAt ?? now,
    updated_at: deck.updatedAt ?? now,
  };
}

/**
 * Reconstruit un deck local depuis le format base, en résolvant chaque id de
 * carte via `resolveCard` (catalogue chargé). Les cartes introuvables sont
 * ignorées.
 */
export function cloudToDeck(
  cloud: CloudDeck,
  resolveCard: (id: string) => Card | undefined,
): Deck {
  const main: DeckCard[] = [];
  const reserve: DeckCard[] = [];
  for (const c of cloud.cards ?? []) {
    const card = resolveCard(c.cardId);
    if (!card) continue;
    const entry: DeckCard = { card, quantity: c.quantity };
    if (c.isReserve) reserve.push(entry);
    else main.push(entry);
  }
  return {
    id: cloud.id,
    name: cloud.name,
    hero: cloud.hero_id ? (resolveCard(cloud.hero_id) ?? null) : null,
    havreSac: cloud.havre_sac_id
      ? (resolveCard(cloud.havre_sac_id) ?? null)
      : null,
    cards: main,
    reserve,
    createdAt: cloud.created_at,
    updatedAt: cloud.updated_at,
  } as Deck;
}
