/**
 * Récupère l'ÉLÉMENT IMPRIMÉ (orbe « Élément : [X] », en haut à droite) que le
 * scrape initial (parseCardsV2) laissait tomber pour les types SANS Force
 * (Action / Équipement / Zone / Salle / Dofus / Protecteur / Havre-Sac). Sans
 * cet orbe, ces cartes étaient stockées Neutre → production de Ressource Neutre
 * + introuvables par couleur dans la collection (bug rapporté).
 *
 * Source : raw-card-data/pages/<ext>/<slug>.html (déjà téléchargé). Écrit le
 * champ top-level `card.element` dans public/data/<ext>.json.
 *
 * Repli : les 2 Équipements dont l'élément vit dans « Force : -N [X] » (Force
 * négative, non capturée par le parser) — on lit ce symbole faute d'orbe.
 *
 * Idempotent : relançable sans effet cumulatif (écrase `element`). Ne touche PAS
 * les cartes à Force (Alliés/Héros) ni les 12 Actions à Force colorée (déjà
 * correctes via le repli Force de `producedElement`).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const RAW_DIR = "raw-card-data/pages";
const DATA_DIR = "public/data";

const ORB_RE = /Élément\s*:\s*<img[^>]*?title="([^"]+)"/s;
const FORCE_RE = /Force\s*:\s*-?\d+\s*<img[^>]*?title="([^"]+)"/s;

const VALID = new Set(["Air", "Eau", "Feu", "Terre", "Neutre"]);

/** Extensions ayant des pages brutes ET un JSON homonyme. */
const exts = readdirSync(RAW_DIR).filter((e) =>
  existsSync(join(DATA_DIR, `${e}.json`)),
);

let totalOrb = 0;
let totalForceFallback = 0;
let totalNeutreBackfill = 0;
const changedFiles = [];

for (const ext of exts) {
  const jsonPath = join(DATA_DIR, `${ext}.json`);
  const cards = JSON.parse(readFileSync(jsonPath, "utf8"));
  let changed = 0;

  for (const card of cards) {
    // slug = id sans le suffixe « -<ext> ».
    const suffix = `-${ext}`;
    const slug = card.id.endsWith(suffix)
      ? card.id.slice(0, -suffix.length)
      : card.id;
    const htmlPath = join(RAW_DIR, ext, `${slug}.html`);
    if (!existsSync(htmlPath)) continue;
    const html = readFileSync(htmlPath, "utf8");

    let el = null;
    const orb = html.match(ORB_RE);
    if (orb && VALID.has(orb[1])) {
      el = orb[1];
      if (el === "Neutre") totalNeutreBackfill++;
      else totalOrb++;
    } else if (!card.stats?.force) {
      // Pas d'orbe : repli sur le symbole de « Force : -N [X] » si le JSON n'a
      // pas de Force (les 2 Équipements à Force négative droppée).
      const force = html.match(FORCE_RE);
      if (force && VALID.has(force[1]) && force[1] !== "Neutre") {
        el = force[1];
        totalForceFallback++;
      }
    }

    if (el && card.element !== el) {
      card.element = el;
      changed++;
    }
  }

  if (changed > 0) {
    writeFileSync(jsonPath, JSON.stringify(cards, null, 2) + "\n", "utf8");
    changedFiles.push(jsonPath);
    console.log(`${ext}.json: +${changed} cartes avec Élément récupéré`);
  }
}

console.log(
  `\nTotal — orbe coloré: ${totalOrb}, orbe Neutre (backfill): ${totalNeutreBackfill}, repli Force: ${totalForceFallback}`,
);
console.log(`Fichiers modifiés: ${changedFiles.length}`);
