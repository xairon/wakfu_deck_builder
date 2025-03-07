import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DeckDrawSimulator from '../deck/DeckDrawSimulator.vue'
import { usePerformanceMonitoring } from '@/utils/performance'
import { useToast } from '@/composables/useToast'
import type { Card, Deck } from '@/types/card'

vi.mock('@/utils/performance', () => ({
  usePerformanceMonitoring: () => ({
    startPerf: vi.fn(() => vi.fn())
  })
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  })
}))

describe('DeckDrawSimulator', () => {
  // Mock d'une carte
  const createMockCard = (id: string): Card => ({
    image_id: id,
    name: `Card ${id}`,
    type: 'Sort',
    stats: { ap: 2 },
    element: 'Feu',
    effects: [],
    keywords: [],
    notes: [],
    rarete: 'Commune',
    rarete_image_id: null,
    element_image_ids: [],
    effect_image_ids: [],
    artiste: '',
    extension: '',
    numero: '',
    extension_id: 0,
    face_arriere: null,
    ambiance: null,
    experience: null,
    panoplie_bonus: null,
    recipe: null,
    url: ''
  })

  // Mock d'un deck
  const mockDeck: Deck = {
    id: 'test-deck',
    name: 'Test Deck',
    cards: Array(15).fill(null).map((_, i) => ({
      card: createMockCard(`card-${i}`),
      quantity: 1
    })),
    createdAt: new Date(),
    updatedAt: new Date()
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('Rendu', () => {
    it('devrait rendre correctement le composant', () => {
      const wrapper = mount(DeckDrawSimulator, {
        props: {
          deck: mockDeck
        }
      })

      expect(wrapper.find('.deck-draw-simulator').exists()).toBe(true)
      expect(wrapper.find('.draw-button').exists()).toBe(true)
    })

    it('devrait afficher les statistiques initiales', () => {
      const wrapper = mount(DeckDrawSimulator, {
        props: {
          deck: mockDeck
        }
      })

      expect(wrapper.find('.stats').exists()).toBe(true)
      expect(wrapper.text()).toContain('Cartes restantes')
      expect(wrapper.text()).toContain('15') // Taille du deck initial
    })
  })

  describe('Tirage de cartes', () => {
    it('devrait tirer 6 cartes au démarrage', async () => {
      const wrapper = mount(DeckDrawSimulator, {
        props: {
          deck: mockDeck
        }
      })

      await wrapper.find('.draw-button').trigger('click')
      
      const drawnCards = wrapper.findAll('.drawn-card')
      expect(drawnCards).toHaveLength(6)
    })

    it('devrait émettre l\'événement draw', async () => {
      const wrapper = mount(DeckDrawSimulator, {
        props: {
          deck: mockDeck
        }
      })

      await wrapper.find('.draw-button').trigger('click')
      
      expect(wrapper.emitted('draw')).toBeTruthy()
      expect(wrapper.emitted('draw')![0][0]).toHaveLength(6)
    })

    it('devrait mettre à jour les statistiques après un tirage', async () => {
      const wrapper = mount(DeckDrawSimulator, {
        props: {
          deck: mockDeck
        }
      })

      await wrapper.find('.draw-button').trigger('click')
      
      expect(wrapper.text()).toContain('9') // 15 - 6 cartes tirées
    })
  })

  describe('Mulligan', () => {
    it('devrait permettre de remplacer des cartes', async () => {
      const wrapper = mount(DeckDrawSimulator, {
        props: {
          deck: mockDeck
        }
      })

      await wrapper.find('.draw-button').trigger('click')
      await wrapper.find('.drawn-card').trigger('click')
      await wrapper.find('.mulligan-button').trigger('click')
      
      expect(wrapper.emitted('mulligan')).toBeTruthy()
    })

    it('devrait émettre l\'événement mulligan avec les cartes remplacées', async () => {
      const wrapper = mount(DeckDrawSimulator, {
        props: {
          deck: mockDeck
        }
      })

      await wrapper.find('.draw-button').trigger('click')
      await wrapper.find('.drawn-card').trigger('click')
      await wrapper.find('.mulligan-button').trigger('click')
      
      const mulliganEvent = wrapper.emitted('mulligan')![0]
      expect(mulliganEvent[0]).toHaveLength(1) // Une carte remplacée
      expect(mulliganEvent[1]).toHaveLength(1) // Une nouvelle carte
    })
  })

  describe('Analyse de la main', () => {
    it('devrait calculer la courbe de PA', async () => {
      const wrapper = mount(DeckDrawSimulator, {
        props: {
          deck: mockDeck
        }
      })

      await wrapper.find('.draw-button').trigger('click')
      
      expect(wrapper.find('.pa-curve').exists()).toBe(true)
      expect(wrapper.vm.handStats.averagePA).toBeDefined()
    })

    it('devrait calculer la distribution des types', async () => {
      const wrapper = mount(DeckDrawSimulator, {
        props: {
          deck: mockDeck
        }
      })

      await wrapper.find('.draw-button').trigger('click')
      
      expect(wrapper.find('.type-distribution').exists()).toBe(true)
      expect(wrapper.vm.handStats.typeDistribution).toBeDefined()
    })

    it('devrait détecter les synergies potentielles', async () => {
      const wrapper = mount(DeckDrawSimulator, {
        props: {
          deck: {
            ...mockDeck,
            cards: [
              { card: { ...createMockCard('1'), element: 'Feu' }, quantity: 3 },
              { card: { ...createMockCard('2'), element: 'Feu' }, quantity: 3 }
            ]
          }
        }
      })

      await wrapper.find('.draw-button').trigger('click')
      
      expect(wrapper.find('.synergies').exists()).toBe(true)
      expect(wrapper.text()).toContain('Synergie')
    })
  })

  describe('Performance', () => {
    it('devrait mesurer le temps de tirage', async () => {
      const wrapper = mount(DeckDrawSimulator, {
        props: {
          deck: mockDeck
        }
      })

      await wrapper.find('.draw-button').trigger('click')
      
      expect(usePerformanceMonitoring().startPerf).toHaveBeenCalledWith('Tirage de cartes')
    })

    it('devrait mesurer le temps d\'analyse', async () => {
      const wrapper = mount(DeckDrawSimulator, {
        props: {
          deck: mockDeck
        }
      })

      await wrapper.find('.draw-button').trigger('click')
      
      expect(usePerformanceMonitoring().startPerf).toHaveBeenCalledWith('Analyse de la main')
    })
  })

  describe('Gestion des erreurs', () => {
    it('devrait gérer un deck vide', () => {
      const wrapper = mount(DeckDrawSimulator, {
        props: {
          deck: {
            ...mockDeck,
            cards: []
          }
        }
      })

      expect(wrapper.find('.error-message').exists()).toBe(true)
      expect(wrapper.text()).toContain('Deck vide')
    })

    it('devrait gérer un deck invalide', () => {
      const wrapper = mount(DeckDrawSimulator, {
        props: {
          deck: {
            ...mockDeck,
            cards: [{ card: createMockCard('1'), quantity: 1 }] // Trop peu de cartes
          }
        }
      })

      expect(wrapper.find('.error-message').exists()).toBe(true)
      expect(wrapper.text()).toContain('Deck invalide')
    })
  })
}) 