import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

interface ImageMapping {
  cards: {
    [url: string]: {
      id: string;
      filename: string;
      path: string;
    };
  };
}

interface Card {
  id: string;
  mainType: string;
  name: string;
}

async function migrateImages() {
  // Charger le mapping des images
  const imageMapping = JSON.parse(fs.readFileSync('public/cartes/image_mapping.json', 'utf-8'));

  // Charger les données des cartes
  const cardFiles = ['incarnam', 'ile-des-wabbits'];
  const cards: Card[] = [];
  
  for (const file of cardFiles) {
    const cardData = JSON.parse(fs.readFileSync(`data/${file}.json`, 'utf-8'));
    cards.push(...cardData);
  }

  // Créer le répertoire de destination s'il n'existe pas
  const destDir = 'public/images/cards_new';
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // Obtenir la liste des fichiers existants
  const existingFiles = fs.readdirSync('public/images/cards');

  // Traiter chaque carte
  let processedCount = 0;
  const totalCards = cards.length;

  for (const card of cards) {
    try {
      // Trouver le fichier correspondant
      const cardName = card.name.toLowerCase()
        .replace(/[éèêë]/g, 'e')
        .replace(/[àâä]/g, 'a')
        .replace(/[ïî]/g, 'i')
        .replace(/[ôö]/g, 'o')
        .replace(/[ûüù]/g, 'u')
        .replace(/[ç]/g, 'c')
        .replace(/[^a-z0-9]/g, '');

      const sourceFile = existingFiles.find(file => 
        file.toLowerCase().replace(/\.webp$/, '') === cardName
      );

      if (!sourceFile) {
        console.warn(`⚠️ Image non trouvée pour ${card.name} (${cardName})`);
        continue;
      }

      const sourceImagePath = `public/images/cards/${sourceFile}`;
      const destPath = `public/images/cards_new/${card.id.toLowerCase()}.webp`;

      // Copier l'image
      await sharp(sourceImagePath)
        .webp({ quality: 90 })
        .toFile(destPath);

      // Si c'est un héros, créer aussi l'image verso
      if (card.mainType === 'Héros') {
        const versoPath = `public/images/cards_new/${card.id.toLowerCase()}_verso.webp`;
        await sharp(sourceImagePath)
          .webp({ quality: 90 })
          .toFile(versoPath);
      }

      console.log(`✅ ${card.name}`);
      processedCount++;

      if (processedCount % 10 === 0) {
        console.log(`Progress: ${processedCount}/${totalCards} (${Math.round((processedCount / totalCards) * 100)}%)`);
      }
    } catch (error) {
      console.error(`❌ Erreur lors du traitement de ${card.name}:`, error);
    }
  }

  console.log('\nMigration terminée :');
  console.log(`✅ ${processedCount} images traitées`);
  console.log(`⚠️ ${totalCards - processedCount} images manquantes`);
}

migrateImages().catch(console.error); 