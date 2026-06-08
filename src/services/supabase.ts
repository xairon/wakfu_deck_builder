import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Application cloud-only : sans configuration Supabase, l'app ne peut pas
  // fonctionner. On loggue clairement (l'UI affiche un écran d'erreur dédié).
  console.error(
    "[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants. " +
      "L'application nécessite un backend Supabase configuré.",
  );
}

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // Gère le retour des liens de confirmation d'e-mail / réinitialisation.
          detectSessionInUrl: true,
          flowType: "pkce",
        },
      })
    : null;

/** Vrai si le backend Supabase est configuré (doit l'être en production). */
export const isSupabaseConfigured = () => !!supabase;
