/**
 * Script pour exécuter automatiquement les migrations SQL sur Supabase
 * Ce script lit le fichier create_tables.sql et l'exécute sur la base de données Supabase
 */

import fs from 'fs'
import path from 'path'
import { supabase } from './supabaseClient'

// Chemin vers le fichier SQL de migration
const MIGRATION_FILE_PATH = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  'create_tables.sql'
)

// Fonction pour diviser un script SQL en requêtes individuelles
function splitSqlQueries(sql: string): string[] {
  // Diviser le script par point-virgule, mais ignorer les points-virgules dans les commentaires et les chaînes
  const queries: string[] = []
  let currentQuery = ''
  let inComment = false
  let inStringLiteral = false

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i]
    const nextChar = sql[i + 1] || ''

    // Gérer les commentaires
    if (char === '-' && nextChar === '-' && !inStringLiteral) {
      inComment = true
      currentQuery += char
      continue
    }

    // Fin de ligne = fin de commentaire
    if (inComment && (char === '\n' || char === '\r')) {
      inComment = false
      currentQuery += char
      continue
    }

    // Gérer les chaînes de caractères
    if (char === "'" && !inComment) {
      inStringLiteral = !inStringLiteral
      currentQuery += char
      continue
    }

    // Si on est dans un commentaire ou une chaîne, ajouter le caractère et continuer
    if (inComment || inStringLiteral) {
      currentQuery += char
      continue
    }

    // Fin de requête
    if (char === ';') {
      currentQuery += char
      const trimmedQuery = currentQuery.trim()
      if (trimmedQuery.length > 1) {
        // Éviter les requêtes vides
        queries.push(trimmedQuery)
      }
      currentQuery = ''
      continue
    }

    // Ajouter le caractère à la requête en cours
    currentQuery += char
  }

  // Ajouter la dernière requête si elle existe et n'est pas vide
  const trimmedQuery = currentQuery.trim()
  if (trimmedQuery.length > 0 && !trimmedQuery.match(/^\s*$/)) {
    queries.push(trimmedQuery)
  }

  return queries
}

// Fonction pour exécuter les migrations
async function migrateDatabase() {
  try {
    console.log('🔄 Migration de la base de données Supabase...')

    // Vérifier si le fichier de migration existe
    if (!fs.existsSync(MIGRATION_FILE_PATH)) {
      throw new Error(`Fichier de migration non trouvé: ${MIGRATION_FILE_PATH}`)
    }

    // Lire le fichier SQL
    const sqlContent = fs.readFileSync(MIGRATION_FILE_PATH, 'utf-8')
    console.log(`📄 Fichier de migration lu: ${MIGRATION_FILE_PATH}`)

    // Diviser le script en requêtes individuelles
    const queries = splitSqlQueries(sqlContent)
    console.log(`🔢 Nombre de requêtes à exécuter: ${queries.length}`)

    // Exécuter chaque requête séquentiellement
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i]
      const truncatedQuery =
        query.length > 100 ? query.substring(0, 100) + '...' : query

      try {
        console.log(
          `\n⏳ Exécution de la requête ${i + 1}/${queries.length}: ${truncatedQuery}`
        )

        // Exécuter la requête SQL
        const { error } = await supabase.rpc('exec_sql', { query })

        if (error) {
          throw error
        }

        console.log(`✅ Requête ${i + 1} exécutée avec succès`)
        successCount++
      } catch (error: any) {
        console.error(
          `❌ Erreur lors de l'exécution de la requête ${i + 1}:`,
          error.message
        )
        errorCount++

        // Afficher la requête complète en cas d'erreur
        console.error('Requête complète:', query)

        // Si c'est une erreur de duplicat ou que la table existe déjà, on peut continuer
        if (
          error.message.includes('already exists') ||
          error.message.includes('duplicate')
        ) {
          console.log('⚠️ Cet objet existe déjà, nous continuons...')
        } else {
          // Pour les autres erreurs, demander si on veut continuer
          const response = await new Promise<string>((resolve) => {
            console.log("Voulez-vous continuer malgré l'erreur? (O/N)")
            process.stdin.once('data', (data) => {
              resolve(data.toString().trim().toLowerCase())
            })
          })

          if (
            response !== 'o' &&
            response !== 'oui' &&
            response !== 'y' &&
            response !== 'yes'
          ) {
            throw new Error("Migration interrompue par l'utilisateur")
          }
        }
      }
    }

    console.log(
      `\n✅ Migration terminée avec ${successCount} succès et ${errorCount} erreurs.`
    )
  } catch (error: any) {
    console.error('❌ Erreur lors de la migration:', error.message)
  }
}

// Exécuter la migration
migrateDatabase()
