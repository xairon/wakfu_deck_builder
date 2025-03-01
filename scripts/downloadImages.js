import { writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import imageMapping from '../public/cartes/image_mapping.json' assert { type: "json" };
import axios from 'axios';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '../public/images/cards');
const PROGRESS_FILE = path.join(__dirname, 'download_progress.json');

const MIN_IMAGE_SIZE = 50 * 1024; // 50 Ko
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 Mo
const MAX_RETRIES = 5;
const RETRY_DELAY = 3000; // 3 secondes
const TIMEOUT = 15000; // 15 secondes
const DELAY_BETWEEN_DOWNLOADS = 1000; // 1 seconde

function fixImageUrl(url) {
  // Si l'URL est déjà correcte, on la retourne telle quelle
  if (url.includes('/media/cache/page_card/')) {
    return url;
  }

  // Extraire le chemin après /cartes/
  const match = url.match(/\/cartes\/(.+)$/);
  if (!match) {
    return url;
  }

  const path = match[1];
  // Ajouter .png si nécessaire
  const pathWithExt = path.endsWith('.png') ? path : `${path}.png`;
  return `https://www.wtcg-return.fr/media/cache/page_card/${pathWithExt}`;
}

async function cleanupSmallImages() {
  console.log('🧹 Nettoyage des images trop petites...');
  const files = await fs.promises.readdir(OUTPUT_DIR);
  let deletedCount = 0;

  for (const file of files) {
    const filePath = path.join(OUTPUT_DIR, file);
    try {
      const stats = await fs.promises.stat(filePath);
      if (stats.size < MIN_IMAGE_SIZE) {
        await fs.promises.unlink(filePath);
        console.log(`   🗑️ Suppression de ${file} (${(stats.size / 1024).toFixed(2)} Ko)`);
        deletedCount++;
      }
    } catch (error) {
      console.log(`   ❌ Erreur lors de la suppression de ${file}: ${error.message}`);
    }
  }

  console.log(`✅ Nettoyage terminé: ${deletedCount} images supprimées`);
}

async function extractImageUrlFromHtml(html) {
  // Recherche de l'URL de l'image dans le HTML
  const imgMatch = html.match(/<img[^>]+src="([^"]+)"[^>]*class="card-img[^>]*>/);
  if (!imgMatch) {
    console.log('❌ Impossible de trouver l\'URL de l\'image dans le HTML');
    return null;
  }
  const imgUrl = imgMatch[1];
  if (!imgUrl.startsWith('http')) {
    return `https://www.wtcg-return.fr${imgUrl}`;
  }
  return imgUrl;
}

async function downloadImage(url, outputPath, attempt = 1) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cookie': 'PHPSESSID=1234567890abcdef; remember_web=1234567890abcdef',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Referer': 'https://www.wtcg-return.fr/',
    'Connection': 'keep-alive'
  };

  try {
    console.log(`📥 Téléchargement depuis ${url}`);
    console.log('   Options:', JSON.stringify({ timeout: TIMEOUT, headers }, null, 2));

    const response = await axios.get(url, {
      timeout: TIMEOUT,
      headers,
      responseType: 'arraybuffer',
      maxRedirects: 5
    });

    console.log('   Code de statut:', response.status);
    console.log('   En-têtes:', JSON.stringify(response.headers, null, 2));

    const contentType = response.headers['content-type'];
    console.log('   Type de contenu:', contentType);

    if (contentType && contentType.includes('text/html')) {
      console.log('   Page HTML détectée, extraction de l\'URL de l\'image...');
      const html = response.data.toString('utf8');
      const imageUrl = await extractImageUrlFromHtml(html);
      if (imageUrl) {
        console.log('   ✅ URL de l\'image trouvée:', imageUrl);
        return downloadImage(imageUrl, outputPath, attempt);
      } else {
        throw new Error('Type de contenu invalide: ' + contentType);
      }
    }

    if (!contentType || !contentType.toLowerCase().includes('image')) {
      console.log('   ❌ Type de contenu invalide');
      if (response.data.length < 100) {
        console.log('   Début de la réponse:', response.data.toString().substring(0, 100));
      }
      throw new Error('Type de contenu invalide: ' + contentType);
    }

    const buffer = Buffer.from(response.data);
    const fileSize = buffer.length;

    if (fileSize < MIN_IMAGE_SIZE) {
      throw new Error(`Image trop petite (${(fileSize / 1024).toFixed(2)} Ko)`);
    }

    if (fileSize > MAX_IMAGE_SIZE) {
      throw new Error(`Image trop grande (${(fileSize / 1024).toFixed(2)} Ko)`);
    }

    // Vérifier la signature PNG
    const isPNG = buffer[0] === 0x89 && 
                 buffer[1] === 0x50 && 
                 buffer[2] === 0x4E && 
                 buffer[3] === 0x47;

    if (!isPNG) {
      throw new Error('Fichier non PNG');
    }

    // Créer le répertoire de sortie s'il n'existe pas
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

    // Écrire le fichier
    await writeFile(outputPath, buffer);
    console.log(`   ✅ Image sauvegardée (${(fileSize / 1024).toFixed(2)} Ko)`);

    return true;
  } catch (error) {
    console.log(`   ❌ Erreur:`, error.message);

    if (attempt < MAX_RETRIES) {
      console.log(`   ⏳ Nouvelle tentative dans ${RETRY_DELAY/1000}s (${attempt}/${MAX_RETRIES})...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return downloadImage(url, outputPath, attempt + 1);
    }

    throw error;
  }
}

async function main() {
  // Créer le répertoire de sortie s'il n'existe pas
  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });

  // Nettoyer les images trop petites
  await cleanupSmallImages();

  // Charger la progression précédente si elle existe
  let downloadedFiles = new Set();
  try {
    const progress = JSON.parse(await fs.promises.readFile(PROGRESS_FILE, 'utf8'));
    if (Array.isArray(progress.downloadedFiles)) {
      downloadedFiles = new Set(progress.downloadedFiles);
    }
    console.log(`📋 Progression chargée: ${downloadedFiles.size} images`);
  } catch (error) {
    console.log('📋 Aucune progression précédente trouvée');
  }

  const totalImages = Object.keys(imageMapping.cards).length;
  console.log(`🎯 Total d'images à télécharger: ${totalImages}`);

  for (const [url, mapping] of Object.entries(imageMapping.cards)) {
    const outputPath = path.join(OUTPUT_DIR, mapping.filename);
    const fixedUrl = fixImageUrl(url);

    // Vérifier si l'image existe déjà et est valide
    try {
      const stats = await fs.promises.stat(outputPath);
      if (stats.size >= MIN_IMAGE_SIZE && downloadedFiles.has(mapping.filename)) {
        console.log(`✅ Image déjà téléchargée et valide: ${mapping.filename} (${(stats.size / 1024).toFixed(2)} Ko)`);
        continue;
      }
    } catch (error) {
      // Le fichier n'existe pas ou n'est pas accessible
    }

    console.log(`\n⏳ Téléchargement de ${mapping.filename}`);
    console.log(`   🔗 URL: ${fixedUrl}`);

    try {
      await downloadImage(fixedUrl, outputPath);
      downloadedFiles.add(mapping.filename);
      await fs.promises.writeFile(PROGRESS_FILE, JSON.stringify({ downloadedFiles: Array.from(downloadedFiles) }, null, 2));
    } catch (error) {
      console.log(`❌ Erreur pour ${mapping.filename}: ${error.message}`);
      continue;
    }

    // Attendre un peu entre chaque téléchargement
    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_DOWNLOADS));
  }
}

main().catch(console.error);