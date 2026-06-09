/**
 * Régénère toutes les images de cartes : retire le filigrane wtcg-return et
 * agrandit ×2, sortie WebP (q90) — ~3× plus léger que les PNG actuels tout en
 * doublant la résolution. Les .png d'origine sont conservés tant que la
 * vérification n'est pas faite ; supprimés ensuite par le script appelant.
 *
 *   node scripts/generateCleanCards.js
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { processBuffer } = require("./dewatermark.js");

const DIR = path.resolve(__dirname, "../public/images/cards");
const SCALE = 2;
const QUALITY = 90;

async function main() {
  const files = fs
    .readdirSync(DIR)
    .filter((f) => f.toLowerCase().endsWith(".png"));
  console.log(`${files.length} PNG à traiter → WebP ${SCALE}× q${QUALITY}`);

  const concurrency = Math.max(2, Math.min(8, os.cpus().length - 1));
  let i = 0,
    ok = 0,
    fail = 0;
  const failures = [];

  async function worker() {
    while (i < files.length) {
      const idx = i++;
      const f = files[idx];
      const src = path.join(DIR, f);
      const out = path.join(DIR, f.replace(/\.png$/i, ".webp"));
      try {
        const buf = await processBuffer(fs.readFileSync(src), {
          scale: SCALE,
          format: "webp",
          quality: QUALITY,
        });
        fs.writeFileSync(out, buf);
        ok++;
      } catch (e) {
        fail++;
        failures.push(f + " :: " + e.message);
      }
      if ((ok + fail) % 200 === 0)
        console.log(`  ${ok + fail}/${files.length} (ok ${ok}, fail ${fail})`);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  console.log(`Terminé : ${ok} OK, ${fail} échecs.`);
  if (failures.length) {
    console.log("Échecs :\n" + failures.slice(0, 30).join("\n"));
    process.exitCode = 1;
  }
}

main();
