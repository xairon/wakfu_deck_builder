/**
 * Formatage de dates pour l'UI (FR).
 *
 * Les erratas/règles voyagent en interne au format ISO "YYYY-MM-DD" (émis
 * aussi bien par Postgres que par la normalisation du JSON de repli — voir
 * `errataService.ts`). Cette fonction est le SEUL point d'affichage FR :
 * ne pas dupliquer le formatage dans les vues/composants.
 */

/** Formate une date ISO "YYYY-MM-DD" en "JJ/MM/AAAA". Vide si absente/invalide. */
export function formatFrenchDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const date = new Date(year, month - 1, day);
  // `Date` renormalise les composants hors-plage (ex. mois 13, jour 99) au
  // lieu de produire "Invalid Date" : on rejette si le résultat ne correspond
  // plus à ce qui a été demandé, pour ne jamais rendre une date fantaisiste.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return "";
  }
  return date.toLocaleDateString("fr-FR");
}
