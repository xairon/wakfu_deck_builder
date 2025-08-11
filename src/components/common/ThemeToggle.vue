<template>
  <button
    class="btn btn-ghost btn-circle"
    @click="toggleTheme"
    :title="isDark ? 'Passer en mode clair' : 'Passer en mode sombre'"
  >
    <div class="w-5 h-5">
      <span v-if="isDark" class="text-xl">🌙</span>
      <span v-else class="text-xl">☀️</span>
    </div>
  </button>
</template>

<script setup lang="ts">
import { useTheme } from '../composables/useTheme'

const { isDark, toggleTheme } = useTheme()
</script>
