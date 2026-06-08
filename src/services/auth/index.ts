/**
 * Point d'entrée de la couche d'authentification (cloud-only, Supabase).
 *
 * L'application est une application web : l'authentification et les données
 * passent toujours par Supabase. Le reste du code n'utilise que
 * `getAuthProvider()`, jamais l'implémentation directement.
 */

import { isSupabaseConfigured } from "@/services/supabase";
import type { AuthProvider } from "./types";
import { createSupabaseAuthProvider } from "./supabaseAuthProvider";

export type {
  AuthProvider,
  AuthSession,
  AuthUser,
  SignUpResult,
} from "./types";
export { AuthError } from "./types";

/**
 * Retourne le fournisseur d'authentification Supabase.
 * Lève une erreur explicite si Supabase n'est pas configuré (mauvais déploiement).
 */
export function getAuthProvider(): AuthProvider {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase n'est pas configuré (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).",
    );
  }
  return createSupabaseAuthProvider();
}
