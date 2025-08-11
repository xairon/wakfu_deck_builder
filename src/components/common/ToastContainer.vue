<template>
  <div
    class="toast-container fixed bottom-4 right-4 flex flex-col items-end gap-2 z-50"
  >
    <transition-group name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast p-4 rounded-lg shadow-lg flex items-center gap-3 transition-all duration-300"
        :class="[
          typeClasses[toast.type],
          {
            'translate-y-0 opacity-100': toast.show,
            'translate-y-4 opacity-0': !toast.show,
          },
        ]"
      >
        <div class="toast-icon">
          <i class="fas" :class="typeIcons[toast.type]"></i>
        </div>
        <div class="toast-content">
          <div v-if="toast.title" class="toast-title font-semibold mb-1">
            {{ toast.title }}
          </div>
          <div class="toast-message text-sm">{{ toast.message }}</div>
        </div>
        <button
          @click="removeToast(toast.id)"
          class="toast-close ml-4 text-sm opacity-70 hover:opacity-100"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { toasts, removeToast } = useToast()

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
</script>

<style scoped>
.toast-container {
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  max-width: 24rem;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease-out;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(30px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-30px);
}
</style>
