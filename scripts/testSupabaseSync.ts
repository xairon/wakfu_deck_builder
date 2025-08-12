/**
 * Script pour tester la synchronisation des données avec Supabase
 * Utilisé par le système MCP pour permettre à Claude de tester la synchronisation
 */

import fs from 'fs'
import path from 'path'
import { supabase } from '../src/services/supabase'
import { createPinia, setActivePinia } from 'pinia'
import { useSupabaseStore } from '../src/stores/supabaseStore'

// Configuration
const REPORT_PATH = path.join(process.cwd(), 'debug', 'sync_test_report.json')

// Initialiser Pinia
setActivePinia(createPinia())

// Test de synchronisation
async function testSupabaseSync() {
  try {
    console.log('🔄 Test de synchronisation des données avec Supabase...')

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
        '❌ Utilisateur non authentifié. Impossible de tester la synchronisation.'
      )
      return
    }

    // Initialiser le store Supabase
    const supabaseStore = useSupabaseStore()

    // Rapport de test
    const report: any = {
      timestamp: new Date().toISOString(),
      userId: session.user.id,
      userEmail: session.user.email,
      storeStatus: {
        isInitialized: false,
        isAuthenticated: false,
        isOnline: false,
        isSyncing: false,
        decksCount: 0,
        collectionCardsCount: 0,
        pendingChangesCount: 0,
      },
      localData: {
        collection: {},
        decks: [],
      },
      remoteData: {
        collection: [],
        decks: [],
      },
      syncResults: {
        success: false,
        errors: [],
        timeElapsed: 0,
        collectionItemsSynced: 0,
        decksSynced: 0,
      },
    }

    // Vérifier l'état actuel du store
    try {
      await supabaseStore.initializeSession()

      report.storeStatus.isInitialized = true
      report.storeStatus.isAuthenticated = supabaseStore.isAuthenticated
      report.storeStatus.isOnline = supabaseStore.isOnline
      report.storeStatus.isSyncing = supabaseStore.isSyncing

      // Récupérer la collection locale et les decks
      report.localData.collection = { ...supabaseStore.collection }
      report.storeStatus.collectionCardsCount = Object.keys(
        report.localData.collection
      ).length

      report.localData.decks = supabaseStore.decks.map((deck) => ({
        id: deck.id,
        name: deck.name,
        cardsCount: deck.cards.length,
        hasHero: !!deck.hero,
        hasHavreSac: !!deck.havreSac,
      }))
      report.storeStatus.decksCount = report.localData.decks.length

      // Vérifier les changements en attente
      if ('pendingChanges' in supabaseStore) {
        const anyStore = supabaseStore as any
        const pendingChanges = anyStore.pendingChanges || []
        report.storeStatus.pendingChangesCount = pendingChanges.length
      }
    } catch (error: any) {
      console.error("❌ Erreur lors de l'initialisation du store:", error)
      report.syncResults.errors.push({
        phase: 'store_initialization',
        message: error.message,
      })
    }

    // Récupérer les données distantes pour comparer
    try {
      // Collection distante
      const { data: collectionData, error: collectionError } = await supabase
        .from('collections')
        .select('*')
        .eq('user_id', session.user.id)

      if (collectionError) throw collectionError
      report.remoteData.collection = collectionData || []

      // Decks distants
      const { data: decksData, error: decksError } = await supabase
        .from('decks')
        .select('*')
        .eq('user_id', session.user.id)

      if (decksError) throw decksError
      report.remoteData.decks = (decksData || []).map((deck: any) => ({
        id: deck.id,
        name: deck.name,
        cardsCount: deck.cards ? Object.keys(deck.cards).length : 0,
        hasHero: !!deck.hero,
        hasHavreSac: !!deck.havre_sac,
        isPublic: deck.is_public,
      }))
    } catch (error: any) {
      console.error(
        '❌ Erreur lors de la récupération des données distantes:',
        error
      )
      report.syncResults.errors.push({
        phase: 'remote_data_fetch',
        message: error.message,
      })
    }

    // Exécuter la synchronisation si en ligne
    if (supabaseStore.isOnline) {
      try {
        console.log('🔄 Démarrage de la synchronisation...')
        const startTime = performance.now()

        // Vérifier si la méthode de synchronisation existe
        if ('synchronizePendingChanges' in supabaseStore) {
          await (supabaseStore as any).synchronizePendingChanges()

          const endTime = performance.now()
          report.syncResults.success = true
          report.syncResults.timeElapsed = Math.round(endTime - startTime)

          // Compter les éléments synchronisés
          const newCollectionState = supabaseStore.collection
          report.syncResults.collectionItemsSynced =
            Object.keys(newCollectionState).length

          report.syncResults.decksSynced = supabaseStore.decks.length

          console.log(
            `✅ Synchronisation réussie en ${report.syncResults.timeElapsed}ms`
          )
        } else {
          throw new Error('Méthode de synchronisation non disponible')
        }
      } catch (error: any) {
        console.error('❌ Erreur lors de la synchronisation:', error)
        report.syncResults.errors.push({
          phase: 'synchronization',
          message: error.message,
        })
      }
    } else {
      console.log(
        '⚠️ Mode hors ligne actif. La synchronisation ne sera pas exécutée.'
      )
      report.syncResults.errors.push({
        phase: 'synchronization',
        message: 'Mode hors ligne actif',
      })
    }

    // Créer le répertoire de debug s'il n'existe pas
    const debugDir = path.dirname(REPORT_PATH)
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true })
    }

    // Enregistrer le rapport dans un fichier
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8')

    // Afficher un résumé
    console.log('\n📊 Résumé du test de synchronisation:')
    console.log(`Session utilisateur: ${report.userEmail}`)
    console.log(
      `Mode en ligne: ${report.storeStatus.isOnline ? '✅ Oui' : '❌ Non'}`
    )
    console.log(
      `Éléments dans la collection locale: ${report.storeStatus.collectionCardsCount}`
    )
    console.log(`Decks locaux: ${report.storeStatus.decksCount}`)
    console.log(
      `Éléments dans la collection distante: ${report.remoteData.collection.length}`
    )
    console.log(`Decks distants: ${report.remoteData.decks.length}`)

    if (report.syncResults.success) {
      console.log(
        `\nSynchronisation: ✅ Réussie (${report.syncResults.timeElapsed}ms)`
      )
      console.log(
        `Cartes synchronisées: ${report.syncResults.collectionItemsSynced}`
      )
      console.log(`Decks synchronisés: ${report.syncResults.decksSynced}`)
    } else {
      console.log(`\nSynchronisation: ❌ Échec`)
      console.log('Erreurs:')
      report.syncResults.errors.forEach((err: any) => {
        console.log(`- [${err.phase}] ${err.message}`)
      })
    }

    console.log(`\n✅ Test terminé. Rapport enregistré dans: ${REPORT_PATH}`)
  } catch (error) {
    console.error('❌ Erreur lors du test de synchronisation:', error)
  }
}

// Exécuter le test
testSupabaseSync()
