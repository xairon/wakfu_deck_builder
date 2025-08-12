/**
 * Script pour inspecter les données stockées sur Supabase
 * Utilisé par le système MCP pour permettre à Claude d'analyser les données
 */

import fs from 'fs'
import path from 'path'
import { supabase } from '../src/services/supabase'

// Configuration
const REPORT_PATH = path.join(
  process.cwd(),
  'debug',
  'supabase_data_report.json'
)
const MAX_ITEMS_PER_CATEGORY = 100 // Limiter le nombre d'éléments par catégorie

// Fonction pour inspecter les données Supabase
async function inspectSupabaseData() {
  try {
    console.log('🔍 Inspection des données stockées sur Supabase...')

    // Récupérer la session actuelle
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError) {
      throw sessionError
    }

    // Vérifier si l'utilisateur est authentifié
    if (!session?.user) {
      console.log(
        "❌ Utilisateur non authentifié. Impossible d'inspecter les données."
      )
      return
    }

    // Initialiser le rapport
    const report: any = {
      timestamp: new Date().toISOString(),
      userId: session.user.id,
      userEmail: session.user.email,
      profile: null,
      collections: {
        count: 0,
        items: [],
      },
      decks: {
        count: 0,
        items: [],
      },
      storage: {
        avatars: [],
        other: [],
      },
      stats: {
        totalCardCount: 0,
        uniqueCards: 0,
        foilCards: 0,
        publicDecks: 0,
        privateDecks: 0,
      },
    }

    // 1. Récupérer le profil utilisateur
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (profileError) throw profileError
      report.profile = profileData
    } catch (error: any) {
      console.error('❌ Erreur lors de la récupération du profil:', error)
      report.profile = { error: error.message }
    }

    // 2. Récupérer les données de collection
    try {
      const { data: collectionData, error: collectionError } = await supabase
        .from('collections')
        .select('*')
        .eq('user_id', session.user.id)
        .limit(MAX_ITEMS_PER_CATEGORY)

      if (collectionError) throw collectionError

      report.collections.count = collectionData ? collectionData.length : 0
      report.collections.items = collectionData || []

      // Calculer des statistiques
      if (collectionData) {
        let totalCount = 0
        let foilCount = 0

        collectionData.forEach((item: any) => {
          totalCount += (item.normal_count || 0) + (item.foil_count || 0)
          foilCount += item.foil_count || 0
        })

        report.stats.totalCardCount = totalCount
        report.stats.uniqueCards = collectionData.length
        report.stats.foilCards = foilCount
      }
    } catch (error: any) {
      console.error(
        '❌ Erreur lors de la récupération de la collection:',
        error
      )
      report.collections.error = error.message
    }

    // 3. Récupérer les decks
    try {
      const { data: decksData, error: decksError } = await supabase
        .from('decks')
        .select('*')
        .eq('user_id', session.user.id)
        .limit(MAX_ITEMS_PER_CATEGORY)

      if (decksError) throw decksError

      report.decks.count = decksData ? decksData.length : 0

      // Transformer les données pour le rapport
      if (decksData) {
        let publicDecks = 0
        let privateDecks = 0

        report.decks.items = decksData.map((deck: any) => {
          // Compter les decks publics/privés
          if (deck.is_public) {
            publicDecks++
          } else {
            privateDecks++
          }

          // Calculer le nombre de cartes dans le deck
          let deckCardCount = 0
          if (deck.cards && typeof deck.cards === 'object') {
            const cardsArray = Array.isArray(deck.cards)
              ? deck.cards
              : Object.values(deck.cards)

            deckCardCount = cardsArray.reduce((sum: number, card: any) => {
              return sum + (card.quantity || 0)
            }, 0)
          }

          return {
            id: deck.id,
            name: deck.name,
            is_public: deck.is_public,
            created_at: deck.created_at,
            updated_at: deck.updated_at,
            card_count: deckCardCount,
            has_hero: !!deck.hero,
            has_havre_sac: !!deck.havre_sac,
          }
        })

        report.stats.publicDecks = publicDecks
        report.stats.privateDecks = privateDecks
      }
    } catch (error: any) {
      console.error('❌ Erreur lors de la récupération des decks:', error)
      report.decks.error = error.message
    }

    // 4. Vérifier les fichiers de stockage (avatars)
    try {
      const { data: avatarsData, error: avatarsError } = await supabase.storage
        .from('avatars')
        .list('', {
          limit: 10,
        })

      if (avatarsError) throw avatarsError

      // Filtrer les avatars de l'utilisateur actuel
      report.storage.avatars = (avatarsData || [])
        .filter((file) => file.name.includes(session.user.id))
        .map((file) => ({
          name: file.name,
          size: file.metadata.size,
          created_at: file.created_at,
          mime_type: file.metadata.mimetype,
          is_current: report.profile?.avatar_url?.includes(file.name) || false,
        }))
    } catch (error: any) {
      console.error('❌ Erreur lors de la récupération des avatars:', error)
      report.storage.avatars = { error: error.message }
    }

    // Créer le répertoire de debug s'il n'existe pas
    const debugDir = path.dirname(REPORT_PATH)
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true })
    }

    // Enregistrer le rapport dans un fichier
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8')

    // Afficher un résumé
    console.log('\n📊 Résumé des données Supabase:')
    console.log(`Utilisateur: ${report.userEmail}`)
    console.log(
      `Nom d'utilisateur: ${report.profile?.username || 'Non défini'}`
    )

    console.log(`\nCollection:`)
    console.log(`- ${report.stats.uniqueCards} cartes uniques`)
    console.log(`- ${report.stats.totalCardCount} cartes au total`)
    console.log(`- ${report.stats.foilCards} cartes foil`)

    console.log(`\nDecks:`)
    console.log(`- ${report.decks.count} decks au total`)
    console.log(`- ${report.stats.publicDecks} decks publics`)
    console.log(`- ${report.stats.privateDecks} decks privés`)

    console.log(`\nAvatars: ${report.storage.avatars.length}`)

    console.log(
      `\n✅ Inspection terminée. Rapport enregistré dans: ${REPORT_PATH}`
    )
  } catch (error) {
    console.error("❌ Erreur lors de l'inspection des données Supabase:", error)
  }
}

// Exécuter l'inspection
inspectSupabaseData()
