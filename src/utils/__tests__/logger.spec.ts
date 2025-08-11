import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { logger } from '../logger'

describe('Logger', () => {
  beforeEach(() => {
    // Réinitialiser les logs avant chaque test
    logger.clearLogs()

    // Mock des méthodes console
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Logging de base', () => {
    it('devrait logger un message de debug', () => {
      logger.debug('deck', 'Test debug')
      const logs = logger.getLogs({ level: 'debug' })
      expect(logs).toHaveLength(1)
      expect(logs[0].message).toBe('Test debug')
      expect(logs[0].category).toBe('deck')
    })

    it("devrait logger un message d'info", () => {
      logger.info('draw', 'Test info')
      const logs = logger.getLogs({ level: 'info' })
      expect(logs).toHaveLength(1)
      expect(logs[0].message).toBe('Test info')
    })

    it('devrait logger un warning', () => {
      logger.warn('stats', 'Test warning')
      const logs = logger.getLogs({ level: 'warn' })
      expect(logs).toHaveLength(1)
      expect(logs[0].message).toBe('Test warning')
    })

    it('devrait logger une erreur', () => {
      const error = new Error('Test error')
      logger.error('deck', 'Test error message', error)
      const logs = logger.getLogs({ level: 'error' })
      expect(logs).toHaveLength(1)
      expect(logs[0].error).toBe(error)
    })
  })

  describe('Filtrage des logs', () => {
    beforeEach(() => {
      logger.debug('deck', 'Debug 1')
      logger.info('draw', 'Info 1')
      logger.warn('stats', 'Warning 1')
      logger.error('deck', 'Error 1')
      logger.debug('draw', 'Debug 2')
    })

    it('devrait filtrer par niveau', () => {
      const debugLogs = logger.getLogs({ level: 'debug' })
      expect(debugLogs).toHaveLength(2)
    })

    it('devrait filtrer par catégorie', () => {
      const deckLogs = logger.getLogs({ category: 'deck' })
      expect(deckLogs).toHaveLength(2)
    })

    it('devrait filtrer par période', () => {
      const now = Date.now()
      const oldLogs = logger.getLogs({ endTime: now - 1000 })
      expect(oldLogs).toHaveLength(0)
    })
  })

  describe('Performance', () => {
    it('devrait mesurer la performance', async () => {
      const endPerf = logger.startPerf('test-perf')
      await new Promise((resolve) => setTimeout(resolve, 100))
      endPerf()

      const perfLogs = logger.getLogs({ category: 'perf' })
      expect(perfLogs).toHaveLength(1)
      expect(perfLogs[0].data.duration).toMatch(/^\d+(\.\d+)?ms$/)
    })
  })

  describe('Gestion de la mémoire', () => {
    it('devrait limiter le nombre de logs', () => {
      // Générer plus de logs que la limite
      for (let i = 0; i < 1100; i++) {
        logger.debug('test', `Log ${i}`)
      }

      const allLogs = logger.getLogs()
      expect(allLogs.length).toBeLessThanOrEqual(1000)
    })

    it('devrait vider les logs', () => {
      logger.debug('test', 'Test log')
      expect(logger.getLogs()).toHaveLength(1)

      logger.clearLogs()
      expect(logger.getLogs()).toHaveLength(0)
    })
  })

  describe('Analyse des erreurs', () => {
    it("devrait calculer le taux d'erreur", () => {
      // 2 erreurs sur 10 logs = 20% de taux d'erreur
      for (let i = 0; i < 8; i++) {
        logger.info('test', `Log ${i}`)
      }
      logger.error('test', 'Error 1')
      logger.error('test', 'Error 2')

      const errorRate = logger.getErrorRate()
      expect(errorRate).toBe(0.2)
    })

    it('devrait retourner 0 si pas de logs', () => {
      const errorRate = logger.getErrorRate()
      expect(errorRate).toBe(0)
    })
  })

  describe('Export', () => {
    it('devrait exporter les logs au format JSON', () => {
      logger.info('test', 'Test log')
      const exported = logger.exportLogs()

      expect(exported).toBeTypeOf('string')
      const parsed = JSON.parse(exported)
      expect(parsed).toBeInstanceOf(Array)
      expect(parsed[0].message).toBe('Test log')
    })
  })

  describe('Formatage des messages', () => {
    it('devrait inclure les données additionnelles', () => {
      const data = { key: 'value' }
      logger.info('test', 'Test with data', data)

      const logs = logger.getLogs()
      expect(logs[0].data).toEqual(data)
    })

    it('devrait formater correctement les erreurs', () => {
      const error = new Error('Test error')
      logger.error('test', 'Error occurred', error)

      const logs = logger.getLogs()
      expect(logs[0].error?.message).toBe('Test error')
      expect(logs[0].error?.stack).toBeDefined()
    })
  })

  describe('Catégories', () => {
    it('devrait accepter toutes les catégories valides', () => {
      const categories: Array<'deck' | 'draw' | 'stats' | 'perf' | 'ui'> = [
        'deck',
        'draw',
        'stats',
        'perf',
        'ui',
      ]

      categories.forEach((category) => {
        logger.info(category, `Test ${category}`)
      })

      categories.forEach((category) => {
        const logs = logger.getLogs({ category })
        expect(logs).toHaveLength(1)
      })
    })
  })

  describe('Timestamps', () => {
    it('devrait ajouter des timestamps précis', () => {
      const before = Date.now()
      logger.info('test', 'Test timestamp')
      const after = Date.now()

      const logs = logger.getLogs()
      expect(logs[0].timestamp).toBeGreaterThanOrEqual(before)
      expect(logs[0].timestamp).toBeLessThanOrEqual(after)
    })
  })
})
