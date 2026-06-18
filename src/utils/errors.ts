/**
 * Système de gestion d'erreurs centralisé
 * @module Errors
 */

/**
 * Erreur de base pour l'application
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Erreur de validation (deck, formulaires...)
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}
