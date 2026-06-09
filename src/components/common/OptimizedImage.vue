<template>
  <div
    ref="containerRef"
    class="optimized-image"
    :class="{
      'is-loading': isLoading,
      'has-error': hasError,
      'is-visible': isVisible,
    }"
  >
    <!-- Placeholder/Blur -->
    <div
      v-if="isLoading"
      class="placeholder"
      :style="{
        backgroundColor: placeholderColor,
        aspectRatio: `${width}/${height}`,
      }"
    >
      <div class="loading">
        <div class="loading-spinner"></div>
      </div>
    </div>

    <!-- Image (PNG fallback — WebP <source> disabled until webp/ dir exists) -->
    <img
      ref="imageRef"
      :src="resolvedSrc"
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
    />

    <!-- Error Overlay -->
    <div
      v-if="hasError"
      class="absolute inset-0 flex items-center justify-center bg-base-200"
    >
      <div class="error">
        <span class="text-2xl">!</span>
        <span class="text-sm">Erreur de chargement</span>
        <button class="btn btn-xs btn-primary mt-2" @click="retryLoading">
          Réessayer
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Optimized image component with WebP support and thumbnail mode.
 *
 * Uses a <picture> element to prefer WebP when available, with a PNG fallback.
 * When the `thumbnail` prop is true, the thumbnail version is served instead.
 *
 * Helper functions:
 * - getWebpPath(src): converts /images/cards/foo.png -> /images/cards/webp/foo.webp
 * - getThumbPath(src): converts /images/cards/foo.png -> /images/cards/thumbs/foo.webp
 */

import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useIntersectionObserver } from "@vueuse/core";
import { measure } from "../../utils/performance";
import { METRIC_TYPES } from "../../utils/performance";

// Path helpers imported from utility module
import { getWebpPath, getThumbPath } from "@/utils/imagePaths";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

const props = withDefaults(
  defineProps<{
    /** Original image source path (e.g. /images/cards/123.png) */
    src: string;
    alt: string;
    width?: number;
    height?: number;
    loading?: "lazy" | "eager";
    fetchpriority?: "high" | "low" | "auto";
    threshold?: number;
    placeholderColor?: string;
    decoding?: "async" | "sync" | "auto";
    /** When true, use the thumbnail version (200px wide WebP) */
    thumbnail?: boolean;
  }>(),
  {
    loading: "lazy",
    fetchpriority: "auto",
    threshold: 0.1,
    placeholderColor: "#f3f4f6",
    decoding: "async",
    width: 300,
    height: 300,
    thumbnail: false,
  },
);

// ---------------------------------------------------------------------------
// Computed sources
// ---------------------------------------------------------------------------

/** The WebP source to use in <source srcset> */
const resolvedWebpSrc = computed(() => {
  if (props.thumbnail) {
    return getThumbPath(props.src);
  }
  return getWebpPath(props.src);
});

/** The fallback src for the <img> tag (original format) */
const resolvedSrc = computed(() => {
  if (props.thumbnail) {
    // For thumbnail mode, still fall back to the thumbnail webp
    // since there is no PNG thumbnail. The <img> tag acts as
    // a secondary fallback if <source> fails.
    return getThumbPath(props.src);
  }
  return props.src;
});

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

const emit = defineEmits<{
  (e: "error"): void;
}>();

// ---------------------------------------------------------------------------
// Refs & state
// ---------------------------------------------------------------------------

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
    threshold: props.threshold,
  },
);

// ---------------------------------------------------------------------------
// Methods
// ---------------------------------------------------------------------------

const handleLoad = () => {
  measure(METRIC_TYPES.COMPONENT_RENDER, "OptimizedImage.load", () => {
    isLoading.value = false;
    hasError.value = false;
  });
};

const handleError = () => {
  measure(METRIC_TYPES.COMPONENT_RENDER, "OptimizedImage.error", () => {
    isLoading.value = false;
    hasError.value = true;
    console.error(`Erreur de chargement d'image: ${props.src}`);
    emit("error");
  });
};

const retryLoading = () => {
  if (!imageRef.value) return;

  // Reset state
  isLoading.value = true;
  hasError.value = false;

  // Force image reload
  const currentSrc = imageRef.value.src;
  imageRef.value.src = "";
  setTimeout(() => {
    if (imageRef.value) {
      imageRef.value.src = currentSrc;
    }
  }, 100);
};

// ---------------------------------------------------------------------------
// Watchers & lifecycle
// ---------------------------------------------------------------------------

// Reset loading state when src changes (e.g. parent switches image)
watch(
  () => props.src,
  () => {
    isLoading.value = true;
    hasError.value = false;
  },
);

// Le préchargement manuel (<link rel=preload>) fuyait dans <head> et causait
// un double téléchargement. L'<img> gère déjà loading="lazy"/decoding/
// fetchpriority — aucun préchargement manuel nécessaire.

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
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
