/**
 * Mise en forme du texte d'effet des cartes.
 * - nettoyage défensif (artefacts de scraping : « : » en tête, doubles espaces)
 * - mise en relief : éléments colorés (identité du jeu) + nombres/dégâts en gras
 *
 * Le texte provient de NOS données (pas d'entrée utilisateur) ; on échappe le
 * HTML puis on n'injecte que des balises connues → pas de risque XSS.
 */

// Clés de fichier d'icône par nom d'élément (public/images/elements/ressource-*.png)
const ELEMENT_KEYS: Record<string, string> = {
  Air: "air",
  Eau: "eau",
  Feu: "feu",
  Terre: "terre",
  Neutre: "neutre",
};

/** Retire les artefacts de tête et normalise les espaces. */
export function cleanEffectText(s: string | undefined | null): string {
  return (s || "")
    .replace(/^\s*[:•·\-–]\s*/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Renvoie le texte d'effet nettoyé + balisé (à utiliser avec v-html).
 * Met en gras « N Dommages/Soin/PA/PM/PV… » et colore les éléments.
 */
export function highlightEffectHtml(s: string | undefined | null): string {
  let t = escapeHtml(cleanEffectText(s));

  // Nombres + unité de jeu → gras
  t = t.replace(
    /\b(\d+)\s+(Dommages?|Soins?|Bouclier|Boucliers|PA|PM|PV|Niveaux?|Forces?)\b/gi,
    "<strong>$1&nbsp;$2</strong>",
  );

  // Éléments → vrai symbole (icône), comme sur la carte (la donnée les écrit
  // capitalisés : Air, Eau, Feu, Terre, Neutre).
  t = t.replace(/\b(Air|Eau|Feu|Terre|Neutre)\b/g, (m) => {
    const key = ELEMENT_KEYS[m];
    if (!key) return m;
    return `<img src="/images/elements/ressource-${key}.png" alt="${m}" title="${m}" style="display:inline-block;height:1.25em;width:1.25em;vertical-align:-0.28em;margin:0 0.08em" />`;
  });

  return t;
}
