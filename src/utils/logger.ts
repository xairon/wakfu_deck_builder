/**
 * Système de logging pour l'application
 * Permet de tracer les événements, erreurs et performances de manière centralisée
 * @module Logger
 */

/**
 * Niveaux de log disponibles
 * @typedef {'debug' | 'info' | 'warn' | 'error'} LogLevel
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Catégories de log pour organiser les messages
 * @typedef {'deck' | 'draw' | 'stats' | 'perf' | 'ui'} LogCategory
 */
type LogCategory = 'deck' | 'draw' | 'stats' | 'perf' | 'ui'

/**
 * Structure d'une entrée de log
 * @interface LogEntry
 */
interface LogEntry {
  /** Timestamp en millisecondes */
  timestamp: number
  /** Niveau de log */
  level: LogLevel
  /** Catégorie du log */
  category: LogCategory
  /** Message principal */
  message: string
  /** Données additionnelles (optionnel) */
  data?: any
  /** Erreur associée (optionnel) */
  error?: Error
}

/**
 * Classe principale du système de logging
 * Implémente le pattern Singleton pour assurer une instance unique
 * @class Logger
 */
class Logger {
  /** Instance unique du logger */
  private static instance: Logger
  /** Stockage des logs en mémoire */
  private logs: LogEntry[] = []
  /** Nombre maximum de logs conservés */
  private readonly MAX_LOGS = 1000
  /** Mode debug activé en développement */
  private debugMode = import.meta.env.DEV

  /**
   * Constructeur privé pour le pattern Singleton
   * @private
   */
  private constructor() {
    // Singleton
  }

  /**
   * Récupère l'instance unique du logger
   * @static
   * @returns {Logger} Instance du logger
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  /**
   * Formate un message de log pour l'affichage
   * @private
   * @param {LogEntry} entry - Entrée de log à formater
   * @returns {string} Message formaté
   */
  private formatMessage(entry: LogEntry): string {
    const date = new Date(entry.timestamp).toISOString()
    const level = entry.level.toUpperCase().padEnd(5)
    const category = entry.category.padEnd(8)
    let message = `[${date}] ${level} [${category}] ${entry.message}`

    if (entry.data) {
      message += '\nData: ' + JSON.stringify(entry.data, null, 2)
    }
    if (entry.error) {
      message += '\nError: ' + entry.error.stack
    }

    return message
  }

  /**
   * Ajoute une entrée dans les logs
   * @private
   * @param {LogEntry} entry - Entrée à ajouter
   */
  private addEntry(entry: LogEntry) {
    this.logs.push(entry)
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift()
    }

    // En mode développement, on affiche aussi dans la console
    if (this.debugMode) {
      const formattedMessage = this.formatMessage(entry)
      switch (entry.level) {
        case 'debug':
          console.debug(formattedMessage)
          break
        case 'info':
          console.info(formattedMessage)
          break
        case 'warn':
          console.warn(formattedMessage)
          break
        case 'error':
          console.error(formattedMessage)
          break
      }
    }
  }

  /**
   * Ajoute un log de niveau DEBUG
   * @param {LogCategory} category - Catégorie du log
   * @param {string} message - Message principal
   * @param {any} [data] - Données additionnelles
   */
  debug(category: LogCategory, message: string, data?: any) {
    this.addEntry({
      timestamp: Date.now(),
      level: 'debug',
      category,
      message,
      data,
    })
  }

  /**
   * Ajoute un log de niveau INFO
   * @param {LogCategory} category - Catégorie du log
   * @param {string} message - Message principal
   * @param {any} [data] - Données additionnelles
   */
  info(category: LogCategory, message: string, data?: any) {
    this.addEntry({
      timestamp: Date.now(),
      level: 'info',
      category,
      message,
      data,
    })
  }

  /**
   * Ajoute un log de niveau WARN
   * @param {LogCategory} category - Catégorie du log
   * @param {string} message - Message principal
   * @param {any} [data] - Données additionnelles
   */
  warn(category: LogCategory, message: string, data?: any) {
    this.addEntry({
      timestamp: Date.now(),
      level: 'warn',
      category,
      message,
      data,
    })
  }

  /**
   * Ajoute un log de niveau ERROR
   * @param {LogCategory} category - Catégorie du log
   * @param {string} message - Message principal
   * @param {Error} [error] - Erreur associée
   * @param {any} [data] - Données additionnelles
   */
  error(category: LogCategory, message: string, error?: Error, data?: any) {
    this.addEntry({
      timestamp: Date.now(),
      level: 'error',
      category,
      message,
      error,
      data,
    })
  }

  /**
   * Démarre une mesure de performance
   * @param {string} label - Label de la mesure
   * @returns {Function} Fonction à appeler pour terminer la mesure
   */
  startPerf(label: string) {
    const start = performance.now()
    return () => {
      const duration = performance.now() - start
      this.debug('perf', `Performance '${label}'`, {
        duration: `${duration.toFixed(2)}ms`,
      })
    }
  }

  /**
   * Récupère les logs filtrés selon certains critères
   * @param {Object} options - Options de filtrage
   * @param {LogLevel} [options.level] - Niveau de log
   * @param {LogCategory} [options.category] - Catégorie
   * @param {number} [options.startTime] - Timestamp de début
   * @param {number} [options.endTime] - Timestamp de fin
   * @returns {LogEntry[]} Logs filtrés
   */
  getLogs(
    options: {
      level?: LogLevel
      category?: LogCategory
      startTime?: number
      endTime?: number
    } = {}
  ): LogEntry[] {
    return this.logs.filter((log) => {
      if (options.level && log.level !== options.level) return false
      if (options.category && log.category !== options.category) return false
      if (options.startTime && log.timestamp < options.startTime) return false
      if (options.endTime && log.timestamp > options.endTime) return false
      return true
    })
  }

  /**
   * Calcule le taux d'erreur sur une période donnée
   * @param {number} [timeWindow=60000] - Fenêtre de temps en ms (défaut: 1 minute)
   * @returns {number} Taux d'erreur entre 0 et 1
   */
  getErrorRate(timeWindow: number = 60000): number {
    const now = Date.now()
    const recentLogs = this.logs.filter(
      (log) => log.timestamp > now - timeWindow
    )
    if (recentLogs.length === 0) return 0

    const errors = recentLogs.filter((log) => log.level === 'error')
    return errors.length / recentLogs.length
  }

  /**
   * Vide tous les logs
   */
  clearLogs() {
    this.logs = []
  }

  /**
   * Exporte tous les logs au format JSON
   * @returns {string} Logs au format JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }
}

/** Instance unique du logger */
export const logger = Logger.getInstance()

/**
 * Décorateur pour logger les performances des méthodes
 * @returns {Function} Décorateur de méthode
 */
export function logPerformance() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = function (...args: any[]) {
      const endPerf = logger.startPerf(
        `${target.constructor.name}.${propertyKey}`
      )
      try {
        const result = originalMethod.apply(this, args)
        if (result instanceof Promise) {
          return result.finally(endPerf)
        }
        endPerf()
        return result
      } catch (error) {
        endPerf()
        throw error
      }
    }

    return descriptor
  }
}

/**
 * Décorateur pour logger les erreurs des méthodes
 * @returns {Function} Décorateur de méthode
 */
export function logError() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = function (...args: any[]) {
      try {
        const result = originalMethod.apply(this, args)
        if (result instanceof Promise) {
          return result.catch((error) => {
            logger.error(
              'deck',
              `Error in ${target.constructor.name}.${propertyKey}`,
              error
            )
            throw error
          })
        }
        return result
      } catch (error) {
        logger.error(
          'deck',
          `Error in ${target.constructor.name}.${propertyKey}`,
          error as Error
        )
        throw error
      }
    }

    return descriptor
  }
}
