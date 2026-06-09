/**
 * Utilitaires pour les chemins d'images.
 *
 * Les images de cartes sont stockées en WebP sous /images/cards/<id>.webp
 * (retravaillées : filigrane wtcg-return retiré + agrandies ×2, voir
 * `scripts/generateCleanCards.js`). Ces helpers sont conservés pour des
 * variantes éventuelles (thumbnails) mais renvoient pour l'instant le chemin
 * source tel quel.
 */

export function getWebpPath(src: string): string {
  return src;
}

/**
 * Vignette ~256px d'une image de carte, pour les grilles (collection, vivier…).
 * `/images/cards/foo.webp` → `/images/cards/thumbs/foo.webp`.
 * Repli `onerror` vers l'image pleine recommandé côté composant.
 */
export function getThumbPath(src: string): string {
  return src.replace(
    /\/images\/cards\/([^/]+\.webp)(\?.*)?$/i,
    "/images/cards/thumbs/$1",
  );
}

/**
 * Chemin de l'illustration nette (bande d'art recadrée, sans le cadre de la
 * carte) générée par `npm run extract-illustrations`.
 * @param id identifiant de carte (slug stable)
 * @returns /images/illustrations/<id>.webp
 */
export function getIllustrationPath(id: string): string {
  return `/images/illustrations/${id}.webp`;
}
