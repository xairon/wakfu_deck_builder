/**
 * Script pour optimiser les images des cartes
 * Utilisé par le système MCP pour permettre à Claude d'optimiser les performances
 */

import fs from 'fs';
import path from 'path';
import * as glob from 'glob';
import sharp from 'sharp';
import pLimit from 'p-limit';

// Configuration
const IMAGES_DIR = path.join(process.cwd(), 'public', 'images', 'cards');
const OPTIMIZED_DIR = path.join(process.cwd(), 'public', 'images', 'cards_optimized');
const REPORT_PATH = path.join(process.cwd(), 'debug', 'image_optimization_report.json');
const MAX_CONCURRENT = 5; // Nombre maximum de traitements d'image simultanés

// Options d'optimisation
const WEBP_OPTIONS = {
  quality: 80,
  effort: 4, // 0-6, 6 étant le plus élevé (plus lent mais meilleure compression)
};

const JPEG_OPTIONS = {
  quality: 85,
  progressive: true,
};

const PNG_OPTIONS = {
  compressionLevel: 8, // 0-9, 9 étant le plus élevé
  progressive: true,
};

// Fonction pour optimiser les images
async function optimizeImages() {
  try {
    console.log('🔍 Analyse des images à optimiser...');
    
    // Vérifier si le dossier d'images existe
    if (!fs.existsSync(IMAGES_DIR)) {
      console.error(`❌ Le dossier d'images n'existe pas: ${IMAGES_DIR}`);
      return;
    }
    
    // Créer le dossier optimisé s'il n'existe pas
    if (!fs.existsSync(OPTIMIZED_DIR)) {
      fs.mkdirSync(OPTIMIZED_DIR, { recursive: true });
      console.log(`📁 Création du dossier d'images optimisées: ${OPTIMIZED_DIR}`);
    }
    
    // Trouver toutes les images
    const imageFiles = glob.sync(path.join(IMAGES_DIR, '**/*.{jpg,jpeg,png,gif}'));
    
    if (imageFiles.length === 0) {
      console.log('❓ Aucune image trouvée.');
      return;
    }
    
    console.log(`🖼️ ${imageFiles.length} images trouvées à optimiser.`);
    
    // Limiter le nombre de traitements simultanés
    const limit = pLimit(MAX_CONCURRENT);
    
    // Rapport d'optimisation
    const report = {
      totalImages: imageFiles.length,
      processedImages: 0,
      originalSize: 0,
      optimizedSize: 0,
      webpSize: 0,
      failedImages: [] as string[],
      successfulImages: [] as any[]
    };
    
    // Traiter chaque image
    const tasks = imageFiles.map((imagePath) => {
      return limit(async () => {
        try {
          const relativePath = path.relative(IMAGES_DIR, imagePath);
          const fileName = path.basename(imagePath);
          const fileNameWithoutExt = path.basename(imagePath, path.extname(imagePath));
          const outputPath = path.join(OPTIMIZED_DIR, relativePath);
          const outputDir = path.dirname(outputPath);
          
          // S'assurer que le dossier de sortie existe
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          // Chemin pour l'image WebP
          const webpPath = path.join(outputDir, `${fileNameWithoutExt}.webp`);
          
          // Taille d'origine
          const originalStats = fs.statSync(imagePath);
          const originalSize = originalStats.size;
          
          // Optimiser selon le type d'image
          const ext = path.extname(imagePath).toLowerCase();
          
          let sharpInstance = sharp(imagePath);
          let optimizedPath: string;
          
          // Optimiser selon le type
          if (ext === '.jpg' || ext === '.jpeg') {
            optimizedPath = outputPath;
            await sharpInstance.jpeg(JPEG_OPTIONS).toFile(optimizedPath);
          } else if (ext === '.png') {
            optimizedPath = outputPath;
            await sharpInstance.png(PNG_OPTIONS).toFile(optimizedPath);
          } else {
            // Pour les autres formats (gif, etc.), simplement copier
            optimizedPath = outputPath;
            fs.copyFileSync(imagePath, optimizedPath);
          }
          
          // Générer la version WebP
          await sharp(imagePath).webp(WEBP_OPTIONS).toFile(webpPath);
          
          // Tailles optimisées
          const optimizedStats = fs.statSync(optimizedPath);
          const webpStats = fs.statSync(webpPath);
          
          const optimizedSize = optimizedStats.size;
          const webpSize = webpStats.size;
          
          // Mettre à jour le rapport
          report.originalSize += originalSize;
          report.optimizedSize += optimizedSize;
          report.webpSize += webpSize;
          report.processedImages++;
          
          const savingsPercent = Math.round((1 - optimizedSize / originalSize) * 100);
          const webpSavingsPercent = Math.round((1 - webpSize / originalSize) * 100);
          
          report.successfulImages.push({
            file: relativePath,
            originalSize,
            optimizedSize,
            webpSize,
            savings: {
              bytes: originalSize - optimizedSize,
              percent: savingsPercent
            },
            webpSavings: {
              bytes: originalSize - webpSize,
              percent: webpSavingsPercent
            }
          });
          
          // Afficher la progression
          if (report.processedImages % 10 === 0 || report.processedImages === report.totalImages) {
            const progress = Math.round((report.processedImages / report.totalImages) * 100);
            console.log(`⏳ Progression: ${progress}% (${report.processedImages}/${report.totalImages})`);
          }
          
        } catch (error) {
          console.error(`❌ Erreur lors du traitement de ${imagePath}:`, error);
          report.failedImages.push(imagePath);
        }
      });
    });
    
    // Attendre que toutes les tâches soient terminées
    await Promise.all(tasks);
    
    // Calculer les statistiques finales
    const totalSavingsBytes = report.originalSize - report.optimizedSize;
    const totalSavingsPercent = Math.round((totalSavingsBytes / report.originalSize) * 100);
    
    const webpSavingsBytes = report.originalSize - report.webpSize;
    const webpSavingsPercent = Math.round((webpSavingsBytes / report.originalSize) * 100);
    
    console.log('\n📊 Rapport d\'optimisation:');
    console.log(`  - Images traitées: ${report.processedImages}/${report.totalImages}`);
    console.log(`  - Taille originale totale: ${formatBytes(report.originalSize)}`);
    console.log(`  - Taille optimisée totale: ${formatBytes(report.optimizedSize)} (${totalSavingsPercent}% d'économie)`);
    console.log(`  - Taille WebP totale: ${formatBytes(report.webpSize)} (${webpSavingsPercent}% d'économie)`);
    
    if (report.failedImages.length > 0) {
      console.log(`  - Images échouées: ${report.failedImages.length}`);
    }
    
    // Créer le répertoire de debug s'il n'existe pas
    const debugDir = path.dirname(REPORT_PATH);
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    
    // Enregistrer le rapport dans un fichier
    fs.writeFileSync(
      REPORT_PATH,
      JSON.stringify({
        summary: {
          totalImages: report.totalImages,
          processedImages: report.processedImages,
          failedImages: report.failedImages.length,
          originalSize: report.originalSize,
          optimizedSize: report.optimizedSize,
          webpSize: report.webpSize,
          savings: {
            bytes: totalSavingsBytes,
            percent: totalSavingsPercent
          },
          webpSavings: {
            bytes: webpSavingsBytes,
            percent: webpSavingsPercent
          }
        },
        failedImages: report.failedImages,
        successfulImages: report.successfulImages.sort((a, b) => b.savings.bytes - a.savings.bytes).slice(0, 20) // Top 20 des économies
      }, null, 2),
      'utf-8'
    );
    
    console.log(`\n✅ Optimisation terminée. Rapport enregistré dans: ${REPORT_PATH}`);
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'optimisation des images:', error);
  }
}

// Fonction utilitaire pour formater les octets
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Exécuter l'optimisation
optimizeImages(); 