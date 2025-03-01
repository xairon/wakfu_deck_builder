/**
 * Script pour configurer la fonction SQL exec_sql dans Supabase
 * Cette fonction est nécessaire pour exécuter des requêtes SQL arbitraires via l'API
 */

import { supabase } from './supabaseClient';

async function setupSqlExecFunction() {
  try {
    console.log('🔧 Configuration de la fonction SQL exec_sql dans Supabase...');
    
    // Vérifier si l'utilisateur a les droits d'administrateur
    console.log('⚠️ Cette opération nécessite des droits d\'administrateur sur votre base de données Supabase.');
    console.log('⚠️ La fonction créée permettra l\'exécution de requêtes SQL arbitraires, à utiliser avec précaution.');
    
    // Définir la fonction SQL qui permet d'exécuter du SQL arbitraire
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION exec_sql(query text)
      RETURNS VOID
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        EXECUTE query;
      END;
      $$;
    `;
    
    // Exécuter le SQL directement via l'API REST
    const response = await fetch(`${supabase.supabaseUrl}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabase.supabaseKey,
        'Authorization': `Bearer ${supabase.supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        query: createFunctionSQL
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Erreur lors de la création de la fonction: ${error}`);
    }
    
    console.log('✅ Fonction exec_sql créée avec succès dans Supabase.');
    console.log('🔑 Vous pouvez maintenant exécuter le script de migration principale.');
    
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    console.log('\n📝 Alternative: Vous pouvez exécuter ce SQL manuellement dans l\'éditeur SQL de Supabase:');
    console.log(`
      CREATE OR REPLACE FUNCTION exec_sql(query text)
      RETURNS VOID
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        EXECUTE query;
      END;
      $$;
    `);
  }
}

// Exécuter la configuration
setupSqlExecFunction(); 