import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import OptimizedImage from '../OptimizedImage.vue';
import { performanceMonitor } from '../../utils/performance';

describe('OptimizedImage', () => {
  // Props par défaut
  const defaultProps = {
    src: '/test.jpg',
    alt: 'Test image',
    width: 300,
    height: 200
  };

  // Mocks
  beforeEach(() => {
    // Mock performance monitoring
    vi.spyOn(performanceMonitor, 'addMetric').mockImplementation(() => {});

    // Mock createElement et appendChild pour le preload
    const mockLink = {
      rel: '',
      as: '',
      href: ''
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    vi.spyOn(document.head, 'appendChild').mockImplementation(() => null);
  });

  describe('Rendu', () => {
    it('devrait rendre correctement avec les props par défaut', () => {
      const wrapper = mount(OptimizedImage, {
        props: defaultProps,
        global: {
          stubs: ['picture', 'source']
        }
      });

      expect(wrapper.find('.optimized-image').exists()).toBe(true);
      expect(wrapper.find('img').attributes('src')).toBe(defaultProps.src);
      expect(wrapper.find('img').attributes('alt')).toBe(defaultProps.alt);
    });

    it('devrait afficher le placeholder pendant le chargement', () => {
      const wrapper = mount(OptimizedImage, {
        props: defaultProps,
        global: {
          stubs: ['picture', 'source']
        }
      });

      expect(wrapper.find('.placeholder').exists()).toBe(true);
      expect(wrapper.find('.loading').exists()).toBe(true);
    });

    it('devrait générer le bon srcset WebP', () => {
      const wrapper = mount(OptimizedImage, {
        props: defaultProps,
        global: {
          stubs: ['picture']
        }
      });

      const source = wrapper.find('source');
      expect(source.attributes('type')).toBe('image/webp');
      
      const srcset = source.attributes('srcset');
      expect(srcset).toContain('.webp 0.5x');
      expect(srcset).toContain('.webp 1x');
      expect(srcset).toContain('.webp 2x');
    });
  });

  describe('Chargement', () => {
    it('devrait gérer le chargement réussi', async () => {
      const wrapper = mount(OptimizedImage, {
        props: defaultProps,
        global: {
          stubs: ['picture', 'source']
        }
      });

      await wrapper.find('img').trigger('load');

      expect(wrapper.find('.loading').exists()).toBe(false);
      expect(wrapper.emitted('load')).toBeTruthy();
    });

    it('devrait gérer les erreurs de chargement', async () => {
      const wrapper = mount(OptimizedImage, {
        props: defaultProps,
        global: {
          stubs: ['picture', 'source']
        }
      });

      await wrapper.find('img').trigger('error');

      expect(wrapper.find('.error').exists()).toBe(true);
      expect(wrapper.emitted('error')).toBeTruthy();
    });
  });

  describe('Lazy Loading', () => {
    it('devrait utiliser le lazy loading par défaut', () => {
      const wrapper = mount(OptimizedImage, {
        props: defaultProps,
        global: {
          stubs: ['picture', 'source']
        }
      });

      expect(wrapper.find('img').attributes('loading')).toBe('lazy');
    });

    it('devrait précharger l\'image quand elle devient visible', async () => {
      const wrapper = mount(OptimizedImage, {
        props: defaultProps,
        global: {
          stubs: ['picture', 'source']
        }
      });

      // Simuler l'intersection
      const callback = vi.mocked(IntersectionObserver).mock.calls[0][0];
      callback([{ isIntersecting: true }]);

      expect(document.createElement).toHaveBeenCalledWith('link');
      expect(document.head.appendChild).toHaveBeenCalled();
    });

    it('devrait précharger immédiatement avec loading="eager"', () => {
      mount(OptimizedImage, {
        props: {
          ...defaultProps,
          loading: 'eager'
        },
        global: {
          stubs: ['picture', 'source']
        }
      });

      expect(document.createElement).toHaveBeenCalledWith('link');
      expect(document.head.appendChild).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('devrait mesurer le temps de préchargement', async () => {
      const wrapper = mount(OptimizedImage, {
        props: defaultProps,
        global: {
          stubs: ['picture', 'source']
        }
      });

      // Simuler l'intersection
      const callback = vi.mocked(IntersectionObserver).mock.calls[0][0];
      callback([{ isIntersecting: true }]);

      expect(performanceMonitor.addMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'OptimizedImage.preload'
        })
      );
    });

    it('devrait mesurer le temps de chargement', async () => {
      const wrapper = mount(OptimizedImage, {
        props: defaultProps,
        global: {
          stubs: ['picture', 'source']
        }
      });

      await wrapper.find('img').trigger('load');
      
      expect(performanceMonitor.addMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'OptimizedImage.load'
        })
      );
    });

    it('devrait mesurer le temps de gestion d\'erreur', async () => {
      const wrapper = mount(OptimizedImage, {
        props: defaultProps,
        global: {
          stubs: ['picture', 'source']
        }
      });

      await wrapper.find('img').trigger('error');
      
      expect(performanceMonitor.addMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'OptimizedImage.error'
        })
      );
    });
  });

  describe('Nettoyage', () => {
    it('devrait déconnecter l\'IntersectionObserver', () => {
      const disconnect = vi.fn();
      vi.mocked(IntersectionObserver).mockReturnValue({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect,
        root: null,
        rootMargin: '',
        thresholds: []
      });

      const wrapper = mount(OptimizedImage, {
        props: defaultProps,
        global: {
          stubs: ['picture', 'source']
        }
      });

      wrapper.unmount();
      expect(disconnect).toHaveBeenCalled();
    });
  });
}); 