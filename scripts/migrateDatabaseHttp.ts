/**
 * Script pour exécuter les migrations SQL via l'API HTTP de Supabase
 * Utilise l'API REST de Supabase avec votre clé service (pas la clé anon)
 */

import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'
import * as dotenv from 'dotenv'

// Charger les variables d'environnement
dotenv.config()

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
  let inBlockComment = false
  let inStringLiteral = false

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i]
    const nextChar = sql[i + 1] || ''
    const prevChar = sql[i - 1] || ''

    // Gérer les commentaires sur une ligne
    if (
      char === '-' &&
      nextChar === '-' &&
      !inStringLiteral &&
      !inBlockComment
    ) {
      inComment = true
      currentQuery += char
      continue
    }

    // Gérer les commentaires sur plusieurs lignes
    if (char === '/' && nextChar === '*' && !inStringLiteral && !inComment) {
      inBlockComment = true
      currentQuery += char
      continue
    }

    if (char === '*' && nextChar === '/' && inBlockComment) {
      inBlockComment = false
      currentQuery += char + nextChar
      i++ // Sauter le prochain caractère
      continue
    }

    // Fin de ligne = fin de commentaire sur une ligne
    if (inComment && (char === '\n' || char === '\r')) {
      inComment = false
      currentQuery += char
      continue
    }

    // Gérer les chaînes de caractères
    if (char === "'" && !inComment && !inBlockComment) {
      if (prevChar !== '\\') {
        // Ne pas compter les apostrophes échappées
        inStringLiteral = !inStringLiteral
      }
      currentQuery += char
      continue
    }

    // Si on est dans un commentaire ou une chaîne, ajouter le caractère et continuer
    if (inComment || inBlockComment || inStringLiteral) {
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

// Fonction principale pour migrer la base de données
async function migrateDatabase() {
  try {
    console.log("🔄 Migration de la base de données via l'API REST Supabase...")

    // Vérifier si on a les paramètres nécessaires
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("❌ Variables d'environnement manquantes.")
      console.error(
        "Assurez-vous d'avoir défini VITE_SUPABASE_URL et SUPABASE_SERVICE_KEY dans votre fichier .env"
      )

      console.log('\n⚠️ Pour obtenir votre clé de service:')
      console.log('1. Connectez-vous à votre compte Supabase')
      console.log('2. Accédez à votre projet')
      console.log('3. Cliquez sur "Project Settings" dans le menu de gauche')
      console.log('4. Cliquez sur "API" dans le sous-menu')
      console.log(
        '5. Recherchez "service_role key" (NE PAS utiliser la clé anon)'
      )
      console.log('\nAjoutez ensuite cette clé dans votre fichier .env:')
      console.log('SUPABASE_SERVICE_KEY=votre-clé-service-ici')

      // Générer le script SQL à la place
      console.log('\n🔄 Génération du script SQL à la place...')
      const scriptPath = path.join(process.cwd(), 'debug', 'migration.sql')
      if (fs.existsSync(MIGRATION_FILE_PATH)) {
        const debugDir = path.dirname(scriptPath)
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true })
        }

        fs.copyFileSync(MIGRATION_FILE_PATH, scriptPath)
        console.log(`✅ Script SQL généré: ${scriptPath}`)
        console.log(
          "Exécutez ce script manuellement dans l'éditeur SQL de Supabase."
        )
      }

      return
    }

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

    // URL pour l'API SQL de Supabase
    const sqlUrl = `${supabaseUrl}/rest/v1/sql`

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

        // Exécuter la requête SQL via l'API REST
        const response = await fetch(sqlUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ query }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Erreur HTTP ${response.status}: ${errorText}`)
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
