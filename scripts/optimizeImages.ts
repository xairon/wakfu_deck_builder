/**
 * Script pour optimiser les images des cartes
 * Utilisé par le système MCP pour permettre à Claude d'optimiser les performances
 */

import fs from 'fs'
import path from 'path'
import * as glob from 'glob'
import sharp from 'sharp'
import pLimit from 'p-limit'

// Configuration
const IMAGES_DIR = path.join(process.cwd(), 'public', 'images', 'cards')
const REPORT_PATH = path.join(
  process.cwd(),
  'debug',
  'image_optimization_report.json'
)
const MAX_CONCURRENT = 5 // Nombre maximum de traitements d'image simultanés

// Options d'optimisation
const WEBP_OPTIONS = {
  quality: 80,
  effort: 4, // 0-6, 6 étant le plus élevé (plus lent mais meilleure compression)
}

const JPEG_OPTIONS = {
  quality: 85,
  progressive: true,
}

const PNG_OPTIONS = {
  compressionLevel: 8, // 0-9, 9 étant le plus élevé
  progressive: true,
}

// Fonction pour optimiser les images
async function optimizeImages() {
  try {
    console.log('🔍 Analyse des images à optimiser...')

    if (!fs.existsSync(IMAGES_DIR)) {
      console.error(`❌ Le dossier d'images n'existe pas: ${IMAGES_DIR}`)
      return
    }

    const imageFiles = glob.sync(path.join(IMAGES_DIR, '**/*.{jpg,jpeg,png}')) // Ne plus traiter les gifs ici directement pour l'optimisation png/jpeg
    const gifFiles = glob.sync(path.join(IMAGES_DIR, '**/*.gif'))

    if (imageFiles.length === 0 && gifFiles.length === 0) {
      console.log('❓ Aucune image trouvée.')
      return
    }

    console.log(
      `🖼️ ${imageFiles.length} images (jpg, png) et ${gifFiles.length} GIFs trouvés à optimiser.`
    )

    const limit = pLimit(MAX_CONCURRENT)

    const report = {
      totalImages: imageFiles.length + gifFiles.length,
      processedImages: 0,
      originalSize: 0,
      optimizedSize: 0, // Pour la version optimisée du format original
      webpSize: 0, // Pour la version WebP
      failedOperations: [] as {
        file: string
        operation: string
        error: string
      }[],
      successfulImages: [] as any[],
    }

    // Traiter JPG/PNG
    const tasks = imageFiles.map((imagePath) => {
      return limit(async () => {
        const relativePath = path.relative(IMAGES_DIR, imagePath);
        const fileNameWithoutExt = path.basename(imagePath, path.extname(imagePath));
        const outputDir = path.dirname(imagePath);
        const webpPath = path.join(outputDir, `${fileNameWithoutExt}.webp`);
        
        let originalSize = 0;
        try {
          originalSize = fs.statSync(imagePath).size;
          report.originalSize += originalSize;

          const ext = path.extname(imagePath).toLowerCase();
          let optimizedFileBuffer: Buffer | null = null;
          
          if (ext === '.jpg' || ext === '.jpeg') {
            optimizedFileBuffer = await sharp(imagePath).jpeg(JPEG_OPTIONS).toBuffer();
          } else if (ext === '.png') {
            optimizedFileBuffer = await sharp(imagePath).png(PNG_OPTIONS).toBuffer();
          }

          let currentOptimizedSize = originalSize;
          if (optimizedFileBuffer) {
            fs.writeFileSync(imagePath, optimizedFileBuffer); // Écrase l'original avec la version optimisée
            currentOptimizedSize = optimizedFileBuffer.length;
          }
          report.optimizedSize += currentOptimizedSize;

          // Générer la version WebP
          const webpBuffer = await sharp(imagePath).webp(WEBP_OPTIONS).toBuffer();
          fs.writeFileSync(webpPath, webpBuffer);
          report.webpSize += webpBuffer.length;
          
          report.successfulImages.push({
            file: relativePath,
            originalSize,
            optimizedSize: currentOptimizedSize,
            webpSize: webpBuffer.length,
            savingsPercent: Math.round((1 - currentOptimizedSize / originalSize) * 100),
            webpSavingsPercent: Math.round((1 - webpBuffer.length / originalSize) * 100)
          });

        } catch (error: any) {
          console.error(`❌ Erreur lors du traitement de ${imagePath}:`, error);
          report.failedOperations.push({ file: relativePath, operation: 'optimize/convert', error: error.message });
        } finally {
          report.processedImages++;
          if (report.processedImages % 10 === 0 || report.processedImages === report.totalImages) {
            const progress = Math.round((report.processedImages / report.totalImages) * 100);
            console.log(`⏳ Progression: ${progress}% (${report.processedImages}/${report.totalImages})`);
          }
        }
      });
    });
    })

    // Traiter GIFs (conversion en WebP animé)
    const gifTasks = gifFiles.map((gifPath) => {
      return limit(async () => {
        const relativePath = path.relative(IMAGES_DIR, gifPath)
        const fileNameWithoutExt = path.basename(gifPath, path.extname(gifPath))
        const outputDir = path.dirname(gifPath)
        const webpPath = path.join(outputDir, `${fileNameWithoutExt}.webp`)

        let originalSize = 0
        try {
          originalSize = fs.statSync(gifPath).size
          report.originalSize += originalSize
          report.optimizedSize += originalSize // Pour les GIFs, l'original est considéré "optimisé" car on ne le modifie pas

          // Convertir GIF en WebP animé
          const webpBuffer = await sharp(gifPath, { animated: true })
            .webp(WEBP_OPTIONS)
            .toBuffer()
          fs.writeFileSync(webpPath, webpBuffer)
          report.webpSize += webpBuffer.length

          report.successfulImages.push({
            file: relativePath,
            originalSize,
            optimizedSize: originalSize, // Pas d'optimisation sur place du GIF
            webpSize: webpBuffer.length,
            savingsPercent: 0,
            webpSavingsPercent: Math.round(
              (1 - webpBuffer.length / originalSize) * 100
            ),
          })
        } catch (error: any) {
          console.error(
            `❌ Erreur lors de la conversion de GIF ${gifPath} en WebP:`,
            error
          )
          report.failedOperations.push({
            file: relativePath,
            operation: 'gif_to_webp',
            error: error.message,
          })
        } finally {
          report.processedImages++
          if (
            report.processedImages % 10 === 0 ||
            report.processedImages === report.totalImages
          ) {
            const progress = Math.round(
              (report.processedImages / report.totalImages) * 100
            )
            console.log(
              `⏳ Progression: ${progress}% (${report.processedImages}/${report.totalImages})`
            )
          }
        }
      })
    })

    await Promise.all([...tasks, ...gifTasks])

    const totalOriginalSize = report.originalSize
    const totalOptimizedSize = report.optimizedSize
    const totalWebpSize = report.webpSize

    const overallSavingsPercent =
      totalOriginalSize > 0
        ? Math.round((1 - totalOptimizedSize / totalOriginalSize) * 100)
        : 0
    const overallWebpSavingsPercent =
      totalOriginalSize > 0
        ? Math.round((1 - totalWebpSize / totalOriginalSize) * 100)
        : 0

    console.log("\n📊 Rapport d'optimisation:")
    console.log(
      `  - Images traitées: ${report.processedImages}/${report.totalImages}`
    )
    console.log(
      `  - Taille originale totale: ${formatBytes(totalOriginalSize)}`
    )
    console.log(
      `  - Taille optimisée (format original) totale: ${formatBytes(totalOptimizedSize)} (${overallSavingsPercent}% d'économie)`
    )
    console.log(
      `  - Taille WebP totale: ${formatBytes(totalWebpSize)} (${overallWebpSavingsPercent}% d'économie par rapport à l'original)`
    )

    if (report.failedOperations.length > 0) {
      console.log(`  - Opérations échouées: ${report.failedOperations.length}`)
    }

    const debugDir = path.dirname(REPORT_PATH)
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true })
    }

    fs.writeFileSync(
      REPORT_PATH,
      JSON.stringify(
        {
          summary: {
            totalImages: report.totalImages,
            processedImages: report.processedImages,
            failedOperations: report.failedOperations.length,
            originalSize: totalOriginalSize,
            optimizedSize: totalOptimizedSize,
            webpSize: totalWebpSize,
            savingsPercent: overallSavingsPercent,
            webpSavingsPercent: overallWebpSavingsPercent,
          },
          failedOperations: report.failedOperations,
          successfulImages: report.successfulImages
            .sort(
              (a, b) =>
                b.originalSize - b.webpSize - (a.originalSize - a.webpSize)
            )
            .slice(0, 20),
        },
        null,
        2
      ),
      'utf-8'
    )

    console.log(
      `\n✅ Optimisation terminée. Rapport enregistré dans: ${REPORT_PATH}`
    )
  } catch (error) {
    console.error("❌ Erreur globale lors de l'optimisation des images:", error)
  }
}

function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

optimizeImages()
