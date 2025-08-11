<template>
  <div class="element-selector">
    <div class="flex flex-wrap gap-2">
      <button
        v-for="element in elements"
        :key="element"
        class="btn btn-ghost btn-circle"
        :class="{
          'btn-active': modelValue.includes(element),
          [getElementColor(element)]: modelValue.includes(element),
        }"
        @click="toggleElement(element)"
      >
        <ElementIcon :element="element" size="md" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useElements, type Element } from '@/services/elementService'
import ElementIcon from './ElementIcon.vue'

const props = defineProps<{
  modelValue: Element[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: Element[]): void
}>()

const { elements, getElementColor } = useElements()

function toggleElement(element: Element) {
  const newValue = [...props.modelValue]
  const index = newValue.indexOf(element)

  if (index === -1) {
    newValue.push(element)
  } else {
    newValue.splice(index, 1)
  }

  emit('update:modelValue', newValue)
}
</script>
