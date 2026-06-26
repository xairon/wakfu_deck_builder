/**
 * Migration / compilation des données de cartes — `npm run compile-effects`.
 *
 * Réécrit les fichiers d'extensions de public/data/*.json :
 * 1. NORMALISE tous les champs d'élément vers la forme canonique des types
 *    TS ("Air" | "Eau" | "Feu" | "Terre" | "Neutre") — la casse variait
 *    entre extensions ("Feu" vs "terre") et cassait toute comparaison.
 * 2. NETTOIE les mots-clés : seuls les noms réels sont conservés
 *    (Résistance, Recette…) ; le bruit de scraping ("Le", "Cette", ",") est
 *    retiré ; "**Résistance" est corrigé.
 * 3. COMPILE les effets : `effects[].compiled` reçoit la forme machine du
 *    DSL strict quand le texte est entièrement compris (sinon absent).
 *
 * Idempotent : relancer le script ne change rien de plus.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  compileActionEffectText,
  compileCombatTriggerText,
  compileEffectText,
  compileStaticEffectText,
  compileTapEffectText,
  compileTurnStartEffectText,
} from "../src/game/rules/effects/dsl";
import { CARD_SCRIPTS } from "../src/game/rules/effects/cardScripts";
import { OP_TO_MECHANIC } from "../src/data/mechanics";

const DATA_DIR = join(__dirname, "..", "public", "data");
const EXTENSION_FILES = [
  "amakna.json",
  "ankama-convention-5.json",
  "astrub.json",
  "bonta-brakmar.json",
  "chaos-dogrest.json",
  "dofus-collection.json",
  "draft.json",
  "ile-des-wabbits.json",
  "incarnam.json",
  "otomai.json",
  "pandala.json",
];

const CANONICAL_ELEMENTS: Record<string, string> = {
  air: "Air",
  eau: "Eau",
  feu: "Feu",
  terre: "Terre",
  neutre: "Neutre",
};

const REAL_KEYWORDS = new Set([
  "Inclinaison",
  "Riposte",
  "Portée",
  "Critique",
  "Parade",
  "Résistance",
  "Recette",
  "Géant",
  "Unique",
]);

function canonElement(el: unknown): unknown {
  if (typeof el !== "string") return el;
  return CANONICAL_ELEMENTS[el.trim().toLowerCase()] ?? el;
}

/** Normalise récursivement tout champ `element` / `elements`. */
function normalizeElements(node: unknown): void {
  if (Array.isArray(node)) {
    for (const item of node) normalizeElements(item);
    return;
  }
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  if (typeof obj.element === "string") obj.element = canonElement(obj.element);
  if (Array.isArray(obj.elements))
    obj.elements = obj.elements.map(canonElement);
  for (const value of Object.values(obj)) normalizeElements(value);
}

interface RawKeyword {
  name?: string;
  description?: string;
  elements?: unknown[];
}
interface RawEffect {
  description?: string;
  compiled?: unknown;
  requiresIncline?: boolean;
  kind?: "ruling" | "errata";
  coverage?: "auto" | "manual" | "uncovered" | "ruling";
  mechanics?: string[];
}
interface RawStats {
  niveau?: { element?: string };
  force?: { element?: string };
}
interface RawCard {
  name?: string;
  stats?: RawStats;
  keywords?: RawKeyword[];
  effects?: RawEffect[];
  notes?: unknown[];
  recto?: { stats?: RawStats; effects?: RawEffect[]; keywords?: RawKeyword[] };
  verso?: { stats?: RawStats; effects?: RawEffect[]; keywords?: RawKeyword[] };
}

/** Élément des Dommages des effets de la carte (410.1), après normalisation. */
function sourceElementOf(card: RawCard): string {
  const s = card.stats ?? card.recto?.stats;
  return s?.force?.element ?? s?.niveau?.element ?? "Neutre";
}

const stats = {
  cards: 0,
  effects: 0,
  compiled: 0,
  optional: 0,
  keywordsDropped: 0,
  scripted: 0,
  rulings: 0,
  erratas: 0,
  ops: new Map<string, number>(),
};

/** Normalisation de comparaison texte (accents, casse, espaces). */
function normText(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

const ERRATA_RE = /^cette carte a recu un\b.*\berrata/;

/**
 * Classification rulings/erratas : le scraping a recopié dans `effects[]`
 * des paragraphes qui sont en réalité des NOTES de règles du site (ils
 * figurent aussi dans `notes[]`) ou des erratas officiels. Ils ne sont pas
 * du texte imprimé : on les marque `kind` pour les exclure du comptage
 * d'effets et de la compilation. Re-dérivé à chaque run (idempotent).
 */
function classifyKinds(card: RawCard): void {
  const notes = new Set((card.notes ?? []).map(normText).filter(Boolean));
  const visit = (effects: RawEffect[] | undefined) => {
    for (const e of effects ?? []) {
      delete e.coverage; // efface toute couverture persistée : seule la boucle d'overrides de CE run pourra reposer "manual"
      const t = normText(e?.description);
      if (!t) continue;
      if (notes.has(t) || ERRATA_RE.test(t)) {
        e.kind = ERRATA_RE.test(t) ? "errata" : "ruling";
        delete e.compiled;
        if (e.kind === "errata") stats.erratas++;
        else stats.rulings++;
      } else {
        delete e.kind;
      }
    }
  };
  visit(card.effects);
  visit(card.recto?.effects);
  visit(card.verso?.effects);
}

function cleanKeywords(keywords: RawKeyword[] | undefined): RawKeyword[] {
  if (!keywords) return [];
  const kept: RawKeyword[] = [];
  for (const k of keywords) {
    let name = String(k?.name ?? "").trim();
    if (name.startsWith("**")) name = name.replace(/^\*+/, "");
    if (REAL_KEYWORDS.has(name)) kept.push({ ...k, name });
    else stats.keywordsDropped++;
  }
  return kept;
}

function compileEffects(
  effects: RawEffect[] | undefined,
  cardName: string,
  sourceElement: string,
  isAction = false,
): void {
  for (const e of effects ?? []) {
    if (e.kind) continue; // note de règle / errata : pas un effet imprimé
    const text = String(e?.description ?? "").trim();
    if (!text) continue;
    stats.effects++;
    const compiled = e.requiresIncline
      ? compileTapEffectText(text, cardName, sourceElement)
      : isAction
        ? compileActionEffectText(text, cardName, sourceElement)
        : (compileCombatTriggerText(text, cardName) ??
          compileEffectText(text, cardName, sourceElement) ??
          compileTurnStartEffectText(text, cardName, sourceElement) ??
          compileStaticEffectText(text, cardName));
    if (compiled) {
      e.compiled = compiled;
      stats.compiled++;
      if (compiled.optional) stats.optional++;
      for (const op of compiled.ops)
        stats.ops.set(op.op, (stats.ops.get(op.op) ?? 0) + 1);
    } else {
      delete e.compiled; // re-run propre si la grammaire change
    }
  }
}

/**
 * Havre-Sac : extrait Taille/Résistance des subTypes (« Taille 4 »,
 * « Résistance 15 ») vers stats.taille / stats.resistance (2303/2315).
 */
function extractBagStats(card: RawCard): void {
  if ((card as { mainType?: string }).mainType !== "Havre-Sac") return;
  const subTypes = (card as { subTypes?: string[] }).subTypes ?? [];
  for (const s of subTypes) {
    const m = String(s).match(/^(Taille|Résistance)\s+(\d+)$/);
    if (!m) continue;
    card.stats = card.stats ?? {};
    const st = card.stats as { taille?: number; resistance?: number };
    if (m[1] === "Taille") st.taille = Number.parseInt(m[2], 10);
    else st.resistance = Number.parseInt(m[2], 10);
  }
}

/**
 * Promeut les mots-clés détectés par texte d'effet en mots-clés STRUCTURÉS
 * (idée volée à un schéma communautaire) — ex. l'effet « Géant ».
 */
function promoteTextKeywords(card: RawCard): void {
  const hasGeantText = (card.effects ?? []).some(
    (e) => String(e?.description ?? "").trim() === "Géant",
  );
  if (!hasGeantText) return;
  card.keywords = card.keywords ?? [];
  if (!card.keywords.some((k) => k?.name === "Géant")) {
    card.keywords.push({
      name: "Géant",
      description: "Répartit sa Force entre tous ses bloqueurs (6135).",
    });
  }
}

/**
 * Passe finale : pose un statut de couverture EXPLICITE sur chaque effet et
 * dérive ses mécaniques depuis les ops compilées. La couverture persistée est
 * effacée en amont dans `classifyKinds`, donc le seul `manual` présent ici est
 * celui que la boucle d'overrides a posé durant CE run ; le reste est dérivé de
 * l'état final (kind/compiled).
 */
function assignCoverageAndMechanics(card: RawCard): void {
  const visit = (effects: RawEffect[] | undefined) => {
    for (const e of effects ?? []) {
      if (e.coverage !== "manual") {
        e.coverage = e.kind ? "ruling" : e.compiled ? "auto" : "uncovered";
      }
      const ops = (e.compiled as { ops?: { op: string }[] } | undefined)?.ops;
      if (ops && ops.length) {
        e.mechanics = [
          ...new Set(
            ops.map((o) => OP_TO_MECHANIC[o.op as keyof typeof OP_TO_MECHANIC]),
          ),
        ];
      } else {
        delete e.mechanics;
      }
    }
  };
  visit(card.effects);
  visit(card.recto?.effects);
  visit(card.verso?.effects);
}

for (const file of EXTENSION_FILES) {
  const path = join(DATA_DIR, file);
  const cards = JSON.parse(readFileSync(path, "utf8")) as RawCard[];
  for (const card of cards) {
    stats.cards++;
    normalizeElements(card);
    card.keywords = cleanKeywords(card.keywords);
    extractBagStats(card);
    promoteTextKeywords(card);
    classifyKinds(card);
    const name = String(card.name ?? "");
    const element = sourceElementOf(card);
    compileEffects(
      card.effects,
      name,
      element,
      (card as { mainType?: string }).mainType === "Action",
    );
    if (card.recto) {
      card.recto.keywords = cleanKeywords(card.recto.keywords);
      compileEffects(card.recto.effects, name, element);
    }
    if (card.verso) {
      card.verso.keywords = cleanKeywords(card.verso.keywords);
      compileEffects(card.verso.effects, name, element);
    }
    // registre de scripts MANUELS : l'entrée écrite à la main gagne sur
    // l'auto-compilation (approche XMage, carte par carte). Une entrée
    // `{ kind }` classe l'effet ruling/errata au lieu de le compiler.
    const overrides = CARD_SCRIPTS[(card as { id?: string }).id ?? ""];
    if (overrides) {
      for (const [idx, entry] of Object.entries(overrides)) {
        const eff = card.effects?.[Number(idx)];
        if (!eff) continue;
        if (!("ops" in entry)) {
          if (!eff.kind) {
            if (entry.kind === "errata") stats.erratas++;
            else stats.rulings++;
          }
          eff.kind = entry.kind;
          delete eff.compiled;
          continue;
        }
        if (!eff.compiled) stats.compiled++;
        delete eff.kind;
        eff.compiled = entry;
        eff.coverage = "manual";
        stats.scripted++;
      }
    }
    assignCoverageAndMechanics(card);
  }
  writeFileSync(path, JSON.stringify(cards, null, 2) + "\n", "utf8");
  console.log(`✓ ${file} (${cards.length} cartes)`);
}

console.log(
  `\nCartes: ${stats.cards} · Effets: ${stats.effects} · Compilés: ${stats.compiled}` +
    ` (dont optionnels: ${stats.optional}) · Mots-clés bruités retirés: ${stats.keywordsDropped} · Scripts manuels: ${stats.scripted}` +
    ` · Rulings: ${stats.rulings} · Erratas: ${stats.erratas}`,
);
for (const [op, n] of [...stats.ops.entries()].sort((a, b) => b[1] - a[1]))
  console.log(`  op ${op}: ${n}`);
