/**
 * Utilitaires de texte pour la recherche.
 *
 * Les recherches doivent être insensibles à la casse ET aux accents : taper
 * « abces » doit trouver « Abcès », « feca » doit trouver « Féca », etc.
 */

/**
 * Normalise une chaîne pour comparaison : minuscules, accents retirés,
 * espaces superflus compressés.
 */
export function normalizeSearch(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // marques diacritiques combinantes
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Vrai si `needle` est contenu dans `haystack`, en ignorant casse et accents.
 * Une aiguille vide correspond toujours.
 */
export function matchesSearch(haystack: string, needle: string): boolean {
  const n = normalizeSearch(needle);
  if (!n) return true;
  return normalizeSearch(haystack).includes(n);
}
