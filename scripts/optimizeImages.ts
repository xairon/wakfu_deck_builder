/**
 * Image optimization pipeline for Wakfu Deck Builder
 *
 * Generates WebP and thumbnail versions of all PNG card images.
 * - WebP: same dimensions, quality 80 -> public/images/cards/webp/[name].webp
 * - Thumbnail: width 200px, quality 70 -> public/images/cards/thumbs/[name].webp
 *
 * Skips files whose output already exists and is newer than the source.
 * Uses p-limit for concurrency control (max 4 parallel conversions).
 *
 * Usage: npm run optimize-images:webp
 */

import fs from "fs";
import path from "path";
import sharp from "sharp";
import pLimit from "p-limit";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const IMAGES_DIR = path.join(process.cwd(), "public", "images", "cards");
const WEBP_DIR = path.join(IMAGES_DIR, "webp");
const THUMBS_DIR = path.join(IMAGES_DIR, "thumbs");

const WEBP_QUALITY = 80;
const THUMB_QUALITY = 70;
const THUMB_WIDTH = 200;
const MAX_CONCURRENT = 4;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Returns true if `outputPath` exists and is newer than `sourcePath`.
 */
function isUpToDate(sourcePath: string, outputPath: string): boolean {
  if (!fs.existsSync(outputPath)) return false;
  const sourceStat = fs.statSync(sourcePath);
  const outputStat = fs.statSync(outputPath);
  return outputStat.mtimeMs >= sourceStat.mtimeMs;
}

/**
 * Collect all .png files directly inside IMAGES_DIR (non-recursive, skips
 * the webp/ and thumbs/ subdirectories).
 */
function collectPngFiles(): string[] {
  const entries = fs.readdirSync(IMAGES_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".png"))
    .map((e) => path.join(IMAGES_DIR, e.name));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface ProcessingResult {
  file: string;
  skippedWebp: boolean;
  skippedThumb: boolean;
  originalSize: number;
  webpSize: number;
  thumbSize: number;
}

async function optimizeImages(): Promise<void> {
  console.log("Image optimization pipeline");
  console.log("===========================\n");

  // Ensure source directory exists
  if (!fs.existsSync(IMAGES_DIR)) {
    console.error(`Source directory does not exist: ${IMAGES_DIR}`);
    process.exit(1);
  }

  // Create output directories
  fs.mkdirSync(WEBP_DIR, { recursive: true });
  fs.mkdirSync(THUMBS_DIR, { recursive: true });

  const pngFiles = collectPngFiles();

  if (pngFiles.length === 0) {
    console.log("No PNG files found in", IMAGES_DIR);
    return;
  }

  console.log(`Found ${pngFiles.length} PNG files to process.`);
  console.log(`  WebP output  : ${WEBP_DIR}`);
  console.log(`  Thumbs output: ${THUMBS_DIR}`);
  console.log(`  Concurrency  : ${MAX_CONCURRENT}\n`);

  const limit = pLimit(MAX_CONCURRENT);

  let processed = 0;
  let totalOriginalSize = 0;
  let totalWebpSize = 0;
  let totalThumbSize = 0;
  let skippedCount = 0;
  const errors: { file: string; error: string }[] = [];

  const tasks = pngFiles.map((sourcePath) =>
    limit(async (): Promise<void> => {
      const baseName = path.basename(sourcePath, ".png");
      const webpPath = path.join(WEBP_DIR, `${baseName}.webp`);
      const thumbPath = path.join(THUMBS_DIR, `${baseName}.webp`);

      try {
        const originalSize = fs.statSync(sourcePath).size;
        totalOriginalSize += originalSize;

        const skipWebp = isUpToDate(sourcePath, webpPath);
        const skipThumb = isUpToDate(sourcePath, thumbPath);

        if (skipWebp && skipThumb) {
          // Both outputs are up to date -- still count their sizes for the report
          totalWebpSize += fs.statSync(webpPath).size;
          totalThumbSize += fs.statSync(thumbPath).size;
          skippedCount++;
        } else {
          // Generate WebP (full size)
          if (!skipWebp) {
            const webpBuffer = await sharp(sourcePath)
              .webp({ quality: WEBP_QUALITY })
              .toBuffer();
            fs.writeFileSync(webpPath, webpBuffer);
            totalWebpSize += webpBuffer.length;
          } else {
            totalWebpSize += fs.statSync(webpPath).size;
          }

          // Generate thumbnail (200px wide, WebP)
          if (!skipThumb) {
            const thumbBuffer = await sharp(sourcePath)
              .resize({ width: THUMB_WIDTH })
              .webp({ quality: THUMB_QUALITY })
              .toBuffer();
            fs.writeFileSync(thumbPath, thumbBuffer);
            totalThumbSize += thumbBuffer.length;
          } else {
            totalThumbSize += fs.statSync(thumbPath).size;
          }
        }
      } catch (err: any) {
        errors.push({ file: baseName, error: err.message });
      } finally {
        processed++;
        if (
          processed % 50 === 0 ||
          processed === pngFiles.length ||
          processed === 1
        ) {
          const pct = Math.round((processed / pngFiles.length) * 100);
          process.stdout.write(
            `\r  Progress: ${processed}/${pngFiles.length} (${pct}%)`,
          );
        }
      }
    }),
  );

  await Promise.all(tasks);

  // Final report
  console.log("\n");
  console.log("Results");
  console.log("-------");
  console.log(`  Total PNG files   : ${pngFiles.length}`);
  console.log(`  Skipped (up-to-date): ${skippedCount}`);
  console.log(`  Errors            : ${errors.length}`);
  console.log("");
  console.log(`  Original PNG total : ${formatBytes(totalOriginalSize)}`);
  console.log(`  WebP total         : ${formatBytes(totalWebpSize)}`);
  console.log(`  Thumbnails total   : ${formatBytes(totalThumbSize)}`);

  const webpSaved = totalOriginalSize - totalWebpSize;
  const webpPct =
    totalOriginalSize > 0
      ? Math.round((webpSaved / totalOriginalSize) * 100)
      : 0;
  const thumbSaved = totalOriginalSize - totalThumbSize;
  const thumbPct =
    totalOriginalSize > 0
      ? Math.round((thumbSaved / totalOriginalSize) * 100)
      : 0;
  const totalSaved = webpSaved + thumbSaved;

  console.log("");
  console.log(
    `  WebP savings       : ${formatBytes(webpSaved)} (${webpPct}% reduction)`,
  );
  console.log(
    `  Thumb savings      : ${formatBytes(thumbSaved)} (${thumbPct}% reduction vs original)`,
  );
  console.log(`  Combined savings   : ${formatBytes(totalSaved)}`);

  if (errors.length > 0) {
    console.log("\nErrors:");
    for (const { file, error } of errors) {
      console.log(`  - ${file}: ${error}`);
    }
  }

  console.log("\nDone.");
}

optimizeImages().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
