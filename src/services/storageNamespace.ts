/**
 * Source unique de vérité pour l'« espace de stockage » local actif.
 *
 * Volontairement minimal et sans dépendance : importé à la fois par
 * `localStorage.ts` (collection) et `deckStore.ts` (decks) pour qu'ils
 * partagent le même compte actif sans se coupler l'un à l'autre.
 *
 * `null` = invité → clés de base (rétro-compatibles).
 * Connecté = clés suffixées par l'id utilisateur → données isolées par compte.
 */

let activeUserId: string | null = null;

export function setActiveUser(userId: string | null): void {
  activeUserId = userId;
}

export function getActiveUser(): string | null {
  return activeUserId;
}

export function namespacedKey(baseKey: string): string {
  return activeUserId ? `${baseKey}:${activeUserId}` : baseKey;
}
