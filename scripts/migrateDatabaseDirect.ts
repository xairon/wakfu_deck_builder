/**
 * Script pour générer un fichier SQL à exécuter dans l'interface Supabase
 * Cette approche est plus sûre et plus simple que d'essayer d'exécuter
 * le SQL directement via l'API
 */

import fs from 'fs';
import path from 'path';

// Chemin vers le fichier SQL de migration
const MIGRATION_FILE_PATH = path.join(process.cwd(), 'supabase', 'migrations', 'create_tables.sql');
const OUTPUT_FILE_PATH = path.join(process.cwd(), 'debug', 'migration.sql');

// Fonction principale
async function generateMigrationScript() {
  try {
    console.log('🔧 Génération du script de migration...');
    
    // Vérifier si le fichier de migration existe
    if (!fs.existsSync(MIGRATION_FILE_PATH)) {
      throw new Error(`Fichier de migration non trouvé: ${MIGRATION_FILE_PATH}`);
    }
    
    // Lire le fichier SQL
    const sqlContent = fs.readFileSync(MIGRATION_FILE_PATH, 'utf-8');
    console.log(`📄 Fichier de migration lu: ${MIGRATION_FILE_PATH}`);
    
    // Créer le répertoire de debug s'il n'existe pas
    const debugDir = path.dirname(OUTPUT_FILE_PATH);
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    
    // Écrire le contenu dans le fichier de sortie
    fs.writeFileSync(OUTPUT_FILE_PATH, sqlContent, 'utf-8');
    
    console.log(`\n✅ Script de migration généré avec succès: ${OUTPUT_FILE_PATH}`);
    console.log('\n📋 Instructions:');
    console.log('1. Connectez-vous à votre compte Supabase (https://app.supabase.io)');
    console.log('2. Accédez à votre projet');
    console.log('3. Cliquez sur "SQL Editor" dans le menu de gauche');
    console.log('4. Cliquez sur "New Query"');
    console.log(`5. Copiez le contenu du fichier généré (${OUTPUT_FILE_PATH}) dans l'éditeur`);
    console.log('6. Cliquez sur "Run" pour exécuter le script');
    console.log('\n⚠️ Note: Vous devrez peut-être exécuter certaines commandes séparément si elles génèrent des erreurs');
    
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
  }
}

// Exécuter le script
generateMigrationScript(); 