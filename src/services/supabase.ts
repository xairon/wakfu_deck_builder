import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// Vous devrez remplacer ces valeurs par vos identifiants Supabase réels
// Une fois que vous aurez créé votre projet sur https://supabase.com
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Vérification des variables d'environnement
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "Erreur: Les variables d'environnement Supabase ne sont pas définies. " +
    "Assurez-vous de configurer VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans votre fichier .env"
  )
}

export const supabase = createClient<Database>(
  SUPABASE_URL || '', 
  SUPABASE_ANON_KEY || '',
  {
    auth: {
      persistSession: true,
      storageKey: 'wakfu-tcg-auth',
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: localStorage
    }
  }
)

// Helpers pour simplifier l'utilisation de l'authentification
export const auth = {
  /**
   * Inscription d'un nouvel utilisateur
   */
  async signUp(email: string, password: string) {
    return await supabase.auth.signUp({
      email,
      password,
    })
  },

  /**
   * Connexion d'un utilisateur
   */
  async signIn(email: string, password: string) {
    return await supabase.auth.signInWithPassword({
      email,
      password,
    })
  },

  /**
   * Déconnexion de l'utilisateur
   */
  async signOut() {
    return await supabase.auth.signOut()
  },

  /**
   * Récupération de la session actuelle
   */
  async getSession() {
    return await supabase.auth.getSession()
  },

  /**
   * Récupération de l'utilisateur actuel
   */
  async getUser() {
    const { data } = await supabase.auth.getUser()
    return data.user
  }
} 