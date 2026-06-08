/**
 * Script pour inspecter l'état actuel des stores Pinia
 * Utilisé par le système MCP pour permettre à Claude d'accéder à l'état de l'application
 */

import fs from "fs";
import path from "path";
import * as glob from "glob";

// Configuration
const STORES_DIR = path.join(process.cwd(), "src", "stores");
const STORE_SNAPSHOT_PATH = path.join(
  process.cwd(),
  "debug",
  "store_snapshot.json",
);

// Fonction pour analyser les fichiers de store
async function analyzeStores() {
  try {
    // Vérifier si le dossier des stores existe
    if (!fs.existsSync(STORES_DIR)) {
      console.error(`❌ Le dossier des stores n'existe pas: ${STORES_DIR}`);
      return;
    }

    // Récupérer tous les fichiers de store (avec extension .ts ou .js)
    const storeFiles = glob.sync(path.join(STORES_DIR, "**/*.{ts,js}"));

    // Filtrer les fichiers qui ne sont pas des tests
    const filteredStoreFiles = storeFiles.filter(
      (file) => !file.includes("__tests__"),
    );

    if (filteredStoreFiles.length === 0) {
      console.log("❓ Aucun fichier de store trouvé.");
      return;
    }

    console.log(
      `🔍 Analyse de ${filteredStoreFiles.length} fichiers de store Pinia...`,
    );

    const storeAnalysis: Record<string, any> = {};

    // Analyser chaque fichier de store
    for (const storeFile of filteredStoreFiles) {
      const relativePath = path.relative(process.cwd(), storeFile);
      const storeContent = fs.readFileSync(storeFile, "utf-8");

      // Extraire le nom du store - format Composition API: defineStore('name', () => {...})
      const storeNameMatch = storeContent.match(
        /defineStore\(['"]([\w-]+)['"]/,
      );
      const storeName = storeNameMatch
        ? storeNameMatch[1]
        : path.basename(storeFile, path.extname(storeFile));

      console.log(`  Analyse du store: ${storeName} (${relativePath})`);

      // Extraire les références (ref, reactive, etc.)
      const stateRefs: Record<string, string> = {};

      // Format Composition API: const name = ref<Type>(initialValue)
      const refMatches = storeContent.matchAll(
        /const\s+(\w+)\s*=\s*(?:ref|reactive|useLocalStorage)<([^>]*)>\(([^)]*)\)/g,
      );
      for (const match of Array.from(refMatches)) {
        const [_, name, type, initialValue] = match;
        stateRefs[name] = `${type} (${initialValue.trim()})`;
      }

      // Format sans type: const name = ref(initialValue)
      const simpleRefMatches = storeContent.matchAll(
        /const\s+(\w+)\s*=\s*(?:ref|reactive|useLocalStorage)\(([^)]*)\)/g,
      );
      for (const match of Array.from(simpleRefMatches)) {
        const [_, name, initialValue] = match;
        if (!stateRefs[name]) {
          stateRefs[name] = `any (${initialValue.trim()})`;
        }
      }

      // Extraire les getters (computed)
      const getters: string[] = [];
      const computedMatches = storeContent.matchAll(
        /const\s+(\w+)\s*=\s*computed\(/g,
      );
      for (const match of Array.from(computedMatches)) {
        getters.push(match[1]);
      }

      // Extraire les actions (fonctions)
      const actions: string[] = [];
      const functionMatches = storeContent.matchAll(
        /(?:async\s+)?function\s+(\w+)\s*\([^)]*\)/g,
      );
      for (const match of Array.from(functionMatches)) {
        actions.push(match[1]);
      }

      // Extraire les fonctions fléchées (arrow functions)
      const arrowFunctionMatches = storeContent.matchAll(
        /const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g,
      );
      for (const match of Array.from(arrowFunctionMatches)) {
        actions.push(match[1]);
      }

      // Ajouter les données analysées à l'objet d'analyse
      storeAnalysis[storeName] = {
        file: relativePath,
        state: stateRefs,
        getters,
        actions,
      };
    }

    // Créer le répertoire de debug s'il n'existe pas
    const debugDir = path.dirname(STORE_SNAPSHOT_PATH);
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }

    // Enregistrer les résultats dans un fichier
    fs.writeFileSync(
      STORE_SNAPSHOT_PATH,
      JSON.stringify(storeAnalysis, null, 2),
      "utf-8",
    );

    console.log(
      `\n✅ Analyse des stores terminée. Résultats enregistrés dans: ${STORE_SNAPSHOT_PATH}`,
    );

    // Afficher un résumé
    console.log("\n📊 Résumé des stores:");
    for (const [storeName, storeData] of Object.entries(storeAnalysis)) {
      console.log(`\n🔹 Store: ${storeName} (${storeData.file})`);
      console.log(
        `  - État: ${Object.keys(storeData.state).length} propriétés`,
      );
      console.log(`  - Getters: ${storeData.getters.length}`);
      console.log(`  - Actions: ${storeData.actions.length}`);
    }

    // Afficher les détails du premier store pour référence
    const firstStore = Object.entries(storeAnalysis)[0];
    if (firstStore) {
      const [storeName, storeData] = firstStore;
      console.log(`\n🔍 Détails du store '${storeName}':`);
      console.log("  État:");
      for (const [prop, type] of Object.entries(storeData.state)) {
        console.log(`    - ${prop}: ${type}`);
      }

      if (storeData.getters.length > 0) {
        console.log("\n  Getters:");
        for (const getter of storeData.getters) {
          console.log(`    - ${getter}`);
        }
      }

      if (storeData.actions.length > 0) {
        console.log("\n  Actions:");
        for (const action of storeData.actions) {
          console.log(`    - ${action}()`);
        }
      }
    }
  } catch (error) {
    console.error("❌ Erreur lors de l'analyse des stores:", error);
  }
}

// Exécuter l'analyse
analyzeStores();
