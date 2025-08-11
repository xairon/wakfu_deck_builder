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
    public details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

/**
 * Erreur de validation
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', details)
    this.name = 'ValidationError'
  }
}

/**
 * Erreur réseau
 */
export class NetworkError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'NETWORK_ERROR', details)
    this.name = 'NetworkError'
  }
}

/**
 * Erreur de stockage
 */
export class StorageError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'STORAGE_ERROR', details)
    this.name = 'StorageError'
  }
}

/**
 * Erreur de limite atteinte
 */
export class LimitError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'LIMIT_ERROR', details)
    this.name = 'LimitError'
  }
}

/**
 * Gestionnaire d'erreurs global
 */
export class ErrorHandler {
  private static instance: ErrorHandler

  private constructor() {
    // Singleton
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }

  /**
   * Gère une erreur de manière appropriée
   */
  handle(error: Error): void {
    if (error instanceof AppError) {
      this.handleAppError(error)
    } else {
      this.handleUnknownError(error)
    }
  }

  /**
   * Gère une erreur applicative
   */
  private handleAppError(error: AppError): void {
    switch (error.code) {
      case 'VALIDATION_ERROR':
        console.error('Erreur de validation:', error.message, error.details)
        // Notifier l'utilisateur
        break
      case 'NETWORK_ERROR':
        console.error('Erreur réseau:', error.message, error.details)
        // Retry logic
        break
      case 'STORAGE_ERROR':
        console.error('Erreur de stockage:', error.message, error.details)
        // Fallback storage
        break
      case 'LIMIT_ERROR':
        console.error('Limite atteinte:', error.message, error.details)
        // Notifier l'utilisateur
        break
      default:
        this.handleUnknownError(error)
    }
  }

  /**
   * Gère une erreur inconnue
   */
  private handleUnknownError(error: Error): void {
    console.error('Erreur inconnue:', error)
    // Log to service
  }
}

/**
 * Fonction utilitaire pour retry avec backoff exponentiel
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    retries?: number
    baseDelay?: number
    maxDelay?: number
    shouldRetry?: (error: Error) => boolean
  } = {}
): Promise<T> {
  const {
    retries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    shouldRetry = (error) => error instanceof NetworkError,
  } = options

  let lastError: Error

  for (let i = 0; i < retries; i++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error

      if (!shouldRetry(lastError) || i === retries - 1) {
        throw lastError
      }

      const delay = Math.min(baseDelay * Math.pow(2, i), maxDelay)

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

/**
 * Fonction utilitaire pour valider les données
 */
export function validate<T>(
  data: T,
  schema: Record<keyof T, (value: any) => boolean>,
  options: {
    throwOnError?: boolean
    customMessages?: Record<keyof T, string>
  } = {}
): { isValid: boolean; errors: string[] } {
  const { throwOnError = false, customMessages = {} } = options
  const errors: string[] = []

  for (const [key, validator] of Object.entries(schema)) {
    if (!validator(data[key as keyof T])) {
      const message =
        customMessages[key as keyof T] || `Validation failed for ${String(key)}`
      errors.push(message)
    }
  }

  if (throwOnError && errors.length > 0) {
    throw new ValidationError('Validation failed', { errors })
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance()
