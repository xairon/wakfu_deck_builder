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

async function countCards() {
  try {
    const jsonFiles = await glob('data/*.json');
    const extensionCounts: { [key: string]: number } = {};
    const heroes: { id: string; name: string; extension: string }[] = [];
    let totalCards = 0;
    let totalExpectedImages = 0;

    for (const file of jsonFiles) {
      if (file.includes('failed_downloads')) continue;
      
      const content = await fs.readFile(file, 'utf-8');
      const cards = JSON.parse(content) as Card[];
      
      const extension = path.basename(file, '.json');
      extensionCounts[extension] = cards.length;
      totalCards += cards.length;

      // Collecter les informations sur les héros
      for (const card of cards) {
        if (card.mainType === 'Héros') {
          heroes.push({
            id: card.id,
            name: card.name,
            extension: extension
          });
          totalExpectedImages += 2; // recto + verso
        } else {
          totalExpectedImages++;
        }
      }
    }

    console.log('\nNombre de cartes par extension :');
    Object.entries(extensionCounts).forEach(([ext, count]) => {
      console.log(`${ext}: ${count} cartes`);
    });

    console.log('\nListe des héros :');
    heroes.forEach(hero => {
      console.log(`- ${hero.name} (${hero.extension}) [${hero.id}]`);
      console.log(`  Images attendues: ${hero.id}_recto.png, ${hero.id}_verso.png`);
    });

    console.log(`\nTotal des cartes: ${totalCards}`);
    console.log(`Nombre de héros: ${heroes.length}`);
    console.log(`Nombre total d'images attendues: ${totalExpectedImages}`);

    // Vérifier les images existantes
    const imagesDir = path.join('data', 'images');
    const existingImages = await fs.readdir(imagesDir).then(files => files.filter(file => file.endsWith('.png')));
    console.log(`Nombre d'images existantes: ${existingImages.length}`);
    console.log(`Images manquantes: ${totalExpectedImages - existingImages.length}`);

  } catch (error) {
    console.error('Erreur:', error);
  }
}

countCards(); 