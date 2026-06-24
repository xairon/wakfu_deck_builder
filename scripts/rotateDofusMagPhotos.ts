/**
 * Rotate the Dofus Mag deck photos 180° (they were shot upside-down) into a
 * sibling folder so OCR/vision reads right-side-up text. Derived artifact —
 * the output folder is gitignored. Re-run with: `npx tsx scripts/rotateDofusMagPhotos.ts`
 */
import sharp from "sharp";
import { readdirSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const SRC = resolve(__dirname, "../dofus_mag_decks");
const OUT = resolve(__dirname, "../dofus_mag_decks_rotated");

if (!existsSync(OUT)) mkdirSync(OUT);

async function main() {
  const files = readdirSync(SRC).filter((f) => /\.jpe?g$/i.test(f));
  let done = 0;
  await Promise.all(
    files.map(async (f) => {
      await sharp(join(SRC, f)).rotate(180).toFile(join(OUT, f));
      done++;
    }),
  );
  console.log(`Rotated ${done}/${files.length} → ${OUT}`);
}

main();
