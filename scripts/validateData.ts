/**
 * Validation des données — garde-fou du store GRIMOIRE.
 *
 * Vérifie, sans dépendance externe :
 *  - chaque base de cartes (public/data/<extension>.json) : champs requis,
 *    énumérations (mainType, rarity, éléments), id en slug, doublons d'id ;
 *  - errata.json : les clés référencent de vraies cartes ;
 *  - community-decks.json : héros / havre-sac / cartes résolus par nom.
 *
 * Sortie non nulle si erreurs (utilisable en CI).
 * Usage: npm run validate-data
 */

import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "public", "data");
const ILLUST_DIR = path.join(
  process.cwd(),
  "public",
  "images",
  "illustrations",
);

const MAIN_TYPES = new Set([
  "Action",
  "Allié",
  "Allié Élémentaire",
  "Dofus",
  "Équipement",
  "Havre-Sac",
  "Héros",
  "Protecteur",
  "Salle",
  "Zone",
]);
const RARITIES = new Set([
  "Commune",
  "Peu Commune",
  "Rare",
  "Mythique",
  "Légendaire",
  "Krosmaster",
]);
const ELEMENTS = new Set(["air", "eau", "feu", "terre", "neutre"]);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const errors: string[] = [];
const warnings: string[] = [];
const err = (m: string) => errors.push(m);
const warn = (m: string) => warnings.push(m);

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8"));
}

// ── Cartes ──
const byId = new Map<string, any>();
const byName = new Map<string, any[]>();
let cardFiles = 0;
let cardCount = 0;

for (const file of fs.readdirSync(DATA_DIR)) {
  if (!file.endsWith(".json")) continue;
  let data: unknown;
  try {
    data = readJson(file);
  } catch (e) {
    err(`${file}: JSON invalide (${(e as Error).message})`);
    continue;
  }
  // Une base de cartes = un tableau dont les éléments ont un mainType.
  if (!Array.isArray(data) || !data.length || !("mainType" in (data[0] ?? {})))
    continue;

  cardFiles++;
  data.forEach((c: any, i: number) => {
    cardCount++;
    const where = `${file}[${i}] (${c?.id ?? c?.name ?? "?"})`;
    if (!c.id || typeof c.id !== "string") err(`${where}: id manquant`);
    else {
      if (!SLUG.test(c.id)) warn(`${where}: id non-slug "${c.id}"`);
      if (byId.has(c.id)) err(`${where}: id en double "${c.id}"`);
      else byId.set(c.id, c);
    }
    if (!c.name) err(`${where}: name manquant`);
    else {
      const k = c.name.toLowerCase();
      if (!byName.has(k)) byName.set(k, []);
      byName.get(k)!.push(c);
    }
    if (!MAIN_TYPES.has(c.mainType))
      err(`${where}: mainType invalide "${c.mainType}"`);
    if (!RARITIES.has(c.rarity))
      warn(`${where}: rarity inattendue "${c.rarity}"`);
    if (!c.extension?.name) warn(`${where}: extension.name manquant`);
    for (const stat of ["niveau", "force"] as const) {
      const el = c.stats?.[stat]?.element;
      if (el !== undefined && !ELEMENTS.has(String(el).toLowerCase()))
        err(`${where}: ${stat}.element invalide "${el}"`);
    }
    if (Array.isArray(c.effects))
      c.effects.forEach((e: any, j: number) => {
        if (!e?.description)
          err(`${where}: effects[${j}].description manquant`);
      });
  });
}

// ── Erratas ──
if (fs.existsSync(path.join(DATA_DIR, "errata.json"))) {
  try {
    const e = readJson("errata.json") as any;
    for (const id of Object.keys(e?.errata ?? {})) {
      if (!byId.has(id)) err(`errata.json: id de carte inconnu "${id}"`);
      for (const [k, entry] of (e.errata[id] as any[]).entries()) {
        if (!entry?.date) err(`errata.json[${id}][${k}]: date manquante`);
        if (!entry?.summary) err(`errata.json[${id}][${k}]: summary manquant`);
      }
    }
  } catch (e) {
    err(`errata.json: ${(e as Error).message}`);
  }
}

// ── Decks externes ──
function resolveName(name?: string): boolean {
  if (!name) return false;
  return byName.has(name.toLowerCase());
}
if (fs.existsSync(path.join(DATA_DIR, "community-decks.json"))) {
  try {
    const cd = readJson("community-decks.json") as any;
    for (const d of cd?.decks ?? []) {
      const w = `community-decks.json "${d.id ?? d.name}"`;
      if (!d.id || !SLUG.test(d.id)) err(`${w}: id manquant/non-slug`);
      if (!d.source) err(`${w}: source manquante`);
      if (d.hero && !resolveName(d.hero))
        err(`${w}: héros introuvable "${d.hero}"`);
      if (d.havreSac && !resolveName(d.havreSac))
        err(`${w}: havre-sac introuvable "${d.havreSac}"`);
      for (const c of d.cards ?? []) {
        if (!resolveName(c.name)) err(`${w}: carte introuvable "${c.name}"`);
        if (!(c.quantity >= 1 && c.quantity <= 3))
          warn(`${w}: quantité hors 1-3 pour "${c.name}" (${c.quantity})`);
      }
    }
  } catch (e) {
    err(`community-decks.json: ${(e as Error).message}`);
  }
}

// ── Illustrations (info) ──
let illust = 0;
if (fs.existsSync(ILLUST_DIR))
  illust = fs.readdirSync(ILLUST_DIR).filter((f) => f.endsWith(".webp")).length;

// ── Rapport ──
console.log(
  `Cartes : ${cardCount} dans ${cardFiles} bases · ${byId.size} ids uniques · ${illust} illustrations`,
);
if (warnings.length) {
  console.log(`\n⚠ ${warnings.length} avertissement(s) :`);
  warnings.slice(0, 25).forEach((w) => console.log("  ·", w));
  if (warnings.length > 25) console.log(`  … +${warnings.length - 25}`);
}
if (errors.length) {
  console.log(`\n✗ ${errors.length} erreur(s) :`);
  errors.slice(0, 40).forEach((e) => console.log("  ·", e));
  if (errors.length > 40) console.log(`  … +${errors.length - 40}`);
  process.exit(1);
}
console.log("\n✓ Données valides.");
