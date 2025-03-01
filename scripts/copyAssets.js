import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

// Chemins source
const CARDS_SOURCE_DIR = join(projectRoot, '..', 'cartes');
const IMAGES_SOURCE_DIR = join(projectRoot, '..', 'images');

// Chemins de destination dans public
const PUBLIC_DIR = join(projectRoot, 'public');
const CARDS_DEST_DIR = join(PUBLIC_DIR, 'cartes');
const IMAGES_DEST_DIR = join(PUBLIC_DIR, 'images');
const CARDS_IMAGES_DIR = join(IMAGES_DEST_DIR, 'cards');
const SYMBOLS_IMAGES_DIR = join(IMAGES_DEST_DIR, 'symbols');

async function ensureDirectoryExists(dir) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
    console.log(`Dossier créé: ${dir}`);
  }
}

async function createPlaceholderImage(path) {
  console.log(`Création d'une image placeholder pour: ${path}`);
  await sharp({
    create: {
      width: 200,
      height: 200,
      channels: 4,
      background: { r: 200, g: 200, b: 200, alpha: 1 }
    }
  })
  .jpeg()
  .toFile(path);
}

async function copyFiles() {
  try {
    // Assurer que tous les dossiers nécessaires existent
    await ensureDirectoryExists(PUBLIC_DIR);
    await ensureDirectoryExists(CARDS_DEST_DIR);
    await ensureDirectoryExists(IMAGES_DEST_DIR);
    await ensureDirectoryExists(CARDS_IMAGES_DIR);
    await ensureDirectoryExists(SYMBOLS_IMAGES_DIR);

    // Copier les fichiers JSON des cartes
    const cardFiles = await fs.readdir(CARDS_SOURCE_DIR);
    console.log('\nCopie des fichiers JSON des cartes...');
    for (const file of cardFiles) {
      if (file.endsWith('.json')) {
        const sourcePath = join(CARDS_SOURCE_DIR, file);
        const destPath = join(CARDS_DEST_DIR, file);
        await fs.copyFile(sourcePath, destPath);
        console.log(`Copié: ${file}`);
      }
    }

    // Copier les images des cartes
    const cardImages = await fs.readdir(join(IMAGES_SOURCE_DIR, 'cards'));
    console.log('\nCopie des images des cartes...');
    for (const file of cardImages) {
      const sourcePath = join(IMAGES_SOURCE_DIR, 'cards', file);
      const destPath = join(CARDS_IMAGES_DIR, file);
      try {
        await fs.copyFile(sourcePath, destPath);
        console.log(`Copié: ${file}`);
      } catch (error) {
        console.warn(`Impossible de copier ${file}, création d'un placeholder`);
        await createPlaceholderImage(destPath);
      }
    }

    // Copier les symboles
    const symbolImages = await fs.readdir(join(IMAGES_SOURCE_DIR, 'symbols'));
    console.log('\nCopie des symboles...');
    for (const file of symbolImages) {
      const sourcePath = join(IMAGES_SOURCE_DIR, 'symbols', file);
      const destPath = join(SYMBOLS_IMAGES_DIR, file);
      await fs.copyFile(sourcePath, destPath);
      console.log(`Copié: ${file}`);
    }

    console.log('\nCopie des assets terminée avec succès !');
  } catch (error) {
    console.error('Erreur lors de la copie des assets:', error);
    process.exit(1);
  }
}

copyFiles(); 