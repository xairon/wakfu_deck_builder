<!-- Toast Component -->
<template>
  <div
    v-if="isVisible"
    class="toast-container fixed bottom-4 right-4 flex flex-col items-end gap-2 z-50"
  >
    <div
      class="toast p-4 rounded-lg shadow-lg flex items-center gap-3 transition-all duration-300"
      :class="[
        typeClasses[type],
        {
          'translate-y-0 opacity-100': isVisible,
          'translate-y-4 opacity-0': !isVisible,
        },
      ]"
    >
      <div class="toast-icon">
        <i class="fas" :class="typeIcons[type]"></i>
      </div>
      <div class="toast-content">
        <div v-if="title" class="toast-title font-semibold mb-1">
          {{ title }}
        </div>
        <div class="toast-message text-sm">{{ message }}</div>
      </div>
      <button
        @click="close"
        class="toast-close ml-4 text-sm opacity-70 hover:opacity-100"
      >
        <i class="fas fa-times"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

const props = defineProps<{
  message: string
  title?: string
  type?: 'success' | 'error' | 'info' | 'warning'
  duration?: number
  show: boolean
}>()

const emit = defineEmits(['close'])

const isVisible = ref(false)

const typeClasses = {
  success: 'bg-success text-success-content',
  error: 'bg-error text-error-content',
  info: 'bg-info text-info-content',
  warning: 'bg-warning text-warning-content',
}

const typeIcons = {
  success: 'fa-check-circle',
  error: 'fa-exclamation-circle',
  info: 'fa-info-circle',
  warning: 'fa-exclamation-triangle',
}

// Montre le toast
function show() {
  isVisible.value = true

  if (props.duration && props.duration > 0) {
    setTimeout(() => {
      close()
    }, props.duration)
  }
}

// Ferme le toast
function close() {
  isVisible.value = false
  emit('close')
}

// Surveiller la prop show
watch(
  () => props.show,
  (newValue) => {
    if (newValue) {
      show()
    } else {
      isVisible.value = false
    }
  },
  { immediate: true }
)

// Montrer le toast au chargement si show est true
onMounted(() => {
  if (props.show) {
    show()
  }
})
</script>

<style scoped>
.toast-container {
  pointer-events: none;
}
.toast {
  pointer-events: auto;
  max-width: 24rem;
}
</style>
