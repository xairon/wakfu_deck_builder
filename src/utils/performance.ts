import { ref, onMounted, onUnmounted } from 'vue'

/**
 * Types de métriques de performance
 */
export const METRIC_TYPES = {
  COMPONENT_RENDER: 'component_render',
  STORE_ACTION: 'store_action',
  API_CALL: 'api_call',
  DECK_OPERATION: 'deck_operation',
  SEARCH: 'search',
} as const

type MetricType = (typeof METRIC_TYPES)[keyof typeof METRIC_TYPES]

/**
 * Interface pour une métrique
 */
interface Metric {
  type: MetricType
  name: string
  duration: number
  timestamp: number
  metadata?: Record<string, unknown>
}

/**
 * Seuils de performance
 */
export const PERFORMANCE_THRESHOLDS = {
  [METRIC_TYPES.COMPONENT_RENDER]: 16, // 60fps
  [METRIC_TYPES.STORE_ACTION]: 50,
  [METRIC_TYPES.API_CALL]: 1000,
  [METRIC_TYPES.DECK_OPERATION]: 100,
  [METRIC_TYPES.SEARCH]: 200,
} as const

/**
 * Moniteur de performance
 */
class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: Metric[] = []
  private observers: Set<(metric: Metric) => void> = new Set()

  private constructor() {
    // Singleton
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  /**
   * Ajoute une métrique
   */
  addMetric(metric: Metric): void {
    this.metrics.push(metric)
    this.notifyObservers(metric)

    // Vérifier le seuil
    const threshold = PERFORMANCE_THRESHOLDS[metric.type]
    if (metric.duration > threshold) {
      console.warn(
        `Performance warning: ${metric.name} took ${metric.duration}ms ` +
          `(threshold: ${threshold}ms)`,
        metric
      )
    }
  }

  /**
   * Obtient les métriques filtrées
   */
  getMetrics(
    options: {
      type?: MetricType
      from?: number
      to?: number
    } = {}
  ): Metric[] {
    const { type, from, to } = options

    return this.metrics.filter((metric) => {
      if (type && metric.type !== type) return false
      if (from && metric.timestamp < from) return false
      if (to && metric.timestamp > to) return false
      return true
    })
  }

  /**
   * Calcule les statistiques pour un type de métrique
   */
  getStats(type: MetricType): {
    count: number
    average: number
    min: number
    max: number
    p95: number
  } {
    const metrics = this.getMetrics({ type })
    const durations = metrics.map((m) => m.duration)

    if (durations.length === 0) {
      return {
        count: 0,
        average: 0,
        min: 0,
        max: 0,
        p95: 0,
      }
    }

    const sorted = [...durations].sort((a, b) => a - b)
    const p95Index = Math.floor(sorted.length * 0.95)

    return {
      count: metrics.length,
      average: durations.reduce((a, b) => a + b) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      p95: sorted[p95Index],
    }
  }

  /**
   * Ajoute un observateur
   */
  addObserver(callback: (metric: Metric) => void): () => void {
    this.observers.add(callback)
    return () => this.observers.delete(callback)
  }

  /**
   * Notifie les observateurs
   */
  private notifyObservers(metric: Metric): void {
    this.observers.forEach((observer) => observer(metric))
  }

  /**
   * Nettoie les anciennes métriques
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge
    this.metrics = this.metrics.filter((m) => m.timestamp >= cutoff)
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance()

/**
 * Mesure le temps d'exécution d'une fonction
 */
export function measure<T>(
  type: MetricType,
  name: string,
  fn: () => T | Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const start = performance.now()

  const addMetric = (duration: number) => {
    performanceMonitor.addMetric({
      type,
      name,
      duration,
      timestamp: Date.now(),
      metadata,
    })
  }

  try {
    const result = fn()

    if (result instanceof Promise) {
      return result.finally(() => {
        const duration = performance.now() - start
        addMetric(duration)
      })
    } else {
      const duration = performance.now() - start
      addMetric(duration)
      return Promise.resolve(result)
    }
  } catch (error) {
    const duration = performance.now() - start
    addMetric(duration)
    throw error
  }
}

/**
 * Décorateur pour mesurer les performances d'une méthode
 */
export function measureMethod(
  type: MetricType,
  name?: string,
  metadata?: Record<string, unknown>
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = function (...args: any[]) {
      return measure(
        type,
        name || `${target.constructor.name}.${propertyKey}`,
        () => originalMethod.apply(this, args),
        metadata
      )
    }

    return descriptor
  }
}

/**
 * Hook pour mesurer les performances d'un composant
 */
export function usePerformanceMonitoring(componentName: string) {
  let renderStart: number

  onMounted(() => {
    renderStart = performance.now()
  })

  onUnmounted(() => {
    const duration = performance.now() - renderStart
    performanceMonitor.addMetric({
      type: METRIC_TYPES.COMPONENT_RENDER,
      name: componentName,
      duration,
      timestamp: Date.now(),
    })
  })

  return {
    measureOperation: (
      name: string,
      fn: () => Promise<void>,
      metadata?: Record<string, unknown>
    ) =>
      measure(
        METRIC_TYPES.DECK_OPERATION,
        `${componentName}.${name}`,
        fn,
        metadata
      ),
  }
}

/**
 * Composable pour le monitoring des performances
 */
export function usePerformanceStats(type?: MetricType) {
  const stats = ref(type ? performanceMonitor.getStats(type) : null)
  let cleanup: (() => void) | null = null

  onMounted(() => {
    if (type) {
      cleanup = performanceMonitor.addObserver(() => {
        stats.value = performanceMonitor.getStats(type)
      })
    }
  })

  onUnmounted(() => {
    if (cleanup) {
      cleanup()
    }
  })

  return {
    stats,
  }
}
