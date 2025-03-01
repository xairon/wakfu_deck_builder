import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createRouter, createWebHistory } from 'vue-router';
import CardComponent from '../CardComponent.vue';
import OptimizedImage from '../OptimizedImage.vue';
import { usePerformanceMonitoring } from '@/utils/performance';

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

const mockCard = {
  image_id: 'test-card',
  name: 'Test Card',
  type: 'Sort',
  pa: 2,
  element: 'Feu'
};

describe('CardComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendu', () => {
    it('devrait rendre correctement avec les props par défaut', () => {
      const wrapper = mount(CardComponent, {
        props: {
          card: mockCard
        },
        global: {
          plugins: [router],
          stubs: {
            OptimizedImage: true
          }
        }
      });

      expect(wrapper.find('.card').exists()).toBe(true);
      expect(wrapper.find('.card-title').text()).toBe(mockCard.name);
      expect(wrapper.find('.badge').text()).toBe(mockCard.element);
    });

    it('devrait afficher le statut de chargement', async () => {
      const wrapper = mount(CardComponent, {
        props: {
          card: mockCard
        },
        global: {
          plugins: [router],
          stubs: {
            OptimizedImage: true
          }
        }
      });

      wrapper.vm.isLoading = true;
      await wrapper.vm.$nextTick();

      expect(wrapper.find('.loading').exists()).toBe(true);
    });

    it('devrait afficher le statut d\'erreur', async () => {
      const wrapper = mount(CardComponent, {
        props: {
          card: mockCard
        },
        global: {
          plugins: [router],
          stubs: {
            OptimizedImage: true
          }
        }
      });

      wrapper.vm.hasError = true;
      await wrapper.vm.$nextTick();

      expect(wrapper.find('.error').exists()).toBe(true);
    });
  });

  describe('Interactions', () => {
    it('devrait émettre un événement click', async () => {
      const wrapper = mount(CardComponent, {
        props: {
          card: mockCard
        },
        global: {
          plugins: [router],
          stubs: {
            OptimizedImage: true
          }
        }
      });

      await wrapper.find('.card').trigger('click');
      expect(wrapper.emitted('click')).toBeTruthy();
      expect(wrapper.emitted('click')?.[0]).toEqual([mockCard]);
    });

    it('devrait naviguer vers les détails si non sélectionnable', async () => {
      const push = vi.spyOn(router, 'push');
      const wrapper = mount(CardComponent, {
        props: {
          card: mockCard,
          selectable: false
        },
        global: {
          plugins: [router],
          stubs: {
            OptimizedImage: true
          }
        }
      });

      await wrapper.find('.card').trigger('click');
      expect(push).toHaveBeenCalledWith({
        name: 'card-details',
        params: { id: mockCard.image_id }
      });
    });

    it('ne devrait pas naviguer si sélectionnable', async () => {
      const push = vi.spyOn(router, 'push');
      const wrapper = mount(CardComponent, {
        props: {
          card: mockCard,
          selectable: true
        },
        global: {
          plugins: [router],
          stubs: {
            OptimizedImage: true
          }
        }
      });

      await wrapper.find('.card').trigger('click');
      expect(push).not.toHaveBeenCalled();
    });
  });

  describe('Gestion des images', () => {
    it('devrait gérer le chargement réussi', async () => {
      const wrapper = mount(CardComponent, {
        props: {
          card: mockCard
        },
        global: {
          plugins: [router],
          stubs: {
            OptimizedImage: true
          }
        }
      });

      await wrapper.findComponent(OptimizedImage).vm.$emit('load');
      expect(wrapper.vm.isLoading).toBe(false);
      expect(wrapper.vm.hasError).toBe(false);
    });

    it('devrait gérer les erreurs de chargement', async () => {
      const wrapper = mount(CardComponent, {
        props: {
          card: mockCard
        },
        global: {
          plugins: [router],
          stubs: {
            OptimizedImage: true
          }
        }
      });

      await wrapper.findComponent(OptimizedImage).vm.$emit('error');
      expect(wrapper.vm.isLoading).toBe(false);
      expect(wrapper.vm.hasError).toBe(true);
    });
  });
}); 