/**
 * Récupère l'ÉLÉMENT IMPRIMÉ que le scrape initial (parseCardsV2) laissait
 * tomber pour les types SANS Force au JSON (Action / Équipement / Zone / Salle
 * / Dofus / Protecteur / Havre-Sac). Sans lui, ces cartes étaient stockées
 * Neutre → production de Ressource Neutre + introuvables par couleur dans la
 * collection (bug rapporté).
 *
 * Le symbole coloré d'une carte vit à DEUX endroits selon son type, jamais aux
 * deux à la fois :
 *   - orbe « Élément : [X] » (en haut à droite) ;
 *   - ligne « Force : ±N [X] », pour les Équipements qui donnent de la Force —
 *     leur SEUL symbole coloré, car ils n'ont pas d'orbe (131 cartes).
 * Le repli Force ne se limite donc pas aux Forces négatives : il couvre `+N`,
 * `-N` et `N`. Il ne s'applique qu'aux cartes sans `stats.force` au JSON, les
 * Alliés/Héros résolvant déjà leur Élément par `stats.force.element`.
 *
 * Source : raw-card-data/pages/<ext>/<slug>.html (déjà téléchargé). Écrit le
 * champ top-level `card.element` dans public/data/<ext>.json.
 *
 * Idempotent : relançable sans effet cumulatif (écrase `element`).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const RAW_DIR = "raw-card-data/pages";
const DATA_DIR = "public/data";

const ORB_RE = /Élément\s*:\s*<img[^>]*?title="([^"]+)"/s;
const FORCE_RE = /Force\s*:\s*[-+]?\d+\s*<img[^>]*?title="([^"]+)"/s;

const VALID = new Set(["Air", "Eau", "Feu", "Terre", "Neutre"]);

/**
 * Élément imprimé lu sur la page archivée d'une carte.
 * @param {string} html page brute de la carte
 * @param {{ hasForceStat?: boolean }} [opts] `hasForceStat` : le JSON porte déjà
 *   une Force (Allié/Héros) → pas de repli sur le symbole de Force.
 * @returns {{ element: string, source: "orb" | "force" } | null} null si la page
 *   n'expose aucun symbole exploitable (dont Force Neutre : rien à récupérer).
 */
export function extractPrintedElement(html, { hasForceStat = false } = {}) {
  const orb = html.match(ORB_RE);
  if (orb && VALID.has(orb[1])) return { element: orb[1], source: "orb" };
  if (hasForceStat) return null;

  const force = html.match(FORCE_RE);
  if (force && VALID.has(force[1]) && force[1] !== "Neutre")
    return { element: force[1], source: "force" };
  return null;
}

/** Exécution directe : réécrit `element` dans public/data/<ext>.json. */
if (process.argv[1]?.endsWith("recoverElementOrb.mjs")) {
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

      const found = extractPrintedElement(readFileSync(htmlPath, "utf8"), {
        hasForceStat: Boolean(card.stats?.force),
      });
      if (!found) continue;

      if (found.source === "force") totalForceFallback++;
      else if (found.element === "Neutre") totalNeutreBackfill++;
      else totalOrb++;

      if (card.element !== found.element) {
        card.element = found.element;
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
}
