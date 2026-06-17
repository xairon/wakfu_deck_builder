<!-- Toast Component -->
<template>
  <div
    v-if="isVisible"
    class="toast-container fixed bottom-4 right-4 flex flex-col items-end gap-2 z-50"
  >
    <div
      class="toast p-4 rounded-lg shadow-lg flex items-center gap-3 transition-all duration-300"
      :class="[
        typeClasses[type ?? 'info'],
        {
          'translate-y-0 opacity-100': isVisible,
          'translate-y-4 opacity-0': !isVisible,
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
            :d="typeIcons[type ?? 'info']"
          />
        </svg>
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";

const props = defineProps<{
  message: string;
  title?: string;
  type?: "success" | "error" | "info" | "warning";
  duration?: number;
  show: boolean;
}>();

const emit = defineEmits(["close"]);

const isVisible = ref(false);

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

// Montre le toast
function displayToast() {
  isVisible.value = true;

  if (props.duration && props.duration > 0) {
    setTimeout(() => {
      close();
    }, props.duration);
  }
}

// Ferme le toast
function close() {
  isVisible.value = false;
  emit("close");
}

// Surveiller la prop show
watch(
  () => props.show,
  (newValue) => {
    if (newValue) {
      displayToast();
    } else {
      isVisible.value = false;
    }
  },
  { immediate: true },
);

// Montrer le toast au chargement si show est true
onMounted(() => {
  if (props.show) {
    displayToast();
  }
});
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
