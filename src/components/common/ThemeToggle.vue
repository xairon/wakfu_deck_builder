<template>
  <button
    class="btn btn-ghost btn-circle tooltip tooltip-bottom"
    @click="toggleTheme"
    :data-tip="isDark ? 'Passer en mode clair' : 'Passer en mode sombre'"
  >
    <div class="w-6 h-6 flex items-center justify-center transition-transform duration-200 hover:scale-110">
      <span v-if="isDark" class="text-2xl">🌙</span>
      <span v-else class="text-2xl">☀️</span>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'

const { currentTheme, toggleTheme } = useTheme()

const isDark = computed(() => currentTheme.value === 'dark')
</script>
