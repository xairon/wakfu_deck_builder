import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from '@/App.vue'
import { useCardStore } from '@/stores/cardStore'
import { performanceMonitor } from '@/utils/performance'
import type { Card } from '@/types/card'

describe('Tests de Performance', () => {
  // Configuration du router
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      {
        path: '/',
        component: App
      }
    ]
  })

  // Seuils de performance (en ms)
  const PERFORMANCE_THRESHOLDS = {
    INITIAL_LOAD: 1000,
    ROUTE_CHANGE: 300,
    LIST_RENDER: 100,
    SEARCH_FILTER: 50
  }

  // Mock des cartes de test
  const generateMockCards = (count: number): Card[] => {
    return Array.from({ length: count }, (_, i) => ({
      image_id: `card${i}`,
      name: `Test Card ${i}`,
      type: i % 2 === 0 ? 'Allié' : 'Sort',
      stats: { ap: i % 5 + 1, hp: i % 10 + 5 },
      element: ['Feu', 'Eau', 'Terre', 'Air'][i % 4],
      effects: [],
      keywords: [],
      notes: [],
      rarete: ['Commune', 'Peu Commune', 'Rare', 'Mythique'][i % 4],
      rarete_image_id: null,
      element_image_ids: [],
      effect_image_ids: [],
      artiste: '',
      extension: `Extension ${Math.floor(i / 100)}`,
      numero: '',
      extension_id: 0,
      face_arriere: null,
      ambiance: null,
      experience: null,
      panoplie_bonus: null,
      recipe: null,
      url: ''
    }))
  }

  beforeEach(() => {
    // Reset Pinia
    setActivePinia(createPinia())

    // Reset performance monitoring
    vi.spyOn(performanceMonitor, 'addMetric').mockImplementation(() => {})
  })

  describe('Chargement initial', () => {
    it('devrait charger l\'application en moins de 1s', async () => {
      const startTime = performance.now()

      const wrapper = mount(App, {
        global: {
          plugins: [router]
        }
      })

      const loadTime = performance.now() - startTime
      expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.INITIAL_LOAD)
    })

    it('devrait initialiser la base de données efficacement', async () => {
      const store = useCardStore()
      const mockCards = generateMockCards(1000)
      vi.mocked(store).cards = mockCards

      const startTime = performance.now()
      await store.initializeDatabase()
      const initTime = performance.now() - startTime

      expect(initTime).toBeLessThan(PERFORMANCE_THRESHOLDS.INITIAL_LOAD)
    })

    it('devrait charger les images de manière optimisée', async () => {
      const wrapper = mount(App, {
        global: {
          plugins: [router]
        }
      })

      // Vérifier que les images sont chargées avec lazy loading
      const images = wrapper.findAll('img')
      images.forEach(img => {
        expect(img.attributes('loading')).toBe('lazy')
      })

      // Vérifier que les images au-dessus du fold ont fetchpriority="high"
      const aboveFoldImages = wrapper.findAll('img[fetchpriority="high"]')
      expect(aboveFoldImages.length).toBeLessThanOrEqual(5)
    })
  })

  describe('Rendu des listes', () => {
    it('devrait rendre une grande liste de cartes efficacement', async () => {
      const store = useCardStore()
      const mockCards = generateMockCards(1000)
      vi.mocked(store).cards = mockCards

      const startTime = performance.now()
      const wrapper = mount(App, {
        global: {
          plugins: [router]
        }
      })
      await router.push('/collection')
      const renderTime = performance.now() - startTime

      expect(renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LIST_RENDER)
    })

    it('devrait utiliser la virtualisation pour les grandes listes', async () => {
      const store = useCardStore()
      const mockCards = generateMockCards(1000)
      vi.mocked(store).cards = mockCards

      const wrapper = mount(App, {
        global: {
          plugins: [router]
        }
      })
      await router.push('/collection')

      // Vérifier que seul un sous-ensemble des cartes est rendu
      const renderedCards = wrapper.findAll('.card-wrapper')
      expect(renderedCards.length).toBeLessThan(mockCards.length)
    })

    it('devrait mettre en cache les résultats de rendu', async () => {
      const store = useCardStore()
      const mockCards = generateMockCards(1000)
      vi.mocked(store).cards = mockCards

      const wrapper = mount(App, {
        global: {
          plugins: [router]
        }
      })

      // Premier rendu
      await router.push('/collection')
      const firstRenderTime = performance.now()

      // Deuxième rendu (même route)
      await router.push('/')
      await router.push('/collection')
      const secondRenderTime = performance.now()

      expect(secondRenderTime - firstRenderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.ROUTE_CHANGE)
    })
  })

  describe('Recherche et filtrage', () => {
    it('devrait filtrer les cartes rapidement', async () => {
      const store = useCardStore()
      const mockCards = generateMockCards(1000)
      vi.mocked(store).cards = mockCards

      const wrapper = mount(App, {
        global: {
          plugins: [router]
        }
      })
      await router.push('/collection')

      const startTime = performance.now()
      const searchInput = wrapper.find('input[type="text"]')
      await searchInput.setValue('Card 1')
      const filterTime = performance.now() - startTime

      expect(filterTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_FILTER)
    })

    it('devrait utiliser l\'index de recherche pour les filtres complexes', async () => {
      const store = useCardStore()
      const mockCards = generateMockCards(1000)
      vi.mocked(store).cards = mockCards

      const wrapper = mount(App, {
        global: {
          plugins: [router]
        }
      })
      await router.push('/collection')

      const startTime = performance.now()
      
      // Appliquer plusieurs filtres
      await wrapper.find('select.type-select').setValue('Allié')
      await wrapper.find('select.element-select').setValue('Feu')
      await wrapper.find('input[type="text"]').setValue('Card')
      
      const filterTime = performance.now() - startTime
      expect(filterTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_FILTER * 3)
    })

    it('devrait mettre en cache les résultats de recherche', async () => {
      const store = useCardStore()
      const mockCards = generateMockCards(1000)
      vi.mocked(store).cards = mockCards

      const wrapper = mount(App, {
        global: {
          plugins: [router]
        }
      })
      await router.push('/collection')

      // Première recherche
      const searchInput = wrapper.find('input[type="text"]')
      await searchInput.setValue('Card 1')
      const firstSearchTime = performance.now()

      // Deuxième recherche avec les mêmes critères
      await searchInput.setValue('Card 2')
      await searchInput.setValue('Card 1')
      const secondSearchTime = performance.now()

      expect(secondSearchTime - firstSearchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_FILTER)
    })
  })

  describe('Métriques Web Vitals', () => {
    it('devrait avoir un bon score LCP', async () => {
      const wrapper = mount(App, {
        global: {
          plugins: [router]
        }
      })

      // Simuler le calcul du LCP
      const lcp = await new Promise<number>(resolve => {
        new PerformanceObserver((entries) => {
          const entry = entries.getEntries()[0]
          resolve(entry.startTime)
        }).observe({ entryTypes: ['largest-contentful-paint'] })
      })

      expect(lcp).toBeLessThan(2500) // Seuil recommandé par Google
    })

    it('devrait avoir un bon score FID', async () => {
      const wrapper = mount(App, {
        global: {
          plugins: [router]
        }
      })

      // Simuler une interaction utilisateur
      const button = wrapper.find('button')
      const startTime = performance.now()
      await button.trigger('click')
      const fid = performance.now() - startTime

      expect(fid).toBeLessThan(100) // Seuil recommandé par Google
    })

    it('devrait avoir un bon score CLS', async () => {
      const wrapper = mount(App, {
        global: {
          plugins: [router]
        }
      })

      // Simuler le calcul du CLS
      const cls = await new Promise<number>(resolve => {
        let cumulativeLayoutShift = 0
        new PerformanceObserver((entries) => {
          for (const entry of entries.getEntries()) {
            if (!entry.hadRecentInput) {
              cumulativeLayoutShift += (entry as any).value
            }
          }
          resolve(cumulativeLayoutShift)
        }).observe({ entryTypes: ['layout-shift'] })
      })

      expect(cls).toBeLessThan(0.1) // Seuil recommandé par Google
    })
  })
}) 