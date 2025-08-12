/**
 * Script pour vérifier l'état d'authentification Supabase
 * Utilisé par le système MCP pour permettre à Claude de vérifier l'état de l'authentification
 */

// Charger les variables d'environnement
import * as dotenv from 'dotenv'
dotenv.config()

import fs from 'fs'
import path from 'path'
import { supabase } from './supabaseClient'

// Configuration
const REPORT_PATH = path.join(process.cwd(), 'debug', 'auth_status_report.json')

// Fonction pour vérifier l'état d'authentification
async function checkAuthStatus() {
  try {
    console.log("🔍 Vérification de l'état d'authentification Supabase...")

    // Récupérer la session actuelle
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError) {
      throw sessionError
    }

    // Initialiser le rapport
    const report: any = {
      timestamp: new Date().toISOString(),
      hasSession: !!session,
      isAuthenticated: !!session?.user,
      user: null,
      profile: null,
      tokenExpiresAt: null,
      persistentData: {
        hasLocalStorage: false,
        localStorageItems: [],
      },
    }

    // Ajouter les informations utilisateur si disponibles
    if (session?.user) {
      report.user = {
        id: session.user.id,
        email: session.user.email,
        emailConfirmed: session.user.email_confirmed_at !== null,
        lastSignIn: session.user.last_sign_in_at,
        createdAt: session.user.created_at,
        authProvider: session.user.app_metadata?.provider || 'email',
      }

      report.tokenExpiresAt = new Date(session.expires_at! * 1000).toISOString()

      // Récupérer le profil utilisateur
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (!profileError && profileData) {
        report.profile = profileData
      } else {
        report.profileError = profileError
          ? profileError.message
          : 'Profil non trouvé'
      }
    }

    // Vérifier les données de localStorage
    if (typeof localStorage !== 'undefined') {
      report.persistentData.hasLocalStorage = true

      // Rechercher les clés Supabase dans localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.includes('supabase') || key.includes('sb-'))) {
          try {
            const value = localStorage.getItem(key)
            report.persistentData.localStorageItems.push({
              key,
              size: value ? value.length : 0,
              type: typeof value,
            })
          } catch (e) {
            report.persistentData.localStorageItems.push({
              key,
              error: 'Impossible de lire la valeur',
            })
          }
        }
      }
    }

    // Créer le répertoire de debug s'il n'existe pas
    const debugDir = path.dirname(REPORT_PATH)
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true })
    }

    // Enregistrer le rapport dans un fichier
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8')

    // Afficher les informations
    console.log("\n📊 État d'authentification:")
    console.log(`Authentifié: ${report.isAuthenticated ? '✅ Oui' : '❌ Non'}`)

    if (report.isAuthenticated) {
      console.log(`\nUtilisateur: ${report.user.email}`)
      console.log(`ID: ${report.user.id}`)
      console.log(
        `Email confirmé: ${report.user.emailConfirmed ? '✅ Oui' : '❌ Non'}`
      )
      console.log(
        `Session expire: ${new Date(session.expires_at! * 1000).toLocaleString()}`
      )

      if (report.profile) {
        console.log(`\nProfil: ${report.profile.username || '[Sans nom]'}`)
      } else {
        console.log(`\nProfil: ❌ Non trouvé`)
      }
    }

    console.log(
      `\n✅ Vérification terminée. Rapport enregistré dans: ${REPORT_PATH}`
    )
  } catch (error) {
    console.error(
      "❌ Erreur lors de la vérification de l'authentification:",
      error
    )
  }
}

// Exécuter la vérification
checkAuthStatus()
