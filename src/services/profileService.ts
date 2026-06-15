/**
 * Profils publics — un pseudo réutilisable par utilisateur (auteur des decks
 * publiés, futur nom en partie en ligne). Lecture ouverte (anon inclus) ;
 * écriture réservée au propriétaire (RLS). Réf. supabase/migrations/0004_profiles.sql.
 */
import { supabase } from "./supabase";
import { useAuthStore } from "@/stores/authStore";

/** Pseudo de l'utilisateur courant, ou null si non défini / hors-ligne. */
export async function getMyProfile(): Promise<{ username: string } | null> {
  if (!supabase) return null;
  const authStore = useAuthStore();
  if (!authStore.userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("username")
    .eq("user_id", authStore.userId)
    .maybeSingle();
  if (error) {
    console.error("Lecture du profil impossible:", error);
    return null;
  }
  return data ? { username: (data as { username: string }).username } : null;
}

/** Définit / met à jour le pseudo public. Renvoie l'erreur lisible si échec. */
export async function setUsername(
  username: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase)
    return { ok: false, error: "Service indisponible (hors-ligne)." };
  const authStore = useAuthStore();
  if (!authStore.userId) return { ok: false, error: "Connecte-toi d'abord." };
  const clean = username.trim();
  if (clean.length < 2 || clean.length > 24)
    return { ok: false, error: "Le pseudo doit faire 2 à 24 caractères." };
  const { error } = await supabase
    .from("profiles")
    .upsert(
      { user_id: authStore.userId, username: clean },
      { onConflict: "user_id" },
    );
  if (error) {
    if (error.code === "23505")
      return { ok: false, error: "Ce pseudo est déjà pris." };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Résout des pseudos par user_id (pour afficher les auteurs dans la galerie). */
export async function getUsernames(
  userIds: string[],
): Promise<Record<string, string>> {
  if (!supabase || !userIds.length) return {};
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, username")
    .in("user_id", [...new Set(userIds)]);
  if (error || !data) return {};
  const map: Record<string, string> = {};
  for (const r of data as { user_id: string; username: string }[])
    map[r.user_id] = r.username;
  return map;
}
