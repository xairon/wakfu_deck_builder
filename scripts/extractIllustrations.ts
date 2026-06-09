/**
 * Illustration extraction pipeline — GRIMOIRE data store
 *
 * Wakfu TCG cards share a consistent layout: a name bar at the top (~0-13%),
 * the painted ILLUSTRATION in the middle band (~14-58%), then type/stats/text
 * at the bottom. This script crops that illustration band from every card
 * image and stores it as a clean WebP, usable for deck banners, hero headers
 * and anywhere we want the art without the card frame.
 *
 * Source:  public/images/cards/<id>.webp       (et <id>_recto.webp pour héros)
 * Output:  public/images/illustrations/<id>.webp
 *
 * Usage: npx tsx scripts/extractIllustrations.ts [--force]
 */

import fs from "fs";
import path from "path";
import sharp from "sharp";

const IMAGES_DIR = path.join(process.cwd(), "public", "images", "cards");
const OUT_DIR = path.join(process.cwd(), "public", "images", "illustrations");

// Illustration band as a fraction of the card height/width.
// Regular cards: full-width middle band. Heroes (_recto) have a vertical
// stats column on the right, so we crop tighter on the right and taller.
// Bandes resserrées sur l'illustration peinte, à l'intérieur du cadre de la
// carte (on exclut les bordures latérales pour des bannières propres).
const BAND = { left: 0.07, top: 0.14, width: 0.86, height: 0.44 };
const HERO_BAND = { left: 0.06, top: 0.1, width: 0.66, height: 0.52 };
const WEBP_QUALITY = 82;
const MAX_CONCURRENT = 4;
const FORCE = process.argv.includes("--force");

function collectPngFiles(): string[] {
  return (
    fs
      .readdirSync(IMAGES_DIR, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".webp"))
      .map((e) => e.name)
      // heroes: keep the recto (portrait art), skip verso to avoid duplicates
      .filter((n) => !n.endsWith("_verso.webp"))
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

async function extractOne(
  fileName: string,
): Promise<"done" | "skip" | "error"> {
  const id = fileName.replace(/\.webp$/i, "").replace(/_recto$/i, "");
  const src = path.join(IMAGES_DIR, fileName);
  const out = path.join(OUT_DIR, `${id}.webp`);

  if (!FORCE && fs.existsSync(out)) {
    const s = fs.statSync(src);
    const o = fs.statSync(out);
    if (o.mtimeMs >= s.mtimeMs) return "skip";
  }

  try {
    const meta = await sharp(src).metadata();
    const W = meta.width ?? 0;
    const H = meta.height ?? 0;
    if (!W || !H) return "error";

    const band = /_recto\.webp$/i.test(fileName) ? HERO_BAND : BAND;
    const left = clamp(Math.round(W * band.left), 0, W - 1);
    const top = clamp(Math.round(H * band.top), 0, H - 1);
    const width = clamp(Math.round(W * band.width), 1, W - left);
    const height = clamp(Math.round(H * band.height), 1, H - top);

    await sharp(src)
      .extract({ left, top, width, height })
      .webp({ quality: WEBP_QUALITY })
      .toFile(out);
    return "done";
  } catch (err) {
    console.error(`  ✗ ${fileName}: ${(err as Error).message}`);
    return "error";
  }
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const files = collectPngFiles();
  console.log(
    `Extraction des illustrations — ${files.length} cartes${FORCE ? " (force)" : ""}`,
  );

  let done = 0,
    skip = 0,
    error = 0,
    n = 0;
  // Simple pool : MAX_CONCURRENT en vol, par lots.
  for (let i = 0; i < files.length; i += MAX_CONCURRENT) {
    const batch = files.slice(i, i + MAX_CONCURRENT);
    const results = await Promise.all(batch.map((f) => extractOne(f)));
    for (const r of results) {
      if (r === "done") done++;
      else if (r === "skip") skip++;
      else error++;
    }
    n += batch.length;
    if (n % 200 < MAX_CONCURRENT) console.log(`  …${n}/${files.length}`);
  }

  console.log(
    `\nTerminé : ${done} extraites, ${skip} à jour, ${error} erreurs → public/images/illustrations/`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
