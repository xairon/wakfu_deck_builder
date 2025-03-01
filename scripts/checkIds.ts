import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';

interface Card {
  id: string;
  name: string;
  mainType: string;
  extension: {
    name: string;
    number?: string;
  };
}

async function checkIds() {
  try {
    console.log('🔍 Lecture des fichiers JSON...');
    const jsonFiles = await glob('data/*.json');
    const allCards: { [key: string]: Card } = {};
    const duplicateIds: string[] = [];
    const extensionCards: { [key: string]: Card[] } = {};

    for (const jsonFile of jsonFiles) {
      if (jsonFile.includes('failed_downloads')) continue;
      
      console.log(`📖 Lecture de ${jsonFile}...`);
      const content = await fs.readFile(jsonFile, 'utf-8');
      const cards: Card[] = JSON.parse(content);
      const extension = path.basename(jsonFile, '.json');
      
      extensionCards[extension] = cards;
      
      cards.forEach(card => {
        if (allCards[card.id]) {
          duplicateIds.push(card.id);
        }
        allCards[card.id] = card;
      });
    }

    // Vérifier les images existantes
    console.log('\n📝 Lecture des fichiers images...');
    const imagesDir = path.join('data', 'images');
    const existingFiles = new Set(await fs.readdir(imagesDir).then(files => files.filter(file => file.endsWith('.png')).map(file => file.toLowerCase())));

    // Vérifier les cartes par extension
    console.log('\n🔍 Analyse par extension :');
    Object.entries(extensionCards).forEach(([extension, cards]) => {
      console.log(`\n📦 Extension ${extension} :`);
      console.log(`   Total des cartes : ${cards.length}`);
      
      const heroes = cards.filter(card => card.mainType === 'Héros');
      const normalCards = cards.filter(card => card.mainType !== 'Héros');
      
      console.log(`   Héros : ${heroes.length}`);
      console.log(`   Cartes normales : ${normalCards.length}`);
      
      // Vérifier les images des héros
      heroes.forEach(hero => {
        const rectoFile = `${hero.id}_recto.png`.toLowerCase();
        const versoFile = `${hero.id}_verso.png`.toLowerCase();
        
        if (!existingFiles.has(rectoFile)) {
          console.log(`   ❌ Image manquante: ${rectoFile}`);
        }
        if (!existingFiles.has(versoFile)) {
          console.log(`   ❌ Image manquante: ${versoFile}`);
        }
      });

      // Vérifier les images des cartes normales
      normalCards.forEach(card => {
        const imageFile = `${card.id}.png`.toLowerCase();
        if (!existingFiles.has(imageFile)) {
          console.log(`   ❌ Image manquante: ${imageFile}`);
        }
      });
    });

    if (duplicateIds.length > 0) {
      console.log('\n⚠️ IDs en double trouvés :');
      duplicateIds.forEach(id => {
        console.log(`   ${id}`);
      });
    }

    // Vérifier les images orphelines
    const expectedFiles = new Set<string>();
    Object.values(allCards).forEach(card => {
      if (card.mainType === 'Héros') {
        expectedFiles.add(`${card.id}_recto.png`.toLowerCase());
        expectedFiles.add(`${card.id}_verso.png`.toLowerCase());
      } else {
        expectedFiles.add(`${card.id}.png`.toLowerCase());
      }
    });

    const orphanImages = Array.from(existingFiles).filter(file => !expectedFiles.has(file));
    if (orphanImages.length > 0) {
      console.log('\n⚠️ Images orphelines trouvées :');
      orphanImages.forEach(file => {
        console.log(`   ${file}`);
      });
    }

    // Statistiques finales
    const totalHeroes = Object.values(extensionCards).reduce((acc, cards) => acc + cards.filter(card => card.mainType === 'Héros').length, 0);
    const totalNormalCards = Object.values(extensionCards).reduce((acc, cards) => acc + cards.filter(card => card.mainType !== 'Héros').length, 0);
    const totalExpectedImages = totalHeroes * 2 + totalNormalCards;

    console.log('\n📊 Statistiques finales :');
    console.log(`   Total des cartes : ${Object.keys(allCards).length}`);
    console.log(`   Héros : ${totalHeroes} (${totalHeroes * 2} images attendues)`);
    console.log(`   Cartes normales : ${totalNormalCards}`);
    console.log(`   Images attendues : ${totalExpectedImages}`);
    console.log(`   Images existantes : ${existingFiles.size}`);
    console.log(`   Images manquantes : ${totalExpectedImages - existingFiles.size}`);
    console.log(`   Images orphelines : ${orphanImages.length}`);

  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

checkIds(); 