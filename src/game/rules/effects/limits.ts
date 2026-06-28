/**
 * Moteur de règles — limites & cycles de vie des JETONS (anticipé du lot D :
 * `powerUses`/`whyPowerLimited` arriveront avec les coûts composés).
 *
 * `isTurnToken` est le prédicat UNIQUE de purge de fin de tour : il remplace
 * la liste en dur de `nextTurn` (gameStore). Sont purgés à chaque transition
 * de tour (« jusqu'à la fin du tour », et filets de sécurité de fin de
 * combat — un combat ne survit jamais au tour) :
 *   forceMod, paMod, pmMod, geantMod, geantTurnMod, coupCritique, teamForceMod,
 *   tout `*CombatMod` (forceCombatMod, pmCombatMod, geantCombatMod…),
 *   les préfixes resMod_<élément>, powerUses<i>, metier_<nom>,
 *   et `treveUntilTurn` UNIQUEMENT s'il est expiré (la Trêve traverse le
 *   tour adverse : actif tant que `tour courant < valeur`).
 * `arrivedTurn` (mal d'invocation, 1821) n'est jamais purgé.
 */

const TURN_TOKENS = new Set([
  "forceMod",
  "paMod",
  "pmMod",
  "geantMod",
  // « gagne <Mot-clé> jusqu'à la fin du TOUR » (grantKeywordSelf/grantKeywordTarget) —
  // jetons TURN-scoped purgés en fin de tour, comme forceMod (geantCombatMod, lui,
  // est couvert par le suffixe *CombatMod ⇒ portée combat). Un jeton par mot-clé
  // octroyable de combat (Géant / Agilité / Agressivité / Tacle), lu par
  // effectiveKeywords.
  "geantTurnMod",
  "agiliteTurnMod",
  "agressiviteTurnMod",
  "tacleTurnMod",
  "coupCritique",
  "teamForceMod",
]);

const TURN_TOKEN_PREFIXES = ["resMod_", "powerUses", "metier_"];

/**
 * Le jeton `name` doit-il être purgé au passage au tour `nextTurnNumber` ?
 * `value` n'est requis que pour les jetons à expiration datée
 * (`treveUntilTurn`) ; sans ces deux arguments, ils sont conservés.
 */
export function isTurnToken(
  name: string,
  value?: number,
  nextTurnNumber?: number,
): boolean {
  if (TURN_TOKENS.has(name)) return true;
  if (name.endsWith("CombatMod")) return true;
  if (TURN_TOKEN_PREFIXES.some((p) => name.startsWith(p))) return true;
  if (name === "treveUntilTurn" || name === "noUntapUntilTurn") {
    // expiré ssi le prochain tour atteint la borne (« jusqu'au début de
    // votre prochain tour » : actif tant que tour courant < valeur). Même
    // cycle pour la Trêve (bouclier global) et l'interdiction de redressement
    // (noUntapUntilTurn) — toutes deux datées en `tour + 2`.
    return (
      value !== undefined &&
      nextTurnNumber !== undefined &&
      nextTurnNumber >= value
    );
  }
  return false;
}
