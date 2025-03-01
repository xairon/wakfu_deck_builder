/**
 * Script avancé pour exécuter les migrations SQL
 * Utilise node-postgres pour se connecter directement à la base de données Supabase
 * NOTE: Ce script nécessite l'installation du package pg: npm install pg
 */

import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config();

// Chemin vers le fichier SQL de migration
const MIGRATION_FILE_PATH = path.join(process.cwd(), 'supabase', 'migrations', 'create_tables.sql');

// Configuration de la connexion PostgreSQL
// Ces informations sont disponibles dans les paramètres de projet Supabase
// sous Database > Connection string > Connection parameters
const DB_CONFIG = {
  host: process.env.PG_HOST || '',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || '',
  user: process.env.PG_USER || '',
  password: process.env.PG_PASSWORD || '',
  ssl: true
};

// Fonction pour diviser un script SQL en requêtes individuelles
function splitSqlQueries(sql: string): string[] {
  // Diviser le script par point-virgule, mais ignorer les points-virgules dans les commentaires et les chaînes
  const queries: string[] = [];
  let currentQuery = '';
  let inComment = false;
  let inBlockComment = false;
  let inStringLiteral = false;
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1] || '';
    const prevChar = sql[i - 1] || '';
    
    // Gérer les commentaires sur une ligne
    if (char === '-' && nextChar === '-' && !inStringLiteral && !inBlockComment) {
      inComment = true;
      currentQuery += char;
      continue;
    }
    
    // Gérer les commentaires sur plusieurs lignes
    if (char === '/' && nextChar === '*' && !inStringLiteral && !inComment) {
      inBlockComment = true;
      currentQuery += char;
      continue;
    }
    
    if (char === '*' && nextChar === '/' && inBlockComment) {
      inBlockComment = false;
      currentQuery += char + nextChar;
      i++; // Sauter le prochain caractère
      continue;
    }
    
    // Fin de ligne = fin de commentaire sur une ligne
    if (inComment && (char === '\n' || char === '\r')) {
      inComment = false;
      currentQuery += char;
      continue;
    }
    
    // Gérer les chaînes de caractères
    if (char === "'" && !inComment && !inBlockComment) {
      if (prevChar !== '\\') { // Ne pas compter les apostrophes échappées
        inStringLiteral = !inStringLiteral;
      }
      currentQuery += char;
      continue;
    }
    
    // Si on est dans un commentaire ou une chaîne, ajouter le caractère et continuer
    if (inComment || inBlockComment || inStringLiteral) {
      currentQuery += char;
      continue;
    }
    
    // Fin de requête
    if (char === ';') {
      currentQuery += char;
      const trimmedQuery = currentQuery.trim();
      if (trimmedQuery.length > 1) { // Éviter les requêtes vides
        queries.push(trimmedQuery);
      }
      currentQuery = '';
      continue;
    }
    
    // Ajouter le caractère à la requête en cours
    currentQuery += char;
  }
  
  // Ajouter la dernière requête si elle existe et n'est pas vide
  const trimmedQuery = currentQuery.trim();
  if (trimmedQuery.length > 0 && !trimmedQuery.match(/^\s*$/)) {
    queries.push(trimmedQuery);
  }
  
  return queries;
}

// Fonction pour exécuter les migrations
async function migrateDatabase() {
  // Vérifier si les informations de connexion sont définies
  if (!DB_CONFIG.host || !DB_CONFIG.user || !DB_CONFIG.password || !DB_CONFIG.database) {
    console.error('❌ Informations de connexion PostgreSQL manquantes. Veuillez définir les variables d\'environnement:');
    console.error('PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD');
    
    console.log('\n⚠️ Ajoutez ces variables dans votre fichier .env:');
    console.log(`
PG_HOST=db.xxxxxxxxxxx.supabase.co
PG_PORT=5432
PG_DATABASE=postgres
PG_USER=postgres
PG_PASSWORD=votre-mot-de-passe
    `);
    
    console.log('\n📝 Instructions pour obtenir ces informations:');
    console.log('1. Connectez-vous à votre compte Supabase (https://app.supabase.io)');
    console.log('2. Accédez à votre projet');
    console.log('3. Cliquez sur "Project Settings" dans le menu de gauche');
    console.log('4. Cliquez sur "Database" dans le sous-menu');
    console.log('5. Faites défiler jusqu\'à "Connection string" puis cliquez sur "Connection parameters"');
    
    // Générer le script SQL à la place
    console.log('\n🔄 Génération du script SQL à la place...');
    const scriptPath = path.join(process.cwd(), 'debug', 'migration.sql');
    if (fs.existsSync(MIGRATION_FILE_PATH)) {
      // Créer le répertoire de debug s'il n'existe pas
      const debugDir = path.dirname(scriptPath);
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      
      fs.copyFileSync(MIGRATION_FILE_PATH, scriptPath);
      console.log(`✅ Script SQL généré: ${scriptPath}`);
      console.log('Exécutez ce script manuellement dans l\'éditeur SQL de Supabase.');
    }
    
    return;
  }
  
  const client = new Client(DB_CONFIG);
  
  try {
    console.log('🔄 Migration de la base de données PostgreSQL...');
    
    // Vérifier si le fichier de migration existe
    if (!fs.existsSync(MIGRATION_FILE_PATH)) {
      throw new Error(`Fichier de migration non trouvé: ${MIGRATION_FILE_PATH}`);
    }
    
    // Lire le fichier SQL
    const sqlContent = fs.readFileSync(MIGRATION_FILE_PATH, 'utf-8');
    console.log(`📄 Fichier de migration lu: ${MIGRATION_FILE_PATH}`);
    
    // Diviser le script en requêtes individuelles
    const queries = splitSqlQueries(sqlContent);
    console.log(`🔢 Nombre de requêtes à exécuter: ${queries.length}`);
    
    // Se connecter à la base de données
    console.log('🔌 Connexion à la base de données PostgreSQL...');
    await client.connect();
    console.log('✅ Connexion établie.');
    
    // Exécuter chaque requête séquentiellement
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      const truncatedQuery = query.length > 100 ? query.substring(0, 100) + '...' : query;
      
      try {
        console.log(`\n⏳ Exécution de la requête ${i + 1}/${queries.length}: ${truncatedQuery}`);
        
        // Exécuter la requête SQL
        await client.query(query);
        
        console.log(`✅ Requête ${i + 1} exécutée avec succès`);
        successCount++;
      } catch (error: any) {
        console.error(`❌ Erreur lors de l'exécution de la requête ${i + 1}:`, error.message);
        errorCount++;
        
        // Si c'est une erreur de duplicat ou que la table existe déjà, on peut continuer
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log('⚠️ Cet objet existe déjà, nous continuons...');
        } else {
          // Pour les autres erreurs, demander si on veut continuer
          const response = await new Promise<string>(resolve => {
            console.log('Voulez-vous continuer malgré l\'erreur? (O/N)');
            process.stdin.once('data', data => {
              resolve(data.toString().trim().toLowerCase());
            });
          });
          
          if (response !== 'o' && response !== 'oui' && response !== 'y' && response !== 'yes') {
            throw new Error('Migration interrompue par l\'utilisateur');
          }
        }
      }
    }
    
    console.log(`\n✅ Migration terminée avec ${successCount} succès et ${errorCount} erreurs.`);
    
  } catch (error: any) {
    console.error('❌ Erreur lors de la migration:', error.message);
  } finally {
    // Fermer la connexion
    await client.end();
    console.log('🔌 Connexion fermée.');
  }
}

// Exécuter la migration
migrateDatabase(); 