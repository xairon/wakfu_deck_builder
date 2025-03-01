import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';
import { cpus } from 'os';

interface Card {
  id: string;
  name: string;
  mainType: string;
  extension: {
    shortUrl?: string;
    imageUrl?: string;
    name: string;
    number?: string;
  };
  recto?: {
    imageUrl: string;
  };
  verso?: {
    imageUrl: string;
  };
}

interface MissingImage {
  card: Card;
  missingFiles: string[];
  urls?: string[];
  possiblePaths?: string[];
}

interface FailedDownload {
  card: Card;
  urls: string[];
}

const MAX_CONCURRENT_REQUESTS = Math.min(32, cpus().length * 2);
const MIN_IMAGE_SIZE = 50 * 1024; // 50 Ko
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 Mo
const TIMEOUT = 30000; // 30 secondes
const MAX_RETRIES = 3;

interface DownloadStats {
  totalMissing: number;
  downloaded: number;
  failed: number;
  failedImages: Array<{
    cardId: string;
    cardName: string;
    mainType: string;
    extension: string;
    error: string;
  }>;
}

const stats: DownloadStats = {
  totalMissing: 0,
  downloaded: 0,
  failed: 0,
  failedImages: []
};

function logProgress(): void {
  console.log(`📊 Progression: ${stats.downloaded}/${stats.totalMissing} (${stats.failed} échecs)`);
}

async function downloadImage(url: string, outputPath: string, cardInfo: { cardId: string; cardName: string; mainType: string; extension: string }, retryCount = 0): Promise<void> {
  try {
    const response = await axios.get(url, { 
      responseType: 'arraybuffer',
      timeout: TIMEOUT,
      maxRedirects: 5,
      validateStatus: (status) => status === 200,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // Vérification du type de contenu
    const contentType = response.headers['content-type'];
    if (!contentType?.includes('image')) {
      throw new Error(`Type de contenu invalide: ${contentType}`);
    }

    // Vérification de la taille
    const size = response.data.length;
    if (size < MIN_IMAGE_SIZE || size > MAX_IMAGE_SIZE) {
      throw new Error(`Taille d'image invalide: ${size} octets`);
    }

    await fs.writeFile(outputPath, response.data);
    stats.downloaded++;
    logProgress();
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      console.log(`⚠️ Tentative ${retryCount + 1}/${MAX_RETRIES} pour ${url}`);
      await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
      return downloadImage(url, outputPath, cardInfo, retryCount + 1);
    }

    stats.failed++;
    stats.failedImages.push({
      ...cardInfo,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    });
    logProgress();
    throw error;
  }
}

function getAlternativeImageUrls(card: Card): string[] {
  if (!card || !card.id || !card.extension) {
    return [];
  }

  const extensionMap: { [key: string]: string } = {
    'Incarnam': 'incarnam',
    'Bonta & Brâkmar': 'bonta-brakmar',
    'Île des Wabbits': 'ile-des-wabbits',
    'Chaos d\'Ogrest': 'chaos-dogrest',
    'Dofus Collection': 'dofus-collection',
    'Ankama Convention #5': 'ankama-convention-5',
    'Amakna': 'amakna',
    'Astrub': 'astrub',
    'Otomaï': 'otomai',
    'Pandala': 'pandala'
  };

  const extensionName = extensionMap[card.extension.name] || card.extension.name.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const cardNumber = card.extension.number?.split('/')[0] || '1';
  const urls = new Set<string>();

  // Nom de la carte normalisé
  const normalizedName = card.name.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-');

  // URLs alternatives avec le nom normalisé
  urls.add(`https://www.wtcg-return.fr/media/cache/page_card/${extensionName}/${normalizedName}.png`);
  urls.add(`https://www.wtcg-return.fr/media/cache/page_card/${extensionName}/${normalizedName}-${extensionName}.png`);
  urls.add(`https://www.wtcg-return.fr/media/cache/page_card/${extensionName}/${card.id}.png`);
  urls.add(`https://www.wtcg-return.fr/media/cache/page_card/${extensionName}/${extensionName}-${cardNumber}.png`);

  // Essayer avec d'autres extensions pour les cartes qui apparaissent dans plusieurs extensions
  const alternativeExtensions = ['dofus-collection', 'amakna', 'astrub', 'incarnam', 'otomai', 'ile-des-wabbits'];
  for (const altExt of alternativeExtensions) {
    if (altExt !== extensionName) {
      urls.add(`https://www.wtcg-return.fr/media/cache/page_card/${altExt}/${normalizedName}.png`);
      urls.add(`https://www.wtcg-return.fr/media/cache/page_card/${altExt}/${normalizedName}-${altExt}.png`);
    }
  }

  if (card.mainType === 'Héros') {
    urls.add(`https://www.wtcg-return.fr/media/cache/page_card/${extensionName}/${extensionName}-${cardNumber}-1.png`);
    urls.add(`https://www.wtcg-return.fr/media/cache/page_card/${extensionName}/${extensionName}-${cardNumber}-2.png`);
  }

  // Si shortUrl est disponible, ajouter l'URL dérivée
  if (card.extension.shortUrl) {
    const urlParts = card.extension.shortUrl.split('/');
    const shortExtension = urlParts[urlParts.length - 2];
    const cardName = urlParts[urlParts.length - 1];
    urls.add(`https://www.wtcg-return.fr/media/cache/page_card/${shortExtension}/${cardName}.png`);
  }

  return Array.from(urls);
}

async function processCard(card: Card, missingImage: MissingImage, outputDir: string): Promise<boolean> {
  console.log(`🔄 Téléchargement de l'image pour ${card.name}...`);
  
  const urls = getAlternativeImageUrls(card);
  missingImage.urls = urls;
  missingImage.possiblePaths = missingImage.missingFiles.map(file => path.join(outputDir, file));
  
  for (const url of urls) {
    try {
      const outputPath = missingImage.possiblePaths[0];
      await downloadImage(url, outputPath, {
        cardId: card.id,
        cardName: card.name,
        mainType: card.mainType,
        extension: card.extension.name
      });
      console.log(`✅ Image téléchargée avec succès : ${outputPath}`);
      return true;
    } catch (error) {
      console.log(`⚠️ Échec du téléchargement depuis ${url}`);
    }
  }

  console.log(`❌ Impossible de télécharger l'image pour ${card.name}`);
  return false;
}

async function findMissingImages(): Promise<MissingImage[]> {
  const missingImages: MissingImage[] = [];
  const imagesDir = path.join('data', 'images');
  
  console.log('📂 Vérification du dossier images...');
  try {
    await fs.access(imagesDir);
  } catch {
    console.log('🔨 Création du dossier images...');
    await fs.mkdir(imagesDir, { recursive: true });
  }

  console.log('📝 Lecture des fichiers existants...');
  const allFiles = await fs.readdir(imagesDir);
  console.log(`📊 Nombre total de fichiers: ${allFiles.length}`);
  
  // Créer un Map pour stocker les fichiers existants avec leur casse d'origine
  const existingFilesMap = new Map<string, string>();
  allFiles.filter(file => file.endsWith('.png')).forEach(file => {
    existingFilesMap.set(file.toLowerCase(), file);
  });
  console.log(`📊 Nombre d'images PNG: ${existingFilesMap.size}`);
  
  // Afficher quelques exemples de fichiers existants
  console.log('\n📸 Exemples de fichiers existants:');
  Array.from(existingFilesMap.values()).slice(0, 5).forEach(file => {
    console.log(`   ${file}`);
  });

  console.log('\n🔍 Lecture des fichiers JSON...');
  const jsonFiles = await fs.readdir('data').then(files => files.filter(file => file.endsWith('.json')).map(file => path.join('data', file)));
  console.log(`📚 Nombre de fichiers JSON trouvés: ${jsonFiles.length}`);

  const normalCards: Card[] = [];
  const heroCards: Card[] = [];
  const expectedFiles = new Set<string>();

  for (const jsonFile of jsonFiles) {
    if (jsonFile.includes('failed_downloads')) continue;
    
    try {
      console.log(`📖 Lecture de ${jsonFile}...`);
      const content = await fs.readFile(jsonFile, 'utf-8');
      const fileCards: Card[] = JSON.parse(content);
      console.log(`✨ ${fileCards.length} cartes trouvées dans ${jsonFile}`);
      
      // Séparer les héros des autres cartes
      fileCards.forEach(card => {
        if (card.mainType === 'Héros') {
          heroCards.push(card);
        } else {
          normalCards.push(card);
        }
      });
    } catch (error) {
      console.error(`❌ Erreur lors de la lecture de ${jsonFile}:`, error);
    }
  }

  console.log('\n🔍 Analyse des cartes :');
  console.log(`👥 Héros trouvés: ${heroCards.length}`);
  console.log(`🎴 Cartes normales trouvées: ${normalCards.length}`);
  
  let missingCount = 0;

  // Vérifier les héros
  console.log('\n🔍 Vérification des héros...');
  for (const hero of heroCards) {
    if (!hero || !hero.id || !hero.extension || !hero.extension.name) {
      console.log('⚠️ Héros invalide détecté:', hero);
      continue;
    }

    const rectoFile = `${hero.id}_recto.png`;
    const versoFile = `${hero.id}_verso.png`;
    const missingFiles: string[] = [];
    
    expectedFiles.add(rectoFile.toLowerCase());
    expectedFiles.add(versoFile.toLowerCase());
    
    if (!existingFilesMap.has(rectoFile.toLowerCase())) {
      console.log(`❌ Image manquante: ${rectoFile} (Héros - Recto)`);
      missingFiles.push(rectoFile);
      missingCount++;
    } else {
      console.log(`✅ Image trouvée: ${existingFilesMap.get(rectoFile.toLowerCase())}`);
    }

    if (!existingFilesMap.has(versoFile.toLowerCase())) {
      console.log(`❌ Image manquante: ${versoFile} (Héros - Verso)`);
      missingFiles.push(versoFile);
      missingCount++;
    } else {
      console.log(`✅ Image trouvée: ${existingFilesMap.get(versoFile.toLowerCase())}`);
    }

    if (missingFiles.length > 0) {
      missingImages.push({ card: hero, missingFiles });
    }
  }

  // Vérifier les cartes normales
  console.log('\n🔍 Vérification des cartes normales...');
  let checkedCount = 0;
  for (const card of normalCards) {
    if (!card || !card.id || !card.extension || !card.extension.name) {
      console.log('⚠️ Carte invalide détectée:', card);
      continue;
    }

    const imageFile = `${card.id}.png`;
    expectedFiles.add(imageFile.toLowerCase());
    
    if (!existingFilesMap.has(imageFile.toLowerCase())) {
      console.log(`❌ Image manquante: ${imageFile} (${card.mainType})`);
      missingImages.push({ card, missingFiles: [imageFile] });
      missingCount++;
    } else {
      checkedCount++;
      if (checkedCount % 100 === 0) {
        console.log(`✅ ${checkedCount} cartes vérifiées...`);
      }
    }
  }

  const totalExpectedImages = heroCards.length * 2 + normalCards.length;
  
  console.log('\n📊 Statistiques finales :');
  console.log(`👥 Héros: ${heroCards.length} (${heroCards.length * 2} images attendues)`);
  console.log(`🎴 Cartes normales: ${normalCards.length} (${normalCards.length} images attendues)`);
  console.log(`📦 Total des cartes: ${heroCards.length + normalCards.length}`);
  console.log(`🖼️ Nombre total d'images attendues: ${totalExpectedImages}`);
  console.log(`📸 Nombre d'images existantes: ${existingFilesMap.size}`);
  console.log(`❌ Nombre d'images manquantes: ${missingCount}`);

  // Vérifier les images orphelines (qui existent mais ne correspondent à aucune carte)
  const orphanImages = Array.from(existingFilesMap.keys()).filter(file => !expectedFiles.has(file));
  if (orphanImages.length > 0) {
    console.log('\n⚠️ Images orphelines trouvées:');
    orphanImages.forEach(file => {
      console.log(`   ${existingFilesMap.get(file)}`);
    });
  }

  if (missingCount > 0) {
    console.log('\n🔍 Liste des cartes avec images manquantes :');
    missingImages.forEach(missing => {
      console.log(`\n${missing.card.name} (${missing.card.extension.name})`);
      console.log('Images manquantes :');
      missing.missingFiles.forEach(file => console.log(`  - ${file}`));
    });
  }

  return missingImages;
}

async function downloadMissingImages(): Promise<void> {
  console.log('🔍 Recherche des images manquantes...');
  
  const missingImages = await findMissingImages();
  stats.totalMissing = missingImages.length;
  
  console.log(`📦 ${stats.totalMissing} images manquantes trouvées`);
  
  const imagesDir = path.join('data', 'images');
  const failedDownloads: FailedDownload[] = [];
  
  // Traiter les cartes par lots pour limiter les requêtes simultanées
  const batchSize = MAX_CONCURRENT_REQUESTS;
  for (let i = 0; i < missingImages.length; i += batchSize) {
    const batch = missingImages.slice(i, i + batchSize);
    await Promise.all(batch.map(async (missingImage) => {
      try {
        const success = await processCard(missingImage.card, missingImage, imagesDir);
        if (!success) {
          failedDownloads.push({
            card: missingImage.card,
            urls: missingImage.urls || []
          });
        }
      } catch (error) {
        console.error(`❌ Erreur lors du traitement de ${missingImage.card.name}:`, error);
      }
    }));
  }
  
  // Rapport final
  console.log('\n📊 Rapport final :');
  console.log(`✅ ${stats.downloaded} images téléchargées avec succès`);
  console.log(`❌ ${stats.failed} images en échec`);
  
  if (failedDownloads.length > 0) {
    console.log('\n❌ Images non téléchargées :');
    for (const failed of failedDownloads) {
      console.log(`\n${failed.card.name} (${failed.card.extension.name} #${failed.card.extension.number})`);
      console.log('URLs tentées :');
      failed.urls.forEach(url => console.log(`- ${url}`));
    }
  }
}

// Lancement du script
downloadMissingImages().catch(error => {
  console.error('❌ Erreur fatale :', error);
  process.exit(1);
}); 