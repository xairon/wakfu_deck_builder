import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DeckBuilder from '../deck/DeckBuilder.vue'
import { useDeckStore } from '@/stores/deckStore'
import { useToast } from '@/composables/useToast'
import { usePerformanceMonitoring } from '@/utils/performance'
import type { Card, Deck } from '@/types/card'

vi.mock('@/stores/deckStore', () => ({
  useDeckStore: vi.fn(() => ({
    createDeck: vi.fn(),
    updateDeck: vi.fn(),
    validateDeck: vi.fn(() => ({
      isValid: true,
      errors: []
    }))
  }))
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  })
}))

vi.mock('@/utils/performance', () => ({
  usePerformanceMonitoring: () => ({
    startPerf: vi.fn(() => vi.fn())
  })
}))

describe('DeckBuilder', () => {
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
    cards: [],
    createdAt: new Date(),
    updatedAt: new Date()
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('Rendu', () => {
    it('devrait rendre correctement le composant en mode création', () => {
      const wrapper = mount(DeckBuilder, {
        props: {
          mode: 'create'
        }
      })

      expect(wrapper.find('.deck-builder').exists()).toBe(true)
      expect(wrapper.find('input[type="text"]').exists()).toBe(true)
      expect(wrapper.find('.save-button').exists()).toBe(true)
    })

    it('devrait rendre correctement le composant en mode édition', () => {
      const wrapper = mount(DeckBuilder, {
        props: {
          mode: 'edit',
          initialDeck: mockDeck
        }
      })

      expect(wrapper.find('input[type="text"]').element.value).toBe(mockDeck.name)
    })
  })

  describe('Création de deck', () => {
    it('devrait créer un nouveau deck', async () => {
      const wrapper = mount(DeckBuilder, {
        props: {
          mode: 'create'
        }
      })

      await wrapper.find('input[type="text"]').setValue('Nouveau Deck')
      await wrapper.find('form').trigger('submit')

      expect(useDeckStore().createDeck).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Nouveau Deck'
        })
      )
    })

    it('devrait valider le nom du deck', async () => {
      const wrapper = mount(DeckBuilder, {
        props: {
          mode: 'create'
        }
      })

      await wrapper.find('form').trigger('submit')
      
      expect(wrapper.find('.error-message').exists()).toBe(true)
      expect(wrapper.text()).toContain('nom est requis')
    })
  })

  describe('Édition de deck', () => {
    it('devrait mettre à jour un deck existant', async () => {
      const wrapper = mount(DeckBuilder, {
        props: {
          mode: 'edit',
          initialDeck: mockDeck
        }
      })

      await wrapper.find('input[type="text"]').setValue('Deck Modifié')
      await wrapper.find('form').trigger('submit')

      expect(useDeckStore().updateDeck).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockDeck.id,
          name: 'Deck Modifié'
        })
      )
    })

    it('devrait valider les modifications', async () => {
      const wrapper = mount(DeckBuilder, {
        props: {
          mode: 'edit',
          initialDeck: {
            ...mockDeck,
            cards: Array(31).fill({ card: createMockCard('1'), quantity: 1 }) // Trop de cartes
          }
        }
      })

      await wrapper.find('form').trigger('submit')
      
      expect(wrapper.find('.error-message').exists()).toBe(true)
      expect(wrapper.text()).toContain('maximum')
    })
  })

  describe('Gestion des cartes', () => {
    it('devrait ajouter une carte au deck', async () => {
      const wrapper = mount(DeckBuilder, {
        props: {
          mode: 'create'
        }
      })

      const card = createMockCard('1')
      await wrapper.vm.addCard(card)

      expect(wrapper.vm.currentDeck.cards).toHaveLength(1)
      expect(wrapper.vm.currentDeck.cards[0].card).toEqual(card)
    })

    it('devrait retirer une carte du deck', async () => {
      const wrapper = mount(DeckBuilder, {
        props: {
          mode: 'edit',
          initialDeck: {
            ...mockDeck,
            cards: [{ card: createMockCard('1'), quantity: 1 }]
          }
        }
      })

      await wrapper.vm.removeCard(createMockCard('1'))

      expect(wrapper.vm.currentDeck.cards).toHaveLength(0)
    })

    it('devrait limiter le nombre de copies d\'une carte', async () => {
      const wrapper = mount(DeckBuilder, {
        props: {
          mode: 'create'
        }
      })

      const card = createMockCard('1')
      for (let i = 0; i < 4; i++) {
        await wrapper.vm.addCard(card)
      }

      expect(wrapper.vm.currentDeck.cards[0].quantity).toBe(3)
    })
  })

  describe('Validation', () => {
    it('devrait valider le nombre minimum de cartes', async () => {
      const wrapper = mount(DeckBuilder, {
        props: {
          mode: 'create'
        }
      })

      await wrapper.find('form').trigger('submit')
      
      expect(wrapper.find('.error-message').exists()).toBe(true)
      expect(wrapper.text()).toContain('minimum')
    })

    it('devrait valider les types de cartes requis', async () => {
      const wrapper = mount(DeckBuilder, {
        props: {
          mode: 'create'
        }
      })

      // Ajouter uniquement des équipements
      for (let i = 0; i < 15; i++) {
        await wrapper.vm.addCard({
          ...createMockCard(`${i}`),
          type: 'Équipement'
        })
      }

      await wrapper.find('form').trigger('submit')
      
      expect(wrapper.find('.error-message').exists()).toBe(true)
      expect(wrapper.text()).toContain('type')
    })
  })

  describe('Performance', () => {
    it('devrait mesurer le temps de validation', async () => {
      const wrapper = mount(DeckBuilder, {
        props: {
          mode: 'create'
        }
      })

      await wrapper.find('form').trigger('submit')
      
      expect(usePerformanceMonitoring().startPerf).toHaveBeenCalledWith(
        'Validation du deck'
      )
    })

    it('devrait mesurer le temps de sauvegarde', async () => {
      const wrapper = mount(DeckBuilder, {
        props: {
          mode: 'create'
        }
      })

      await wrapper.find('form').trigger('submit')
      
      expect(usePerformanceMonitoring().startPerf).toHaveBeenCalledWith(
        'Sauvegarde du deck'
      )
    })
  })

  describe('Gestion des erreurs', () => {
    it('devrait gérer les erreurs de sauvegarde', async () => {
      vi.mocked(useDeckStore().createDeck).mockRejectedValueOnce(
        new Error('Erreur de sauvegarde')
      )

      const wrapper = mount(DeckBuilder, {
        props: {
          mode: 'create'
        }
      })

      await wrapper.find('input[type="text"]').setValue('Nouveau Deck')
      await wrapper.find('form').trigger('submit')

      expect(useToast().error).toHaveBeenCalled()
      expect(wrapper.find('.error-message').exists()).toBe(true)
    })

    it('devrait gérer les erreurs de validation', async () => {
      vi.mocked(useDeckStore().validateDeck).mockReturnValueOnce({
        isValid: false,
        errors: ['Erreur de validation']
      })

      const wrapper = mount(DeckBuilder, {
        props: {
          mode: 'create'
        }
      })

      await wrapper.find('form').trigger('submit')

      expect(wrapper.find('.error-message').exists()).toBe(true)
      expect(wrapper.text()).toContain('Erreur de validation')
    })
  })
}) 