import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DeckComparison from '../DeckComparison.vue'
import { useToast } from '@/composables/useToast'

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  })
}))

describe('DeckComparison', () => {
  const mockDeck1 = {
    name: 'Deck 1',
    hero: { image_id: 'hero1', name: 'Hero 1', type: 'Héros', stats: { ap: 3, hp: 20, mp: 3 } },
    havreSac: { image_id: 'sac1', name: 'Sac 1', type: 'Havre-sac', effects: ['Effect 1'] },
    cards: [
      { card: { image_id: '1', name: 'Card 1', type: 'Allié', stats: { ap: 1, hp: 10 }, element: 'Feu' }, quantity: 3 },
      { card: { image_id: '2', name: 'Card 2', type: 'Sort', stats: { ap: 2 }, element: 'Eau' }, quantity: 3 }
    ]
  }

  const mockDeck2 = {
    name: 'Deck 2',
    hero: { image_id: 'hero2', name: 'Hero 2', type: 'Héros', stats: { ap: 2, hp: 25, mp: 2 } },
    havreSac: { image_id: 'sac2', name: 'Sac 2', type: 'Havre-sac', effects: ['Effect 2'] },
    cards: [
      { card: { image_id: '2', name: 'Card 2', type: 'Sort', stats: { ap: 2 }, element: 'Eau' }, quantity: 3 },
      { card: { image_id: '3', name: 'Card 3', type: 'Équipement', stats: { ap: 3 }, element: 'Terre' }, quantity: 3 }
    ]
  }

  let wrapper: ReturnType<typeof mount>

  beforeEach(() => {
    wrapper = mount(DeckComparison, {
      props: {
        deck1: mockDeck1,
        deck2: mockDeck2
      }
    })
  })

  describe('Métriques de base', () => {
    it('devrait calculer correctement les statistiques de base', () => {
      const metrics = wrapper.vm.deckMetrics.value
      expect(metrics.deck1.totalCards).toBe(6)
      expect(metrics.deck2.totalCards).toBe(6)
      expect(metrics.deck1.uniqueCards).toBe(2)
      expect(metrics.deck2.uniqueCards).toBe(2)
    })

    it('devrait calculer correctement les moyennes', () => {
      const metrics = wrapper.vm.deckMetrics.value
      expect(metrics.deck1.averageAP).toBeGreaterThan(0)
      expect(metrics.deck1.averageHP).toBeGreaterThan(0)
      expect(metrics.deck2.averageAP).toBeGreaterThan(0)
    })
  })

  describe('Distributions', () => {
    it('devrait calculer correctement la distribution des types', () => {
      const metrics = wrapper.vm.deckMetrics.value
      const typesDeck1 = metrics.deck1.typeDistribution
      expect(Object.keys(typesDeck1).length).toBe(2)
      expect(typesDeck1['Allié']).toBe(50) // 3/6 * 100
      expect(typesDeck1['Sort']).toBe(50) // 3/6 * 100
    })

    it('devrait calculer correctement la distribution des éléments', () => {
      const metrics = wrapper.vm.deckMetrics.value
      const elementsDeck1 = metrics.deck1.elementDistribution
      expect(Object.keys(elementsDeck1).length).toBe(2)
      expect(elementsDeck1['Feu']).toBe(50)
      expect(elementsDeck1['Eau']).toBe(50)
    })

    it('devrait calculer correctement la courbe de PA', () => {
      const metrics = wrapper.vm.deckMetrics.value
      const apCurveDeck1 = metrics.deck1.apCurve
      expect(Object.keys(apCurveDeck1).length).toBe(2)
      expect(apCurveDeck1[1]).toBe(50)
      expect(apCurveDeck1[2]).toBe(50)
    })
  })

  describe('Métriques avancées', () => {
    it('devrait calculer correctement les diversités', () => {
      const metrics = wrapper.vm.deckMetrics.value
      expect(metrics.deck1.cardDiversity).toBe(2/6)
      expect(metrics.deck1.elementDiversity).toBe(2/4)
      expect(metrics.deck1.typeDiversity).toBe(2/5)
    })

    it('devrait analyser correctement les synergies', () => {
      const metrics = wrapper.vm.deckMetrics.value
      expect(metrics.deck1.synergies.length).toBeGreaterThan(0)
      expect(metrics.deck1.synergies[0].strength).toBeGreaterThan(0)
    })

    it('devrait calculer correctement le potentiel de combos', () => {
      const metrics = wrapper.vm.deckMetrics.value
      expect(metrics.deck1.comboPotential.length).toBeGreaterThan(0)
      expect(metrics.deck1.comboPotential[0].probability).toBeGreaterThan(0)
    })
  })

  describe('Analyse comparative', () => {
    it('devrait calculer correctement les différences relatives', () => {
      const comparison = wrapper.vm.deckComparison.value
      expect(comparison.differences.totalCards).toBe(0) // même nombre de cartes
      expect(comparison.differences.cardDiversity).toBe(0) // même diversité
    })

    it('devrait identifier correctement les forces', () => {
      const comparison = wrapper.vm.deckComparison.value
      expect(Array.isArray(comparison.strengths.deck1)).toBe(true)
      expect(Array.isArray(comparison.strengths.deck2)).toBe(true)
    })

    it('devrait générer des suggestions pertinentes', () => {
      const comparison = wrapper.vm.deckComparison.value
      expect(Array.isArray(comparison.suggestions.deck1)).toBe(true)
      expect(Array.isArray(comparison.suggestions.deck2)).toBe(true)
    })

    it('devrait calculer correctement la compatibilité', () => {
      const comparison = wrapper.vm.deckComparison.value
      expect(comparison.compatibility.score).toBeGreaterThanOrEqual(0)
      expect(comparison.compatibility.score).toBeLessThanOrEqual(1)
      expect(Array.isArray(comparison.compatibility.reasons)).toBe(true)
    })

    it('devrait analyser correctement les styles de jeu', () => {
      const comparison = wrapper.vm.deckComparison.value
      expect(comparison.playstyle.deck1.style).toBeTruthy()
      expect(comparison.playstyle.deck1.description).toBeTruthy()
      expect(comparison.playstyle.deck2.style).toBeTruthy()
      expect(comparison.playstyle.deck2.description).toBeTruthy()
    })
  })

  describe('Cartes communes et uniques', () => {
    it('devrait identifier correctement les cartes communes', () => {
      expect(wrapper.vm.commonCards.value.length).toBe(1) // Card 2
    })

    it('devrait identifier correctement les cartes uniques', () => {
      expect(wrapper.vm.uniqueCardsDeck1.value.length).toBe(1) // Card 1
      expect(wrapper.vm.uniqueCardsDeck2.value.length).toBe(1) // Card 3
    })
  })

  describe('Génération de rapport', () => {
    it('devrait générer un rapport valide', async () => {
      const createObjectURL = vi.fn()
      const revokeObjectURL = vi.fn()
      global.URL.createObjectURL = createObjectURL
      global.URL.revokeObjectURL = revokeObjectURL

      await wrapper.vm.generateReport()

      expect(createObjectURL).toHaveBeenCalled()
      expect(revokeObjectURL).toHaveBeenCalled()
    })
  })

  describe('Gestion des erreurs', () => {
    it('devrait gérer les decks sans cartes', () => {
      const emptyDeck = {
        name: 'Empty',
        cards: []
      }
      wrapper = mount(DeckComparison, {
        props: {
          deck1: emptyDeck,
          deck2: emptyDeck
        }
      })
      const metrics = wrapper.vm.deckMetrics.value
      expect(metrics.deck1.totalCards).toBe(0)
      expect(metrics.deck1.cardDiversity).toBe(0)
    })

    it('devrait gérer les cartes sans statistiques', () => {
      const incompleteCard = {
        name: 'Incomplete',
        cards: [{ card: { image_id: '1', name: 'Card 1' }, quantity: 1 }]
      }
      wrapper = mount(DeckComparison, {
        props: {
          deck1: incompleteCard,
          deck2: incompleteCard
        }
      })
      const metrics = wrapper.vm.deckMetrics.value
      expect(metrics.deck1.averageAP).toBe(0)
      expect(metrics.deck1.averageHP).toBe(0)
    })
  })

  describe('Performance', () => {
    it('devrait gérer efficacement de grands decks', () => {
      const largeDeck = {
        name: 'Large Deck',
        cards: Array(50).fill(null).map((_, i) => ({
          card: {
            image_id: String(i),
            name: `Card ${i}`,
            type: 'Allié',
            stats: { ap: 1 }
          },
          quantity: 3
        }))
      }
      const start = performance.now()
      wrapper = mount(DeckComparison, {
        props: {
          deck1: largeDeck,
          deck2: largeDeck
        }
      })
      const metrics = wrapper.vm.deckMetrics.value
      const comparison = wrapper.vm.deckComparison.value
      const end = performance.now()
      expect(end - start).toBeLessThan(1000) // moins d'une seconde
    })
  })
}) 