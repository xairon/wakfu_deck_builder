/**
 * Utilitaires pour les chemins d'images.
 *
 * Le pipeline WebP/thumbnails n'est pas généré dans cette build : seuls les
 * fichiers .png existent sous /images/cards/. Ces helpers retournent donc le
 * chemin .png d'origine (évite les 404 sur des dossiers webp/ et thumbs/
 * inexistants). Si un pipeline WebP est ajouté plus tard, réactiver la
 * conversion ici.
 */

export function getWebpPath(src: string): string {
  return src;
}

export function getThumbPath(src: string): string {
  return src;
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
