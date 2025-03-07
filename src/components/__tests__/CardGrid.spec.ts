import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createRouter, createWebHistory } from 'vue-router';
import CardGrid from '../CardGrid.vue';
import CardComponent from '../CardComponent.vue';
import VirtualList from '../VirtualList.vue';
import { useCardStore } from '@/stores/cardStore';
import { useToast } from '@/composables/useToast';
import { usePerformanceMonitoring } from '@/utils/performance';

vi.mock('@/stores/cardStore', () => ({
  useCardStore: vi.fn(() => ({
    collection: {
      cards: [],
      has: vi.fn()
    }
  }))
}));

vi.mock('@/composables/useToast', () => ({
  useToast: vi.fn(() => ({
    success: vi.fn(),
    error: vi.fn()
  }))
}));

vi.mock('@/utils/performance', () => ({
  usePerformanceMonitoring: () => ({
    startPerf: vi.fn(() => vi.fn())
  })
}));

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/cards/:id',
      name: 'card-details',
      component: { template: '<div>Card Details</div>' }
    }
  ]
});

const mockCards = [
  {
    image_id: 'card1',
    name: 'Card 1',
    type: 'Sort',
    pa: 2,
    element: 'Feu',
    extension: 'Base'
  },
  {
    image_id: 'card2',
    name: 'Card 2',
    type: 'Allié',
    pa: 3,
    element: 'Eau',
    extension: 'Extension 1'
  }
];

describe('CardGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendu', () => {
    it('devrait rendre correctement avec les props par défaut', () => {
      const wrapper = mount(CardGrid, {
        props: {
          cards: mockCards
        },
        global: {
          plugins: [router],
          stubs: {
            CardComponent: true,
            VirtualList: true
          }
        }
      });

      expect(wrapper.find('.card-grid').exists()).toBe(true);
      expect(wrapper.findAll('.form-control')).toHaveLength(4);
    });

    it('devrait afficher le nombre de cartes filtrées', () => {
      const wrapper = mount(CardGrid, {
        props: {
          cards: mockCards
        },
        global: {
          plugins: [router],
          stubs: {
            CardComponent: true,
            VirtualList: true
          }
        }
      });

      expect(wrapper.text()).toContain('2 cartes affichées');
    });
  });

  describe('Filtrage', () => {
    it('devrait filtrer par recherche', async () => {
      const wrapper = mount(CardGrid, {
        props: {
          cards: mockCards
        },
        global: {
          plugins: [router],
          stubs: {
            CardComponent: true,
            VirtualList: true
          }
        }
      });

      await wrapper.find('input[type="text"]').setValue('Card 1');
      expect(wrapper.vm.filteredCards).toHaveLength(1);
      expect(wrapper.vm.filteredCards[0].name).toBe('Card 1');
    });

    it('devrait filtrer par type', async () => {
      const wrapper = mount(CardGrid, {
        props: {
          cards: mockCards
        },
        global: {
          plugins: [router],
          stubs: {
            CardComponent: true,
            VirtualList: true
          }
        }
      });

      await wrapper.findAll('select')[0].setValue('Sort');
      expect(wrapper.vm.filteredCards).toHaveLength(1);
      expect(wrapper.vm.filteredCards[0].type).toBe('Sort');
    });

    it('devrait filtrer par extension', async () => {
      const wrapper = mount(CardGrid, {
        props: {
          cards: mockCards
        },
        global: {
          plugins: [router],
          stubs: {
            CardComponent: true,
            VirtualList: true
          }
        }
      });

      await wrapper.findAll('select')[1].setValue('Extension 1');
      expect(wrapper.vm.filteredCards).toHaveLength(1);
      expect(wrapper.vm.filteredCards[0].extension).toBe('Extension 1');
    });

    it('devrait filtrer par collection', async () => {
      const mockCardStore = useCardStore();
      vi.mocked(mockCardStore.collection.has).mockImplementation((id) => id === 'card1');

      const wrapper = mount(CardGrid, {
        props: {
          cards: mockCards
        },
        global: {
          plugins: [router],
          stubs: {
            CardComponent: true,
            VirtualList: true
          }
        }
      });

      await wrapper.find('input[type="checkbox"]').setValue(true);
      expect(wrapper.vm.filteredCards).toHaveLength(1);
      expect(wrapper.vm.filteredCards[0].image_id).toBe('card1');
    });
  });

  describe('Interactions', () => {
    it('devrait émettre un événement select en mode sélection', async () => {
      const wrapper = mount(CardGrid, {
        props: {
          cards: mockCards,
          selectable: true
        },
        global: {
          plugins: [router],
          stubs: {
            VirtualList: true
          }
        }
      });

      await wrapper.findComponent(CardComponent).vm.$emit('click', mockCards[0]);
      expect(wrapper.emitted('select')).toBeTruthy();
      expect(wrapper.emitted('select')?.[0]).toEqual([mockCards[0]]);
    });

    it('devrait réinitialiser les filtres', async () => {
      const wrapper = mount(CardGrid, {
        props: {
          cards: mockCards
        },
        global: {
          plugins: [router],
          stubs: {
            CardComponent: true,
            VirtualList: true
          }
        }
      });

      await wrapper.find('input[type="text"]').setValue('test');
      await wrapper.findAll('select')[0].setValue('Sort');
      await wrapper.findAll('select')[1].setValue('Extension 1');
      await wrapper.find('input[type="checkbox"]').setValue(true);

      await wrapper.find('button').trigger('click');

      expect(wrapper.vm.searchTerm).toBe('');
      expect(wrapper.vm.selectedType).toBeNull();
      expect(wrapper.vm.selectedExtension).toBeNull();
      expect(wrapper.vm.showOnlyCollection).toBe(false);
    });
  });
}); 