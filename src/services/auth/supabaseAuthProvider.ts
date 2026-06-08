/**
 * Fournisseur d'authentification cloud, adossé à Supabase Auth.
 *
 * Activé automatiquement dès que Supabase est configuré (cf. `getAuthProvider`).
 * Mappe les types Supabase (`User`, `Session`) vers nos types normalisés.
 */

import type {
  Session as SupabaseSession,
  User as SupabaseUser,
} from "@supabase/supabase-js";
import { supabase } from "@/services/supabase";
import {
  AuthError,
  type AuthProvider,
  type AuthSession,
  type AuthUser,
  type SignUpResult,
} from "./types";

function mapUser(user: SupabaseUser | null | undefined): AuthUser | null {
  if (!user) return null;
  return { id: user.id, email: user.email ?? null };
}

function mapSession(
  session: SupabaseSession | null | undefined,
): AuthSession | null {
  if (!session?.user) return null;
  return {
    user: mapUser(session.user)!,
    accessToken: session.access_token ?? null,
  };
}

export function createSupabaseAuthProvider(): AuthProvider {
  if (!supabase) {
    // Ne devrait jamais arriver : ce fournisseur n'est instancié que si
    // Supabase est configuré.
    throw new Error("Supabase client indisponible.");
  }
  const client = supabase;

  return {
    mode: "cloud",
    supportsPasswordReset: true,

    async getSession(): Promise<AuthSession | null> {
      const { data } = await client.auth.getSession();
      return mapSession(data.session);
    },

    onAuthStateChange(cb): () => void {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        cb(mapSession(session));
      });
      return () => data.subscription.unsubscribe();
    },

    async signUp(email: string, password: string): Promise<SignUpResult> {
      // Le lien de confirmation doit revenir sur /auth, où detectSessionInUrl
      // + onAuthStateChange finalisent la session (cohérent avec resetPassword).
      const emailRedirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth`
          : undefined;
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo },
      });
      if (error) throw new AuthError(error.message);
      return {
        user: mapUser(data.user),
        session: mapSession(data.session),
        // Supabase ne renvoie pas de session quand la confirmation e-mail est requise.
        needsEmailConfirmation: !data.session,
      };
    },

    async signIn(email: string, password: string): Promise<AuthSession> {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw new AuthError(error.message);
      const session = mapSession(data.session);
      if (!session) throw new AuthError("Session introuvable après connexion");
      return session;
    },

    async signOut(): Promise<void> {
      const { error } = await client.auth.signOut();
      if (error) throw new AuthError(error.message);
    },

    async resetPassword(email: string): Promise<void> {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth`
          : undefined;
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) throw new AuthError(error.message);
    },
  };
}
