<script setup lang="ts">
const props = defineProps<{
  modelValue: string | null
  extensions: string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | null): void
}>()

function selectExtension(extension: string | null) {
  emit('update:modelValue', extension)
}
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <button
      class="btn btn-sm"
      :class="{ 'btn-primary': modelValue === null }"
      @click="selectExtension(null)"
    >
      Toutes les extensions
    </button>
    <button
      v-for="extension in extensions"
      :key="extension"
      class="btn btn-sm"
      :class="{ 'btn-primary': modelValue === extension }"
      @click="selectExtension(extension)"
    >
      {{ extension }}
    </button>
  </div>
</template>
