/**
 * RÉCUPÉRATION D'ICÔNES/MOTS-CLÉS PERDUS AU SCRAPE (2026-07) — les textes
 * d'effet « … gagne +N en Force et . » / « … et jusqu'à la fin du tour »
 * avaient perdu un token `<strong>Mot-clé</strong>` (Géant, Agilité…) que le
 * scraper d'origine avalait. On re-parse les pages BRUTES
 * (raw-card-data/pages/<ext>/<slug>.html, bloc « Effets : » → <li>) et on
 * remplace la description CASSÉE par le texte COMPLET (les <strong> gardés en
 * clair, les <img> remplacés par leur alt entre crochets — convention [Feu]).
 *
 * STRICT : une description n'est remplacée que si (a) sa version « sans les
 * tokens récupérés » correspond à l'existante (sous-séquence de mots) et
 * (b) le texte récupéré diffère. Aucune devinette : page absente ou <li> non
 * apparié → on laisse tel quel (listé en sortie).
 *
 * Usage : npx tsx scripts/recoverDroppedStrong.ts (puis npm run compile-effects)
 */
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "public", "data");
const PAGES_DIR = join(process.cwd(), "raw-card-data", "pages");

interface RawEffect {
  description?: string;
  [k: string]: unknown;
}
interface RawCard {
  id: string;
  name: string;
  effects?: RawEffect[];
  [k: string]: unknown;
}

/** Les <li> du bloc « Effets : » d'une page brute, en texte complet. */
function pageEffectTexts(html: string): string[] {
  const at = html.indexOf("Effets :");
  if (at < 0) return [];
  const ulStart = html.indexOf("<ul>", at);
  const ulEnd = html.indexOf("</ul>", ulStart);
  if (ulStart < 0 || ulEnd < 0) return [];
  const ul = html.slice(ulStart, ulEnd);
  const out: string[] = [];
  for (const m of ul.matchAll(/<li>([\s\S]*?)<\/li>/g)) {
    let t = m[1];
    // <img alt="Feu"> → [Feu] (convention des textes existants, cf. Katsou).
    t = t.replace(/<img[^>]*alt="([^"]+)"[^>]*\/?>/g, "[$1]");
    // <strong>X</strong> → X (le token que le scrape d'origine perdait).
    t = t.replace(/<\/?strong>/g, "");
    // reste de balises → rien ; entités usuelles ; espaces normalisés.
    t = t.replace(/<[^>]+>/g, " ");
    t = t
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .replace(/&#039;|&apos;/g, "'")
      .replace(/&quot;/g, '"');
    t = t.replace(/\s+/g, " ").trim();
    if (t) out.push(t);
  }
  return out;
}

/** Normalisation de comparaison : espaces réduits, ponctuation terminale ôtée. */
function cmp(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/\s*[.]\s*$/, "")
    .trim();
}

/** La description CASSÉE correspond-elle au texte récupéré privé de ses tokens ?
 *  On ne tolère que des AJOUTS côté récupéré : la cassée doit être une
 *  sous-séquence stricte des mots du récupéré. */
function brokenMatchesRecovered(broken: string, recovered: string): boolean {
  const b = cmp(broken).split(" ");
  const r = cmp(recovered).split(" ");
  let i = 0;
  for (const w of r) {
    if (i < b.length && b[i] === w) i++;
  }
  return i === b.length && r.length > b.length;
}

const DANGLING = / et (\.|,|jusqu)| et$/;

let fixed = 0;
let skipped = 0;
for (const file of readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"))) {
  const ext = file.replace(/\.json$/, "");
  const path = join(DATA_DIR, file);
  let cards: RawCard[];
  try {
    cards = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    continue;
  }
  if (!Array.isArray(cards)) continue;
  let touched = false;
  for (const card of cards) {
    for (const e of card.effects ?? []) {
      const desc = (e.description ?? "").replace(/\s+/g, " ").trim();
      if (!DANGLING.test(desc)) continue;
      const slug = card.id.endsWith(`-${ext}`)
        ? card.id.slice(0, -(ext.length + 1))
        : card.id;
      const page = join(PAGES_DIR, ext, `${slug}.html`);
      if (!existsSync(page)) {
        console.log(`SKIP (page absente) ${card.name} [${ext}/${slug}]`);
        skipped++;
        continue;
      }
      const texts = pageEffectTexts(readFileSync(page, "utf8"));
      const match = texts.find((t) => brokenMatchesRecovered(desc, t));
      if (!match) {
        console.log(
          `SKIP (li non apparié) ${card.name} :: ${desc.slice(0, 70)}`,
        );
        skipped++;
        continue;
      }
      console.log(`FIX  ${card.name}`);
      console.log(`   - ${desc.slice(0, 100)}`);
      console.log(`   + ${match.slice(0, 100)}`);
      e.description = match;
      touched = true;
      fixed++;
    }
  }
  if (touched)
    writeFileSync(path, JSON.stringify(cards, null, 2) + "\n", "utf8");
}
console.log(`\nrécupérés: ${fixed}, laissés tels quels: ${skipped}`);
