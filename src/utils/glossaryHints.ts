/**
 * Aides de glossaire « à surfacer » : quand une carte MENTIONNE dans son texte
 * d'effet un terme de mécanique NON évident (Métier, Agilité, Tacle, Géant…),
 * on propose sa définition de glossaire pour aider à lire la carte — sans avoir
 * à survoler le mot (l'aperçu flottant est `pointer-events:none`).
 *
 * On reste sur une liste CURÉE : surfacer TOUT terme de glossaire noierait la
 * fiche (presque chaque carte parle de Force, Niveau, Allié, Dommage, Ressource…).
 * Les mots-clefs déjà structurés dans `keywords[]` sont exclus (pas de doublon).
 */
import { GLOSSARY, type GlossaryTerm } from "@/data/glossary";

/** Termes de mécanique non évidents, utiles à expliquer dès qu'ils apparaissent
 *  dans le texte d'un effet. (Métier/Artisan = professions ; les autres sont des
 *  mots-clefs à pouvoir continu.) */
const SURFACEABLE_TERMS = [
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
] as const;

const SURFACEABLE_DEFS: GlossaryTerm[] = SURFACEABLE_TERMS.map((t) =>
  GLOSSARY.find((g) => g.term === t),
).filter((g): g is GlossaryTerm => !!g);

/** Le terme apparaît-il comme MOT ENTIER dans le texte ? (bornes = non-lettres,
 *  Unicode `\p{L}` pour gérer les accents : « Métier », « Agilité »…) */
function mentions(text: string, term: string): boolean {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}])${esc}([^\\p{L}]|$)`, "u").test(text);
}

/**
 * Définitions de glossaire à afficher pour aider à lire une carte : termes curés
 * mentionnés dans `effectsText`, hors ceux listés dans `exclude` (typiquement les
 * mots-clefs déjà structurés de la carte).
 */
export function glossaryHints(
  effectsText: string,
  exclude?: Iterable<string>,
): GlossaryTerm[] {
  if (!effectsText) return [];
  const skip = new Set(exclude ?? []);
  return SURFACEABLE_DEFS.filter(
    (g) => !skip.has(g.term) && mentions(effectsText, g.term),
  );
}
