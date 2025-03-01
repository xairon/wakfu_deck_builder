import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import VirtualList from '../VirtualList.vue';
import { performanceMonitor } from '../../utils/performance';

describe('VirtualList', () => {
  // Props par défaut
  const mockItems = Array.from({ length: 100 }, (_, i) => ({
    id: i,
    content: `Item ${i}`
  }));

  const defaultProps = {
    items: mockItems,
    itemHeight: 50,
    buffer: 5
  };

  // Mocks
  beforeEach(() => {
    // Mock performance monitoring
    vi.spyOn(performanceMonitor, 'addMetric').mockImplementation(() => {});
  });

  describe('Rendu', () => {
    it('devrait rendre correctement avec les props par défaut', () => {
      const wrapper = mount(VirtualList, {
        props: defaultProps,
        slots: {
          item: `<template #item="{ item }">{{ item.content }}</template>`
        }
      });

      expect(wrapper.find('.virtual-list').exists()).toBe(true);
      expect(wrapper.find('.virtual-list-phantom').exists()).toBe(true);
      expect(wrapper.find('.virtual-list-content').exists()).toBe(true);
    });

    it('devrait calculer la hauteur totale correctement', () => {
      const wrapper = mount(VirtualList, {
        props: defaultProps,
        slots: {
          item: `<template #item="{ item }">{{ item.content }}</template>`
        }
      });

      const phantom = wrapper.find('.virtual-list-phantom');
      expect(phantom.attributes('style')).toContain('height: 5000px'); // 100 items * 50px
    });

    it('devrait rendre uniquement les éléments visibles', () => {
      const wrapper = mount(VirtualList, {
        props: defaultProps,
        slots: {
          item: `<template #item="{ item }">{{ item.content }}</template>`
        }
      });

      // Simuler une hauteur de conteneur
      wrapper.vm.clientHeight = 200; // 4 items visibles

      // Vérifier le nombre d'éléments rendus (visibles + buffer)
      const items = wrapper.findAll('.virtual-list-content > *');
      expect(items.length).toBe(14); // 4 visibles + 2 * 5 buffer
    });

    it('devrait gérer une liste vide', () => {
      const wrapper = mount(VirtualList, {
        props: {
          ...defaultProps,
          items: []
        }
      });

      const phantom = wrapper.find('.virtual-list-phantom');
      expect(phantom.attributes('style')).toContain('height: 0px');
    });

    it('devrait gérer des items sans keyField', () => {
      const itemsWithoutId = Array.from({ length: 10 }, (_, i) => ({
        content: `Item ${i}`
      }));

      const wrapper = mount(VirtualList, {
        props: {
          ...defaultProps,
          items: itemsWithoutId,
          keyField: 'content'
        },
        slots: {
          item: `<template #item="{ item }">
            <div class="test-item">{{ item.content }}</div>
          </template>`
        }
      });

      const items = wrapper.findAll('.test-item');
      expect(items.length).toBeGreaterThan(0);
    });
  });

  describe('Défilement', () => {
    it('devrait mettre à jour les éléments visibles lors du défilement', async () => {
      const wrapper = mount(VirtualList, {
        props: defaultProps,
        slots: {
          item: `<template #item="{ item }">{{ item.content }}</template>`
        }
      });

      // Simuler une hauteur de conteneur
      wrapper.vm.clientHeight = 200;

      // Simuler un défilement
      await wrapper.vm.handleScroll({ target: { scrollTop: 100 } });

      // Vérifier que les éléments visibles ont été mis à jour
      const items = wrapper.findAll('.virtual-list-content > *');
      expect(items[0].text()).toContain('Item 2'); // 100px / 50px = 2
    });

    it('devrait appliquer le bon offset de translation', async () => {
      const wrapper = mount(VirtualList, {
        props: defaultProps,
        slots: {
          item: `<template #item="{ item }">{{ item.content }}</template>`
        }
      });

      // Simuler un défilement
      await wrapper.vm.handleScroll({ target: { scrollTop: 100 } });

      const content = wrapper.find('.virtual-list-content');
      expect(content.attributes('style')).toContain('transform: translateY(100px)');
    });

    it('devrait maintenir la zone tampon', async () => {
      const wrapper = mount(VirtualList, {
        props: defaultProps,
        slots: {
          item: `<template #item="{ item }">{{ item.content }}</template>`
        }
      });

      // Simuler une hauteur de conteneur
      wrapper.vm.clientHeight = 200;

      // Simuler un défilement
      await wrapper.vm.handleScroll({ target: { scrollTop: 100 } });

      const items = wrapper.findAll('.virtual-list-content > *');
      expect(items.length).toBe(14); // 4 visibles + 2 * 5 buffer
    });

    it('devrait gérer le défilement rapide', async () => {
      const wrapper = mount(VirtualList, {
        props: defaultProps,
        slots: {
          item: `<template #item="{ item }">{{ item.content }}</template>`
        }
      });

      // Simuler plusieurs défilements rapides
      for (let i = 0; i < 5; i++) {
        await wrapper.vm.handleScroll({ target: { scrollTop: i * 100 } });
      }

      // Vérifier que le dernier défilement a été pris en compte
      const content = wrapper.find('.virtual-list-content');
      expect(content.attributes('style')).toContain('transform: translateY(400px)');
    });

    it('devrait gérer le défilement jusqu\'au bas', async () => {
      const wrapper = mount(VirtualList, {
        props: defaultProps,
        slots: {
          item: `<template #item="{ item }">{{ item.content }}</template>`
        }
      });

      // Simuler un défilement jusqu'au bas
      await wrapper.vm.handleScroll({ target: { scrollTop: 4800 } }); // 5000px - 200px

      const items = wrapper.findAll('.virtual-list-content > *');
      expect(items[items.length - 1].text()).toContain('Item 99');
    });
  });

  describe('Performance', () => {
    it('devrait throttler les événements de défilement', async () => {
      const wrapper = mount(VirtualList, {
        props: defaultProps,
        slots: {
          item: `<template #item="{ item }">{{ item.content }}</template>`
        }
      });

      // Simuler plusieurs défilements rapides
      const start = performance.now();
      for (let i = 0; i < 10; i++) {
        await wrapper.vm.handleScroll({ target: { scrollTop: i * 10 } });
      }
      const end = performance.now();

      // Vérifier que le temps total est supérieur au délai de throttle
      expect(end - start).toBeGreaterThan(16); // 60fps = ~16ms
    });

    it('devrait mesurer les performances du défilement', async () => {
      const wrapper = mount(VirtualList, {
        props: defaultProps,
        slots: {
          item: `<template #item="{ item }">{{ item.content }}</template>`
        }
      });

      await wrapper.vm.handleScroll({ target: { scrollTop: 100 } });

      expect(performanceMonitor.addMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'VirtualList.handleScroll'
        })
      );
    });

    it('devrait optimiser les recalculs lors des changements d\'items', async () => {
      const wrapper = mount(VirtualList, {
        props: defaultProps,
        slots: {
          item: `<template #item="{ item }">{{ item.content }}</template>`
        }
      });

      // Changer les items
      await wrapper.setProps({
        items: mockItems.slice(0, 50)
      });

      expect(performanceMonitor.addMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'VirtualList.updateSize'
        })
      );
    });
  });

  describe('Redimensionnement', () => {
    it('devrait mettre à jour la taille lors du redimensionnement', async () => {
      const wrapper = mount(VirtualList, {
        props: defaultProps,
        slots: {
          item: `<template #item="{ item }">{{ item.content }}</template>`
        }
      });

      // Simuler un redimensionnement
      const resizeObserver = vi.mocked(ResizeObserver).mock.instances[0];
      resizeObserver.observe(wrapper.element);

      // Déclencher le callback de ResizeObserver
      const callback = vi.mocked(ResizeObserver).mock.calls[0][0];
      callback([{
        contentRect: {
          width: 800,
          height: 400
        }
      }]);

      expect(wrapper.vm.clientHeight).toBe(400);
    });

    it('devrait gérer plusieurs redimensionnements consécutifs', async () => {
      const wrapper = mount(VirtualList, {
        props: defaultProps,
        slots: {
          item: `<template #item="{ item }">{{ item.content }}</template>`
        }
      });

      const resizeObserver = vi.mocked(ResizeObserver).mock.instances[0];

      // Simuler plusieurs redimensionnements
      for (let i = 0; i < 5; i++) {
        const callback = vi.mocked(ResizeObserver).mock.calls[0][0];
        callback([{
          contentRect: {
            width: 800 + i * 100,
            height: 400 + i * 100
          }
        }]);
      }

      expect(wrapper.vm.clientHeight).toBe(800); // 400 + 4 * 100
    });
  });

  describe('API exposée', () => {
    it('devrait exposer scrollToIndex', () => {
      const wrapper = mount(VirtualList, {
        props: defaultProps,
        slots: {
          item: `<template #item="{ item }">{{ item.content }}</template>`
        }
      });

      expect(wrapper.vm.scrollToIndex).toBeDefined();
    });

    it('devrait gérer scrollToIndex avec un index invalide', () => {
      const wrapper = mount(VirtualList, {
        props: defaultProps,
        slots: {
          item: `<template #item="{ item }">{{ item.content }}</template>`
        }
      });

      wrapper.vm.scrollToIndex(-1);
      expect(wrapper.find('.virtual-list').element.scrollTop).toBe(0);

      wrapper.vm.scrollToIndex(mockItems.length + 1);
      expect(wrapper.find('.virtual-list').element.scrollTop).toBe(4950); // (100 - 1) * 50
    });

    it('devrait exposer scrollToItem', () => {
      const wrapper = mount(VirtualList, {
        props: defaultProps,
        slots: {
          item: `<template #item="{ item }">{{ item.content }}</template>`
        }
      });

      expect(wrapper.vm.scrollToItem).toBeDefined();
    });
  });

  describe('Gestion des erreurs', () => {
    it('devrait gérer les erreurs de rendu des items', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Tenter de rendre un item invalide
      mount(VirtualList, {
        props: {
          ...defaultProps,
          items: [{ id: 1, something: undefined }]
        },
        slots: {
          item: `<template #item="{ item }">{{ item.something.invalid }}</template>`
        }
      });

      expect(errorSpy).toHaveBeenCalled();
    });

    it('devrait gérer les erreurs de défilement', async () => {
      const wrapper = mount(VirtualList, {
        props: defaultProps,
        slots: {
          item: `<template #item="{ item }">{{ item.content }}</template>`
        }
      });

      // Simuler une erreur de défilement
      await wrapper.vm.handleScroll({ target: null });

      expect(wrapper.vm.scrollTop).toBe(0);
    });
  });
}); 