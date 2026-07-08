/**
 * Aides de glossaire « à surfacer » pour aider à lire une carte : quand une carte
 * porte un terme de mécanique NON évident (Métier, Recette, Agilité, Géant…), on
 * propose sa définition de glossaire — sans avoir à survoler le mot.
 *
 * On reste sur une liste CURÉE : surfacer TOUT terme noierait la fiche (presque
 * chaque carte parle de Force, Niveau, Allié, Dommage, Ressource…).
 *
 * Trois sources sont inspectées :
 *  1. le TEXTE D'EFFET (ex. Amar Casto « … gagne le Métier … ») ;
 *  2. les MOTS-CLEFS dont la puce n'affiche qu'une valeur/un coût, pas le sens —
 *     Recette (« : Bijoutier 3 »), Résistance (« 1 ») ;
 *  3. le MÉTIER de la carte (card.metier) et les Métiers cités dans un coût de
 *     Recette — les 4 professions n'ayant pas d'entrée propre, on renvoie « Métier ».
 */
import { GLOSSARY, type GlossaryTerm } from "@/data/glossary";

/** Termes de mécanique surfacés dès qu'ils apparaissent dans le TEXTE D'EFFET. */
const EFFECT_TERMS = [
  "Métier",
  "Artisan",
  "Agilité",
  "Agressivité",
  "Tacle",
  "Renfort",
  "Fantôme",
  "Géant",
  "Capture",
  "Réaction",
  "Fabriquer",
  "Familier",
  "Invocation",
  "Recycler",
] as const;

/** Mots-clefs dont la puce ne montre qu'une valeur/un coût → on ajoute le sens. */
const KEYWORD_TERMS = ["Recette", "Résistance"] as const;

/** Les 4 Métiers : aucune entrée de glossaire propre → on renvoie « Métier ». */
const PROFESSIONS = ["Bijoutier", "Forgeron", "Armurier", "Bricoleur"] as const;

const GLOSSARY_BY_TERM = new Map(GLOSSARY.map((g) => [g.term, g]));

/** Le terme apparaît-il comme MOT ENTIER ? (bornes = non-lettres, `\p{L}` gère
 *  les accents : « Métier », « Agilité », « Recette »…) */
function mentions(text: string, term: string): boolean {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}])${esc}([^\\p{L}]|$)`, "u").test(text);
}

export interface GlossaryHintInput {
  /** Texte des effets réels concaténé. */
  effectsText?: string;
  /** Noms des mots-clefs structurés de la carte (keywords[].name). */
  keywordNames?: readonly string[];
  /** Descriptions des mots-clefs (keywords[].description) — ex. coût de Recette. */
  keywordDescriptions?: readonly string[];
  /** Métier(s) de la carte (card.metier). */
  metier?: readonly string[];
}

/**
 * Définitions de glossaire à afficher pour une carte (dé-doublonnées).
 */
export function glossaryHints(input: GlossaryHintInput): GlossaryTerm[] {
  const out: GlossaryTerm[] = [];
  const seen = new Set<string>();
  const push = (term: string): void => {
    const g = GLOSSARY_BY_TERM.get(term);
    if (g && !seen.has(term)) {
      out.push(g);
      seen.add(term);
    }
  };

  const text = input.effectsText ?? "";
  const kwNames = new Set(input.keywordNames ?? []);

  // 1. Termes de mécanique cités dans le TEXTE D'EFFET — hors mots-clefs déjà
  //    structurés (leur puce porte déjà la définition → pas de doublon).
  for (const term of EFFECT_TERMS)
    if (!kwNames.has(term) && mentions(text, term)) push(term);

  // 2. Mots-clefs « à valeur/coût » présents : la puce ne dit pas le SENS.
  for (const term of KEYWORD_TERMS) if (kwNames.has(term)) push(term);

  // 3. Métiers (dans card.metier, un coût de Recette « : Bijoutier 3 », ou l'effet)
  //    → définition de « Métier » (les professions n'ont pas d'entrée propre).
  const profText = [
    text,
    ...(input.keywordDescriptions ?? []),
    ...(input.metier ?? []),
  ].join("  ");
  if (PROFESSIONS.some((p) => mentions(profText, p))) push("Métier");

  return out;
}
