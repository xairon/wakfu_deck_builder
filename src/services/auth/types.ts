/**
 * Abstraction d'authentification (application cloud).
 *
 * Implémentation : `supabaseAuthProvider` (Supabase Auth). Le `authStore` Pinia
 * ne connaît que cette interface, ce qui isole le reste de l'application du
 * fournisseur sous-jacent.
 */

/** Mode d'authentification courant. */
export type AuthMode = "cloud";

/** Utilisateur normalisé, indépendant du fournisseur. */
export interface AuthUser {
  id: string;
  email: string | null;
}

/** Session normalisée. */
export interface AuthSession {
  user: AuthUser;
  accessToken?: string | null;
}

/** Résultat d'une inscription. */
export interface SignUpResult {
  user: AuthUser | null;
  session: AuthSession | null;
  /** Vrai si l'utilisateur doit confirmer son e-mail avant de se connecter (cloud). */
  needsEmailConfirmation: boolean;
}

/**
 * Contrat commun à tous les fournisseurs d'authentification.
 */
export interface AuthProvider {
  /** `"local"` ou `"cloud"`. */
  readonly mode: AuthMode;

  /** Vrai si ce fournisseur sait envoyer un e-mail de réinitialisation. */
  readonly supportsPasswordReset: boolean;

  /** Récupère la session persistée, ou `null`. */
  getSession(): Promise<AuthSession | null>;

  /**
   * S'abonne aux changements d'état d'authentification.
   * Retourne une fonction de désinscription.
   */
  onAuthStateChange(cb: (session: AuthSession | null) => void): () => void;

  /** Crée un compte. */
  signUp(email: string, password: string): Promise<SignUpResult>;

  /** Connecte un utilisateur existant. */
  signIn(email: string, password: string): Promise<AuthSession>;

  /** Déconnecte l'utilisateur courant. */
  signOut(): Promise<void>;

  /** Envoie un e-mail de réinitialisation (cloud uniquement). */
  resetPassword(email: string): Promise<void>;
}

/** Erreur d'authentification porteuse d'un message destiné à l'UI (en français). */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
