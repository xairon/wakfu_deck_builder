import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';

interface Card {
  id: string;
  name: string;
  extension: {
    name: string;
    number: string;
    imageUrl: string;
  };
}

const MISSING_CARDS: Card[] = [
  {
    id: "experience-d-otomai-incarnam",
    name: "Expérience d'Otomaï",
    extension: {
      name: "Incarnam",
      number: "159/320",
      imageUrl: "https://www.wtcg-return.fr/media/cache/page_card/incarnam/experience-dotomai.png"
    }
  },
  {
    id: "noob-dofus-collection",
    name: "noob!",
    extension: {
      name: "Dofus Collection",
      number: "77/100",
      imageUrl: "https://www.wtcg-return.fr/media/cache/page_card/dofus-collection/noob.png"
    }
  },
  {
    id: "noob-astrub",
    name: "noob!",
    extension: {
      name: "Astrub",
      number: "83/162",
      imageUrl: "https://www.wtcg-return.fr/media/cache/page_card/astrub/noob.png"
    }
  },
  {
    id: "bony-parc-ur-amakna",
    name: "Bony Parcœur",
    extension: {
      name: "Amakna",
      number: "10/162",
      imageUrl: "https://www.wtcg-return.fr/media/cache/page_card/amakna/bony-parcoeur.png"
    }
  },
  {
    id: "musha-l-oni-amakna",
    name: "Musha l'Oni",
    extension: {
      name: "Amakna",
      number: "71/162",
      imageUrl: "https://www.wtcg-return.fr/media/cache/page_card/amakna/musha-loni.png"
    }
  }
];

async function downloadImage(url: string, outputPath: string): Promise<void> {
  try {
    console.log(`🔄 Tentative de téléchargement depuis ${url}`);
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: (status) => status === 200,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://www.wtcg-return.fr/'
      }
    });

    const contentType = response.headers['content-type'];
    if (!contentType?.includes('image')) {
      throw new Error(`Type de contenu invalide: ${contentType}`);
    }

    await fs.writeFile(outputPath, response.data);
    console.log(`✅ Image téléchargée avec succès : ${outputPath}`);
  } catch (error) {
    console.error(`❌ Erreur lors du téléchargement : ${error.message}`);
    throw error;
  }
}

async function downloadMissingImages(): Promise<void> {
  const imagesDir = path.join('data', 'images');
  
  for (const card of MISSING_CARDS) {
    const outputPath = path.join(imagesDir, `${card.id}.png`);
    console.log(`\n🔍 Téléchargement de l'image pour ${card.name} (${card.extension.name})`);
    
    try {
      await downloadImage(card.extension.imageUrl, outputPath);
    } catch (error) {
      console.error(`❌ Erreur lors du traitement de ${card.name} : ${error.message}`);
    }
  }
}

// Lancement du script
downloadMissingImages().catch(error => {
  console.error('❌ Erreur fatale :', error);
  process.exit(1);
}); 