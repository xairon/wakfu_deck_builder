<template>
  <div 
    class="element-icon" 
    :class="[size, getElementColor(element)]"
    :title="element"
  >
    <img 
      :src="getElementIcon(element)" 
      :alt="element"
      class="w-full h-full object-contain"
    />
  </div>
</template>

<script setup lang="ts">
import { useElements, type Element } from '@/services/elementService'

const props = defineProps<{
  element: Element
  size?: 'sm' | 'md' | 'lg'
}>()

const { getElementIcon, getElementColor } = useElements()
</script>

<style scoped>
.element-icon {
  @apply inline-flex items-center justify-center rounded-full bg-base-200;
}

.element-icon.sm {
  @apply w-6 h-6;
}

.element-icon.md {
  @apply w-8 h-8;
}

.element-icon.lg {
  @apply w-12 h-12;
}
</style> 