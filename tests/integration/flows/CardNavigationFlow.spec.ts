import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { createTestingPinia } from '@pinia/testing'
import { nextTick } from 'vue'
import { useCardStore } from '@/stores/cardStore'
import CardComponent from '@/components/card/CardComponent.vue'
import CardGrid from '@/components/card/CardGrid.vue'
import CardDetailsView from '@/views/CardDetailsView.vue'

describe('Navigation des cartes', () => {
  let router: ReturnType<typeof createRouter>
  let cardStore: ReturnType<typeof useCardStore>

  beforeEach(() => {
    // Configuration du router
    router = createRouter({
      history: createWebHistory(),
      routes: [
        {
          path: '/cards',
          name: 'cards',
          component: CardGrid
        },
        {
          path: '/cards/:id',
          name: 'card-details',
          component: CardDetailsView,
          props: true
        }
      ]
    })

    // Configuration de Pinia
    setActivePinia(createPinia())
    cardStore = useCardStore()

    // Initialisation des données de test
    cardStore.cards = [
      {
        image_id: 'test-1',
        name: 'Test Card 1',
        type: 'Sort',
        element: 'Feu',
        stats: { ap: 3 },
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
      },
      {
        image_id: 'test-2',
        name: 'Test Card 2',
        type: 'Allié',
        element: 'Eau',
        stats: { ap: 2 },
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
      }
    ]
  })

  describe('Navigation depuis la grille', () => {
    it('devrait naviguer vers les détails au clic sur une carte', async () => {
      const wrapper = mount(CardGrid, {
        global: {
          plugins: [router],
          stubs: {
            CardComponent: true
          }
        },
        props: {
          cards: cardStore.cards
        }
      })

      // Simuler le clic sur une carte
      await wrapper.findComponent(CardComponent).trigger('click')

      // Vérifier la navigation
      expect(router.currentRoute.value.name).toBe('card-details')
      expect(router.currentRoute.value.params.id).toBe('test-1')
    })

    it('devrait charger correctement les détails de la carte', async () => {
      // Naviguer directement vers les détails
      await router.push('/cards/test-1')

      const wrapper = mount(CardDetailsView, {
        global: {
          plugins: [router],
          stubs: {
            CardComponent: true
          }
        }
      })

      // Vérifier que les détails sont chargés
      expect(wrapper.text()).toContain('Test Card 1')
      expect(wrapper.text()).toContain('Sort')
      expect(wrapper.text()).toContain('Feu')
    })
  })

  describe('Mode sélection', () => {
    it('ne devrait pas naviguer en mode sélection', async () => {
      const wrapper = mount(CardGrid, {
        global: {
          plugins: [router],
          stubs: {
            CardComponent: true
          }
        },
        props: {
          cards: cardStore.cards,
          selectionMode: true
        }
      })

      // Simuler le clic sur une carte
      await wrapper.findComponent(CardComponent).trigger('click')

      // Vérifier qu'il n'y a pas eu de navigation
      expect(router.currentRoute.value.name).not.toBe('card-details')
    })

    it('devrait émettre l\'événement de sélection', async () => {
      const wrapper = mount(CardGrid, {
        global: {
          plugins: [router],
          stubs: {
            CardComponent: true
          }
        },
        props: {
          cards: cardStore.cards,
          selectionMode: true
        }
      })

      // Simuler le clic sur une carte
      await wrapper.findComponent(CardComponent).trigger('click')

      // Vérifier l'émission de l'événement
      expect(wrapper.emitted('cardClick')).toBeTruthy()
      expect(wrapper.emitted('cardClick')![0]).toEqual([cardStore.cards[0]])
    })
  })

  describe('Gestion des erreurs', () => {
    it('devrait afficher un message d\'erreur pour une carte inexistante', async () => {
      // Naviguer vers une carte inexistante
      await router.push('/cards/invalid-id')

      const wrapper = mount(CardDetailsView, {
        global: {
          plugins: [router]
        }
      })

      // Vérifier le message d'erreur
      expect(wrapper.text()).toContain('Carte non trouvée')
    })

    it('devrait rediriger vers la liste des cartes depuis le message d\'erreur', async () => {
      await router.push('/cards/invalid-id')

      const wrapper = mount(CardDetailsView, {
        global: {
          plugins: [router]
        }
      })

      // Cliquer sur le bouton de redirection
      await wrapper.find('.btn-primary').trigger('click')

      // Vérifier la redirection
      expect(router.currentRoute.value.name).toBe('cards')
    })
  })
}) 