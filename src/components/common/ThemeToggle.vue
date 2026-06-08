<template>
  <button
    class="btn btn-ghost btn-circle tooltip tooltip-bottom"
    @click="toggleTheme"
    :data-tip="isDark ? 'Passer en mode clair' : 'Passer en mode sombre'"
    :aria-label="isDark ? 'Passer en mode clair' : 'Passer en mode sombre'"
    aria-live="polite"
  >
    <!-- Soleil (mode sombre actif → bascule vers clair) -->
    <svg
      v-if="isDark"
      viewBox="0 0 24 24"
      class="h-5 w-5"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
      />
    </svg>
    <!-- Lune (mode clair actif → bascule vers sombre) -->
    <svg
      v-else
      viewBox="0 0 24 24"
      class="h-5 w-5"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useTheme } from "@/composables/useTheme";

const { currentTheme, toggleTheme } = useTheme();

const isDark = computed(() => currentTheme.value === "dark");
</script>
