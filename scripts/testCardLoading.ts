/**
 * Script pour tester le chargement des cartes depuis les fichiers JSON
 */

import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const EXTENSIONS = [
  "amakna",
  "ankama-convention-5",
  "astrub",
  "bonta-brakmar",
  "chaos-dogrest",
  "dofus-collection",
  "ile-des-wabbits",
  "incarnam",
  "otomai",
  "pandala",
];

async function testCardLoading() {
  console.log("🔍 Test de chargement des cartes...");

  // Vérifier l'existence du dossier data
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`❌ Le dossier 'data' n'existe pas: ${DATA_DIR}`);
    return;
  }

  console.log(`✅ Dossier 'data' trouvé: ${DATA_DIR}`);

  // Compter les fichiers JSON dans le dossier data
  const jsonFiles = fs
    .readdirSync(DATA_DIR)
    .filter((file) => file.endsWith(".json"));
  console.log(`📊 Nombre de fichiers JSON trouvés: ${jsonFiles.length}`);

  if (jsonFiles.length === 0) {
    console.error("❌ Aucun fichier JSON trouvé dans le dossier data");
    return;
  }

  // Vérifier l'existence des fichiers d'extension
  let totalCards = 0;
  const extensionStats = {};

  for (const extension of EXTENSIONS) {
    const filePath = path.join(DATA_DIR, `${extension}.json`);

    if (!fs.existsSync(filePath)) {
      console.error(`❌ Fichier d'extension manquant: ${extension}.json`);
      continue;
    }

    try {
      // Lire le fichier
      const fileContent = fs.readFileSync(filePath, "utf-8");

      // Essayer de parser le JSON
      const cards = JSON.parse(fileContent);

      if (!Array.isArray(cards)) {
        console.error(
          `❌ Le contenu de ${extension}.json n'est pas un tableau`,
        );
        continue;
      }

      extensionStats[extension] = cards.length;
      totalCards += cards.length;

      console.log(`✅ ${extension}.json: ${cards.length} cartes`);

      // Vérifier les premiers éléments
      if (cards.length > 0) {
        const sample = cards.slice(0, 2);
        console.log(`📝 Exemples de cartes dans ${extension}:`);
        sample.forEach((card, index) => {
          console.log(
            `  ${index + 1}. ${card.name || "Sans nom"} (ID: ${card.id || "Sans ID"}, Type: ${card.mainType || "Sans type"})`,
          );
        });
      }
    } catch (error) {
      console.error(
        `❌ Erreur lors du traitement de ${extension}.json:`,
        error.message,
      );
    }
  }

  console.log(`\n📊 Résumé:`);
  console.log(`Total des cartes: ${totalCards}`);
  console.log(
    `Extensions: ${Object.keys(extensionStats).length}/${EXTENSIONS.length}`,
  );

  // Vérifier également le fichier de collection
  try {
    const collectionPath = path.join(DATA_DIR, "collection.json");
    if (fs.existsSync(collectionPath)) {
      const collectionContent = fs.readFileSync(collectionPath, "utf-8");
      const collection = JSON.parse(collectionContent);

      console.log(`\n📊 Collection:`);
      console.log(`Taille du fichier: ${collectionContent.length} caractères`);
      console.log(`Nombre d'entrées: ${Object.keys(collection).length}`);
    } else {
      console.log(`\n⚠️ Le fichier collection.json n'existe pas ou est vide`);
    }
  } catch (error) {
    console.error(
      `❌ Erreur lors de la vérification de collection.json:`,
      error.message,
    );
  }
}

// Exécuter le test
testCardLoading();
