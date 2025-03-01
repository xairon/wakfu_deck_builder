<template>
  <div
    ref="containerRef"
    class="optimized-image"
    :class="{
      'is-loading': isLoading,
      'has-error': hasError,
      'is-visible': isVisible
    }"
  >
    <!-- Placeholder/Blur -->
    <div
      v-if="isLoading"
      class="placeholder"
      :style="{
        backgroundColor: placeholderColor,
        aspectRatio: `${width}/${height}`
      }"
    >
      <div class="loading">
        <div class="loading-spinner"></div>
      </div>
    </div>

    <!-- Image -->
    <img
      ref="imageRef"
      :src="src"
      :alt="alt"
      :width="width"
      :height="height"
      :loading="loading"
      :decoding="decoding"
      :fetchpriority="fetchpriority"
      @load="handleLoad"
      @error="handleError"
      :class="{ 'opacity-0': isLoading, 'opacity-100': !isLoading }"
      class="w-full h-full object-contain transition-opacity duration-300"
    >

    <!-- Error Overlay -->
    <div
      v-if="hasError"
      class="absolute inset-0 flex items-center justify-center bg-base-200"
    >
      <div class="error">
        <span class="text-2xl">⚠️</span>
        <span class="text-sm">Erreur de chargement</span>
        <button class="btn btn-xs btn-primary mt-2" @click="retryLoading">Réessayer</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Composant d'image optimisée avec attributs pour améliorer les performances
 * Ajoute automatiquement les dimensions, le chargement paresseux, et le décodage asynchrone
 */

import {
  ref,
  onMounted,
  onUnmounted,
  watch
} from 'vue';
import { useIntersectionObserver } from '@vueuse/core';
import { measure } from '../../utils/performance';
import { METRIC_TYPES } from '../../utils/performance';

// Définition des props
const props = withDefaults(defineProps<{
  src: string;
  alt: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
  fetchpriority?: 'high' | 'low' | 'auto';
  threshold?: number;
  placeholderColor?: string;
  decoding?: 'async' | 'sync' | 'auto';
}>(), {
  loading: 'lazy',
  fetchpriority: 'auto',
  threshold: 0.1,
  placeholderColor: '#f3f4f6',
  decoding: 'async',
  width: 300,
  height: 300
});

// Émissions des événements
const emit = defineEmits<{
  (e: 'error'): void;
}>();

// Refs
const containerRef = ref<HTMLElement | null>(null);
const imageRef = ref<HTMLImageElement | null>(null);
const isLoading = ref(true);
const hasError = ref(false);
const isVisible = ref(false);

// Intersection Observer
const { stop } = useIntersectionObserver(
  containerRef,
  ([{ isIntersecting }]) => {
    isVisible.value = isIntersecting;
  },
  {
    threshold: props.threshold
  }
);

// Méthodes
const preloadImage = () => {
  if (!imageRef.value || !isVisible.value) return;

  measure(
    METRIC_TYPES.COMPONENT_RENDER,
    'OptimizedImage.preload',
    () => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = props.src;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    }
  );
};

const handleLoad = () => {
  measure(
    METRIC_TYPES.COMPONENT_RENDER,
    'OptimizedImage.load',
    () => {
      isLoading.value = false;
      hasError.value = false;
    }
  );
};

const handleError = () => {
  measure(
    METRIC_TYPES.COMPONENT_RENDER,
    'OptimizedImage.error',
    () => {
      isLoading.value = false;
      hasError.value = true;
      console.error(`Erreur de chargement d'image: ${props.src}`);
      emit('error');
    }
  );
};

const retryLoading = () => {
  if (!imageRef.value) return;
  
  // Réinitialiser l'état
  isLoading.value = true;
  hasError.value = false;
  
  // Forcer le rechargement de l'image
  const currentSrc = imageRef.value.src;
  imageRef.value.src = '';
  setTimeout(() => {
    if (imageRef.value) {
      imageRef.value.src = currentSrc;
    }
  }, 100);
};

// Watchers
watch(isVisible, (visible) => {
  if (visible && props.loading === 'lazy') {
    preloadImage();
  }
});

// Lifecycle
onMounted(() => {
  if (props.loading === 'eager') {
    preloadImage();
  }
});

onUnmounted(() => {
  stop();
});
</script>

<style scoped>
.optimized-image {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: v-bind(placeholderColor);
}

.loading,
.error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: rgb(107 114 128);
}

.loading-spinner {
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid rgba(156, 163, 175, 0.3);
  border-radius: 50%;
  border-top-color: rgba(156, 163, 175, 1);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style> 