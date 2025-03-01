import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { createRouter, createWebHistory } from 'vue-router'
import Collection from '@/components/Collection.vue'
import CardGrid from '@/components/card/CardGrid.vue'
import CardDetail from '@/components/card/CardDetail.vue'
import { useCardStore } from '@/stores/cardStore'
import { useToast } from '@/composables/useToast'
import type { Card } from '@/types/card'

describe('Flux de gestion de la collection', () => {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      {
        path: '/collection',
        name: 'collection',
        component: Collection
      },
      {
        path: '/cards/:id',
        name: 'card-details',
        component: CardDetail,
        props: true
      }
    ]
  })

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

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    // Initialiser le store avec des cartes de test
    const cardStore = useCardStore()
    cardStore.cards = Array(20).fill(null).map((_, i) => createMockCard(`${i}`))
    cardStore.collection.cards = []
  })

  describe('Chargement initial', () => {
    it('devrait charger correctement la collection', async () => {
      const wrapper = mount(Collection, {
        global: {
          plugins: [router],
          stubs: {
            CardGrid: true,
            CardDetail: true
          }
        }
      })

      expect(wrapper.find('.collection').exists()).toBe(true)
      expect(wrapper.findComponent(CardGrid).exists()).toBe(true)
      expect(wrapper.text()).toContain('0 cartes') // Collection vide initialement
    })

    it('devrait gérer les erreurs de chargement', async () => {
      const cardStore = useCardStore()
      vi.spyOn(cardStore, 'initializeDatabase').mockRejectedValueOnce(
        new Error('Erreur de chargement')
      )

      const wrapper = mount(Collection, {
        global: {
          plugins: [router],
          stubs: {
            CardGrid: true,
            CardDetail: true
          }
        }
      })

      expect(wrapper.find('.error-message').exists()).toBe(true)
      expect(useToast().error).toHaveBeenCalled()
    })
  })

  describe('Ajout de cartes', () => {
    it('devrait permettre d\'ajouter une carte à la collection', async () => {
      const wrapper = mount(Collection, {
        global: {
          plugins: [router],
          stubs: {
            CardGrid: true,
            CardDetail: true
          }
        }
      })

      const card = createMockCard('test')
      await wrapper.vm.addToCollection(card, 1)

      const cardStore = useCardStore()
      expect(cardStore.collection.cards).toHaveLength(1)
      expect(cardStore.collection.cards[0].card).toEqual(card)
      expect(useToast().success).toHaveBeenCalled()
    })

    it('devrait permettre d\'ajouter plusieurs exemplaires', async () => {
      const wrapper = mount(Collection, {
        global: {
          plugins: [router],
          stubs: {
            CardGrid: true,
            CardDetail: true
          }
        }
      })

      const card = createMockCard('test')
      await wrapper.vm.addToCollection(card, 3)

      const cardStore = useCardStore()
      expect(cardStore.collection.cards[0].quantity).toBe(3)
    })

    it('devrait mettre à jour la quantité si la carte existe déjà', async () => {
      const wrapper = mount(Collection, {
        global: {
          plugins: [router],
          stubs: {
            CardGrid: true,
            CardDetail: true
          }
        }
      })

      const card = createMockCard('test')
      await wrapper.vm.addToCollection(card, 1)
      await wrapper.vm.addToCollection(card, 2)

      const cardStore = useCardStore()
      expect(cardStore.collection.cards[0].quantity).toBe(3)
    })
  })

  describe('Retrait de cartes', () => {
    it('devrait permettre de retirer une carte de la collection', async () => {
      const wrapper = mount(Collection, {
        global: {
          plugins: [router],
          stubs: {
            CardGrid: true,
            CardDetail: true
          }
        }
      })

      const card = createMockCard('test')
      await wrapper.vm.addToCollection(card, 2)
      await wrapper.vm.removeFromCollection(card, 1)

      const cardStore = useCardStore()
      expect(cardStore.collection.cards[0].quantity).toBe(1)
    })

    it('devrait retirer complètement la carte si la quantité atteint 0', async () => {
      const wrapper = mount(Collection, {
        global: {
          plugins: [router],
          stubs: {
            CardGrid: true,
            CardDetail: true
          }
        }
      })

      const card = createMockCard('test')
      await wrapper.vm.addToCollection(card, 1)
      await wrapper.vm.removeFromCollection(card, 1)

      const cardStore = useCardStore()
      expect(cardStore.collection.cards).toHaveLength(0)
    })
  })

  describe('Filtrage et recherche', () => {
    it('devrait filtrer les cartes par nom', async () => {
      const wrapper = mount(Collection, {
        global: {
          plugins: [router],
          stubs: {
            CardGrid: true,
            CardDetail: true
          }
        }
      })

      await wrapper.find('input[type="text"]').setValue('Card 1')
      
      const cardGrid = wrapper.findComponent(CardGrid)
      expect(cardGrid.props('cards')).toHaveLength(1)
    })

    it('devrait filtrer les cartes par type', async () => {
      const wrapper = mount(Collection, {
        global: {
          plugins: [router],
          stubs: {
            CardGrid: true,
            CardDetail: true
          }
        }
      })

      await wrapper.findAll('select')[0].setValue('Sort')
      
      const cardGrid = wrapper.findComponent(CardGrid)
      expect(cardGrid.props('cards').every(card => card.type === 'Sort')).toBe(true)
    })

    it('devrait filtrer les cartes par extension', async () => {
      const wrapper = mount(Collection, {
        global: {
          plugins: [router],
          stubs: {
            CardGrid: true,
            CardDetail: true
          }
        }
      })

      await wrapper.findAll('select')[1].setValue('Base')
      
      const cardGrid = wrapper.findComponent(CardGrid)
      expect(cardGrid.props('cards').every(card => card.extension === 'Base')).toBe(true)
    })

    it('devrait permettre de réinitialiser les filtres', async () => {
      const wrapper = mount(Collection, {
        global: {
          plugins: [router],
          stubs: {
            CardGrid: true,
            CardDetail: true
          }
        }
      })

      await wrapper.find('input[type="text"]').setValue('test')
      await wrapper.findAll('select')[0].setValue('Sort')
      await wrapper.findAll('select')[1].setValue('Base')

      await wrapper.find('.reset-filters').trigger('click')

      expect(wrapper.find('input[type="text"]').element.value).toBe('')
      expect(wrapper.findAll('select')[0].element.value).toBe('')
      expect(wrapper.findAll('select')[1].element.value).toBe('')
    })
  })

  describe('Détails des cartes', () => {
    it('devrait afficher les détails d\'une carte au clic', async () => {
      const wrapper = mount(Collection, {
        global: {
          plugins: [router],
          stubs: {
            CardGrid: true,
            CardDetail: true
          }
        }
      })

      const card = createMockCard('test')
      await wrapper.findComponent(CardGrid).vm.$emit('cardClick', card)

      expect(wrapper.findComponent(CardDetail).exists()).toBe(true)
      expect(wrapper.findComponent(CardDetail).props('card')).toEqual(card)
    })

    it('devrait permettre d\'ajouter une carte depuis les détails', async () => {
      const wrapper = mount(Collection, {
        global: {
          plugins: [router],
          stubs: {
            CardGrid: true,
            CardDetail: true
          }
        }
      })

      const card = createMockCard('test')
      await wrapper.findComponent(CardGrid).vm.$emit('cardClick', card)
      await wrapper.findComponent(CardDetail).vm.$emit('addToCollection', 1)

      const cardStore = useCardStore()
      expect(cardStore.collection.cards).toHaveLength(1)
      expect(cardStore.collection.cards[0].card).toEqual(card)
    })
  })

  describe('Statistiques', () => {
    it('devrait afficher les statistiques de collection', async () => {
      const wrapper = mount(Collection, {
        global: {
          plugins: [router],
          stubs: {
            CardGrid: true,
            CardDetail: true
          }
        }
      })

      const card = createMockCard('test')
      await wrapper.vm.addToCollection(card, 3)

      expect(wrapper.text()).toContain('1 carte unique')
      expect(wrapper.text()).toContain('3 exemplaires')
    })

    it('devrait calculer le pourcentage de complétion', async () => {
      const wrapper = mount(Collection, {
        global: {
          plugins: [router],
          stubs: {
            CardGrid: true,
            CardDetail: true
          }
        }
      })

      // Ajouter quelques cartes
      for (let i = 0; i < 5; i++) {
        await wrapper.vm.addToCollection(createMockCard(`${i}`), 1)
      }

      // 5 cartes sur 20 = 25%
      expect(wrapper.text()).toContain('25%')
    })
  })

  describe('Persistance', () => {
    it('devrait sauvegarder les modifications', async () => {
      const wrapper = mount(Collection, {
        global: {
          plugins: [router],
          stubs: {
            CardGrid: true,
            CardDetail: true
          }
        }
      })

      const card = createMockCard('test')
      await wrapper.vm.addToCollection(card, 1)

      // Recharger le composant
      wrapper.unmount()
      const newWrapper = mount(Collection, {
        global: {
          plugins: [router],
          stubs: {
            CardGrid: true,
            CardDetail: true
          }
        }
      })

      const cardStore = useCardStore()
      expect(cardStore.collection.cards).toHaveLength(1)
      expect(cardStore.collection.cards[0].card).toEqual(card)
    })

    it('devrait gérer les erreurs de sauvegarde', async () => {
      const cardStore = useCardStore()
      vi.spyOn(cardStore, 'addToCollection').mockRejectedValueOnce(
        new Error('Erreur de sauvegarde')
      )

      const wrapper = mount(Collection, {
        global: {
          plugins: [router],
          stubs: {
            CardGrid: true,
            CardDetail: true
          }
        }
      })

      const card = createMockCard('test')
      await wrapper.vm.addToCollection(card, 1)

      expect(useToast().error).toHaveBeenCalled()
    })
  })
}) 