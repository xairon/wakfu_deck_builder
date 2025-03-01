import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

async function checkDirectory(path) {
  try {
    const stats = await fs.stat(path);
    console.log(`✓ ${path} existe (${stats.isDirectory() ? 'dossier' : 'fichier'})`);
    if (stats.isDirectory()) {
      const files = await fs.readdir(path);
      console.log(`  Contenu (${files.length} éléments):`);
      for (const file of files) {
        console.log(`  - ${file}`);
      }
    }
  } catch (error) {
    console.error(`✗ ${path} n'existe pas ou n'est pas accessible`);
  }
}

async function checkStructure() {
  console.log('Vérification de la structure du projet...\n');

  // Vérifier le dossier du projet
  console.log(`Dossier racine: ${projectRoot}\n`);

  // Vérifier les dossiers source
  console.log('Dossiers source:');
  await checkDirectory(join(projectRoot, '..', 'cartes'));
  await checkDirectory(join(projectRoot, '..', 'images'));
  
  // Vérifier les dossiers de destination
  console.log('\nDossiers de destination:');
  await checkDirectory(join(projectRoot, 'public'));
  await checkDirectory(join(projectRoot, 'public', 'cartes'));
  await checkDirectory(join(projectRoot, 'public', 'images'));
  await checkDirectory(join(projectRoot, 'public', 'images', 'cards'));
  await checkDirectory(join(projectRoot, 'public', 'images', 'symbols'));
}

checkStructure(); 