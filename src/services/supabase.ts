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

if (typeof window !== "undefined" && supabase) {
  let lastCheck = 0;
  // Maintient la session active lors du retour sur l'onglet ou du focus fenêtre
  // pour éviter l'expiration due au throttling des timers JS par les navigateurs.
  const refreshIfNearExpiry = async () => {
    const nowMs = Date.now();
    if (nowMs - lastCheck < 60_000) return;
    lastCheck = nowMs;
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        const expiresAt = data.session.expires_at;
        const now = Math.floor(nowMs / 1000);
        // Si le token expire dans moins de 15 minutes, rafraîchir proactivement
        if (expiresAt && expiresAt - now < 900) {
          await supabase.auth.refreshSession();
        }
      }
    } catch {
      /* ignore */
    }
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void refreshIfNearExpiry();
    }
  });

  window.addEventListener("focus", () => {
    void refreshIfNearExpiry();
  });
}

