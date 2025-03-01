<template>
  <div class="flex items-center gap-1">
    <span>{{ value }}</span>
    <ElementIcon 
      v-if="element && element !== ELEMENTS.NEUTRE"
      :element="element"
      size="sm"
    />
  </div>
</template>

<script setup lang="ts">
import { ELEMENTS, type Element } from '@/services/elementService'
import ElementIcon from './ElementIcon.vue'

defineProps<{
  value: number | string
  element?: Element
}>()
</script> 