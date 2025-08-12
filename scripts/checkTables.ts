/**
 * Script pour vérifier l'existence des tables dans Supabase
 */

import { supabase } from './supabaseClient'

async function checkTables() {
  console.log('🔍 Vérification des tables dans Supabase...')

  try {
    // Vérifier la table profiles
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('count')

    console.log('\n📊 Table "profiles":')
    if (profilesError) {
      console.error(`❌ Erreur: ${profilesError.message}`)
    } else {
      console.log('✅ Table existante')
    }

    // Vérifier la table collections
    const { data: collectionsData, error: collectionsError } = await supabase
      .from('collections')
      .select('count')

    console.log('\n📊 Table "collections":')
    if (collectionsError) {
      console.error(`❌ Erreur: ${collectionsError.message}`)
    } else {
      console.log('✅ Table existante')
    }

    // Vérifier la table decks
    const { data: decksData, error: decksError } = await supabase
      .from('decks')
      .select('count')

    console.log('\n📊 Table "decks":')
    if (decksError) {
      console.error(`❌ Erreur: ${decksError.message}`)
    } else {
      console.log('✅ Table existante')
    }

    console.log('\n✅ Vérification des tables terminée.')
  } catch (error) {
    console.error('❌ Erreur lors de la vérification des tables:', error)
  }
}

// Exécuter la vérification
checkTables()
