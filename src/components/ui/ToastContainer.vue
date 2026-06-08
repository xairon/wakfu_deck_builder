<template>
  <div
    class="toast-container fixed bottom-4 right-4 flex flex-col items-end gap-2 z-50"
    :role="hasError ? 'alert' : 'status'"
    :aria-live="hasError ? 'assertive' : 'polite'"
  >
    <transition-group name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast p-4 border border-base-content/10 flex items-center gap-3 transition-all duration-300"
        :class="[
          typeClasses[toast.type],
          {
            'translate-y-0 opacity-100': toast.show,
            'translate-y-4 opacity-0': !toast.show,
          },
        ]"
      >
        <div class="toast-icon">
          <svg
            viewBox="0 0 24 24"
            class="h-5 w-5 shrink-0"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              :d="typeIcons[toast.type]"
            />
          </svg>
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
          aria-label="Fermer"
        >
          <svg
            viewBox="0 0 24 24"
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M6 6l12 12M18 6L6 18"
            />
          </svg>
        </button>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { useToast } from "@/composables/useToast";
import { computed } from "vue";

const { toasts, removeToast } = useToast();

const hasError = computed(() => toasts.value.some((t) => t.type === "error"));

const typeClasses = {
  success: "bg-success text-success-content",
  error: "bg-error text-error-content",
  info: "bg-info text-info-content",
  warning: "bg-warning text-warning-content",
};

// Tracés SVG (path "d") par type
const typeIcons = {
  success: "M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  error: "M12 9v4m0 4h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z",
  info: "M12 16v-4m0-4h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z",
  warning:
    "M12 9v4m0 4h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.7 3h16.96a2 2 0 0 0 1.7-3L13.7 3.86a2 2 0 0 0-3.4 0Z",
};
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
