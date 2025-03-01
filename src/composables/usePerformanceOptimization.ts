import { ref, computed } from 'vue'
import { useVirtualList } from '@vueuse/core'
import type { Card } from '@/types/card'

interface CacheEntry<T> {
  data: T
  timestamp: number
}

export function usePerformanceOptimization() {
  const cache = new Map<string, CacheEntry<any>>()
  const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  // Mise en cache des données
  function cacheData<T>(key: string, data: T): void {
    cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  function getCachedData<T>(key: string): T | null {
    const entry = cache.get(key)
    if (!entry) return null

    if (Date.now() - entry.timestamp > CACHE_DURATION) {
      cache.delete(key)
      return null
    }

    return entry.data as T
  }

  // Virtualisation de liste
  function useVirtualizedList<T>(
    items: T[],
    options = {
      itemHeight: 100,
      overscan: 5
    }
  ) {
    const containerRef = ref<HTMLElement>()
    const { list, containerProps, wrapperProps } = useVirtualList(
      items,
      {
        itemHeight: options.itemHeight,
        overscan: options.overscan
      }
    )

    return {
      containerRef,
      virtualList: list,
      containerProps,
      wrapperProps
    }
  }

  // Debounce pour les opérations coûteuses
  function debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout

    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => fn(...args), delay)
    }
  }

  // Optimisation des images
  function getOptimizedImageUrl(url: string, options: {
    width?: number
    height?: number
    format?: 'webp' | 'jpeg' | 'png'
  } = {}): string {
    const { width, height, format = 'webp' } = options
    const params = new URLSearchParams()

    if (width) params.append('w', width.toString())
    if (height) params.append('h', height.toString())
    if (format) params.append('fm', format)

    return `${url}?${params.toString()}`
  }

  // Préchargement des images
  const preloadedImages = new Set<string>()

  function preloadImage(url: string): Promise<void> {
    if (preloadedImages.has(url)) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        preloadedImages.add(url)
        resolve()
      }
      img.onerror = reject
      img.src = url
    })
  }

  return {
    cacheData,
    getCachedData,
    useVirtualizedList,
    debounce,
    getOptimizedImageUrl,
    preloadImage
  }
} 