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
  compileAppearanceTriggerText,
  compileBearerBonusText,
  compileCombatTriggerText,
  compileEffectText,
  compileStaticEffectText,
  compileTapEffectText,
  compileTurnStartEffectText,
  isInclineCostText,
  isPaidCostText,
  isRecycleCostText,
  isSacrificeCostText,
} from "../src/game/rules/effects/dsl";
import { CARD_SCRIPTS } from "../src/game/rules/effects/cardScripts";
import { OP_TO_MECHANIC } from "../src/data/mechanics";
import { GLOSSARY } from "../src/data/glossary";
import { cardSchema } from "../src/schema";

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
  value?: number;
  elements?: unknown[];
}
interface RawEffect {
  description?: string;
  compiled?: unknown;
  requiresIncline?: boolean;
  kind?: "ruling" | "errata";
  coverage?: "auto" | "manual" | "uncovered" | "ruling" | "keyword" | "trait";
  mechanics?: string[];
}
interface RawStats {
  niveau?: { element?: string };
  force?: { element?: string };
}
interface RawCard {
  name?: string;
  metier?: string[];
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
      // efface toute couverture/mécanique persistée : seule la boucle d'overrides
      // de CE run pourra reposer "manual", et la passe finale les re-dérive dans
      // un ordre déterministe (coverage puis mechanics).
      delete e.coverage;
      delete e.mechanics;
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
    // Pouvoir à coût d'inclinaison, pouvoir à COÛT PAYÉ « Inclinez/Détruisez
    // un de vos X : … » (isPaidCostText), pouvoir à COÛT D'INCLINAISON DE SOI
    // « Inclinez [cette carte] : … » (isInclineCostText) OU pouvoir à COÛT DE
    // SACRIFICE « Détruisez [cette carte] : … » (isSacrificeCostText), même sans
    // requiresIncline → parseur tap. Sinon Action → onPlay, sinon chaîne des
    // autres déclencheurs.
    const compiled =
      e.requiresIncline ||
      isPaidCostText(text) ||
      isInclineCostText(text) ||
      isSacrificeCostText(text) ||
      isRecycleCostText(text)
        ? // Un coût de RECYCLAGE sur une Action (Parchemins) compile en "onPlay"
          // (résolution au jeu) plutôt qu'en "onTap" — cf. compileTapEffectText.
          compileTapEffectText(text, cardName, sourceElement, isAction)
        : isAction
          ? compileActionEffectText(text, cardName, sourceElement)
          : (compileCombatTriggerText(text, cardName, sourceElement) ??
            compileAppearanceTriggerText(text, cardName, sourceElement) ??
            compileEffectText(text, cardName, sourceElement) ??
            compileTurnStartEffectText(text, cardName, sourceElement) ??
            compileStaticEffectText(text, cardName) ??
            compileBearerBonusText(text, cardName));
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

/** Définition officielle d'un terme du glossaire (clé normalisée). */
const GLOSSARY_BY_TERM = new Map(
  GLOSSARY.map((g) => [normText(g.term), g.definition]),
);

/**
 * Tokens mots-clés déversés dans `effects[]` par le scrape. Clé = description
 * normalisée (normText). `valued` : le token porte un nombre (« Capture : N »,
 * « Éthérée N »). `glossaryTerm` : terme à chercher dans GLOSSARY (normalisé) ;
 * absent → pas de définition connue (ex. Éthérée).
 */
const KEYWORD_TOKENS: Record<
  string,
  { name: string; glossaryTerm?: string; valued?: boolean }
> = {
  geant: { name: "Géant", glossaryTerm: "geant" },
  agilite: { name: "Agilité", glossaryTerm: "agilite" },
  agressivite: { name: "Agressivité", glossaryTerm: "agressivite" },
  tacle: { name: "Tacle", glossaryTerm: "tacle" },
  renfort: { name: "Renfort", glossaryTerm: "renfort" },
  defense: { name: "Défense", glossaryTerm: "defense" },
  fantome: { name: "Fantôme", glossaryTerm: "fantome" },
  capture: { name: "Capture", glossaryTerm: "capture", valued: true },
  // Éthérée : absent du glossaire snapshot → pas de définition (à récupérer).
  etheree: { name: "Éthérée", valued: true },
};

/**
 * Promeut les tokens mots-clés (description = un mot-clé seul, ou « Mot : N » /
 * « Mot N » pour les valués) en mots-clés STRUCTURÉS dans `keywords[]`, avec
 * leur valeur éventuelle et leur définition glossaire, et marque l'effet source
 * `coverage:"keyword"`. L'entrée d'effet reste (indices stables → CARD_SCRIPTS).
 * Dédup par nom → idempotent. Doit tourner APRÈS classifyKinds (qui efface
 * coverage) et avant assignCoverageAndMechanics (qui préserve "keyword").
 */
function promoteKeywords(card: RawCard): void {
  const visit = (effects: RawEffect[] | undefined) => {
    for (const e of effects ?? []) {
      if (e.kind) continue; // ruling/errata : pas un token mot-clé
      const t = normText(e?.description);
      if (!t) continue;
      // Match : mot seul, ou « mot : N » / « mot N » pour les valués.
      let token = KEYWORD_TOKENS[t];
      let value: number | undefined;
      if (!token) {
        const m = t.match(/^([a-zéèêàùûôîç]+)\s*:?\s*(\d+)$/);
        if (m && KEYWORD_TOKENS[m[1]]?.valued) {
          token = KEYWORD_TOKENS[m[1]];
          value = Number.parseInt(m[2], 10);
        }
      }
      if (!token) continue;
      card.keywords = card.keywords ?? [];
      if (!card.keywords.some((k) => k?.name === token!.name)) {
        const description = token.glossaryTerm
          ? (GLOSSARY_BY_TERM.get(token.glossaryTerm) ?? "")
          : "";
        const kw: RawKeyword = { name: token.name, description };
        if (value !== undefined) kw.value = value;
        card.keywords.push(kw);
      }
      e.coverage = "keyword";
    }
  };
  visit(card.effects);
  visit(card.recto?.effects);
  visit(card.verso?.effects);
}

/** Métiers (trait Artisan, glossaire « Métier »). Clé = description normalisée. */
const METIER_TOKENS: Record<string, string> = {
  bricoleur: "Bricoleur",
  forgeron: "Forgeron",
  bijoutier: "Bijoutier",
  armurier: "Armurier",
};

/**
 * Promeut les tokens TRAITS déversés dans `effects[]` (qui ne sont PAS des
 * effets) : le métier (Bricoleur/Forgeron/Bijoutier/Armurier) → champ typé
 * `card.metier` ; la restriction « Héros : X » → reclassée sans champ (X déjà
 * dans subTypes). Dans les deux cas l'effet source est marqué
 * `coverage:"trait"`. L'entrée d'effet reste (indices stables → CARD_SCRIPTS).
 * Doit tourner APRÈS classifyKinds et avant assignCoverageAndMechanics (qui
 * préserve "trait"). Dédup du métier (set-if-absent) → idempotent.
 */
function promoteTraits(card: RawCard): void {
  delete card.metier; // re-dérivé des tokens à chaque run (pas de valeur périmée)
  const visit = (effects: RawEffect[] | undefined) => {
    for (const e of effects ?? []) {
      if (e.kind) continue; // ruling/errata
      const t = normText(e?.description);
      if (!t) continue;
      const metier = METIER_TOKENS[t];
      if (metier) {
        card.metier = card.metier ?? [];
        if (!card.metier.includes(metier)) card.metier.push(metier);
        e.coverage = "trait";
        continue;
      }
      if (/^heros\s*:\s*.+$/.test(t)) {
        e.coverage = "trait"; // restriction classe/alignement (déjà en subTypes)
      }
    }
  };
  visit(card.effects);
  visit(card.recto?.effects);
  visit(card.verso?.effects);
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
      if (
        e.coverage !== "manual" &&
        e.coverage !== "keyword" &&
        e.coverage !== "trait"
      ) {
        e.coverage = e.kind ? "ruling" : e.compiled ? "auto" : "uncovered";
      }
      const ops = (e.compiled as { ops?: { op: string }[] } | undefined)?.ops;
      if (ops && ops.length) {
        e.mechanics = [
          ...new Set(
            ops.map((o) => {
              const tag = OP_TO_MECHANIC[o.op as keyof typeof OP_TO_MECHANIC];
              // Garde-fou à la frontière des données non typées : la table est
              // exhaustive sur l'union des ops, donc ceci ne devrait jamais
              // tirer — mais on échoue fort plutôt que de pousser `undefined`.
              if (!tag)
                throw new Error(`op non mappée vers une mécanique: ${o.op}`);
              return tag;
            }),
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
    classifyKinds(card);
    promoteKeywords(card);
    promoteTraits(card);
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
  // Validation à l'écriture : le pipeline REFUSE d'émettre des données non
  // conformes au schéma (source de vérité). Validation seule — n'altère rien.
  for (const card of cards) {
    const res = cardSchema.safeParse(card);
    if (!res.success) {
      const id = (card as { id?: string }).id ?? "?";
      const issue = res.error.issues[0];
      const where = issue?.path.length ? ` @ ${issue.path.join(".")}` : "";
      console.error(
        `✗ ${file}: carte ${id} invalide${where}: ${issue?.message ?? "invalide"}`,
      );
      process.exit(1);
    }
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
