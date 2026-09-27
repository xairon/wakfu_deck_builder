<template>
  <div
    class="toast-container fixed bottom-5 right-5 flex flex-col items-end gap-3 z-50 pointer-events-none max-w-sm w-full px-3"
    :role="hasError ? 'alert' : 'status'"
    :aria-live="hasError ? 'assertive' : 'polite'"
  >
    <transition-group name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast-missive group relative w-full pointer-events-auto p-3.5 border rounded-sm transition-all duration-300 backdrop-blur-md shadow-lg"
        :class="[
          typeStyles[toast.type].cardClass,
          {
            'translate-y-0 opacity-100': toast.show,
            'translate-y-4 opacity-0': !toast.show,
            'cursor-pointer hover:-translate-y-1 hover:shadow-xl': !!toast.onClick,
          },
        ]"
        @click="handleToastClick(toast)"
      >
        <!-- Filet décoratif supérieur type tranche de grimoire -->
        <div
          class="absolute top-0 left-0 right-0 h-[2px]"
          :class="typeStyles[toast.type].topBar"
        ></div>

        <div class="flex items-start gap-3">
          <!-- Sceau de cire / cachet thématique -->
          <div
            class="seal-stamp shrink-0 w-8 h-8 rounded-full flex items-center justify-center border text-sm font-bold shadow-seal"
            :class="typeStyles[toast.type].sealClass"
          >
            <span v-if="toast.type === 'success'">✓</span>
            <span v-else-if="toast.type === 'error'">✕</span>
            <span v-else-if="toast.type === 'warning'">!</span>
            <span v-else>📜</span>
          </div>

          <!-- Contenu de la missive -->
          <div class="flex-1 min-w-0 pr-4">
            <div class="flex items-center gap-1.5 mb-0.5">
              <span class="eyebrow text-[10px] text-base-content/60">
                {{ typeStyles[toast.type].eyebrow }}
              </span>
            </div>
            <div
              v-if="toast.title"
              class="font-display text-[15px] font-semibold leading-tight text-base-content mb-1"
            >
              {{ toast.title }}
            </div>
            <div class="text-[13px] leading-snug text-base-content/85 break-words">
              {{ toast.message }}
            </div>

            <!-- Call to action si cliquable -->
            <div
              v-if="toast.onClick"
              class="mt-2 pt-2 border-t border-base-content/10 flex items-center gap-1 text-[11px] font-mono font-bold uppercase tracking-wider text-primary group-hover:text-primary-focus transition-colors"
            >
              <span>{{ toast.actionLabel || 'Ouvrir la missive' }}</span>
              <span class="transition-transform group-hover:translate-x-1">→</span>
            </div>
          </div>

          <!-- Bouton fermer -->
          <button
            @click.stop="removeToast(toast.id)"
            class="text-base-content/40 hover:text-base-content transition-colors p-1 -mr-1 -mt-1 rounded hover:bg-base-content/5"
            aria-label="Fermer la notification"
            title="Fermer"
          >
            <svg
              viewBox="0 0 24 24"
              class="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
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
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { useToast, type Toast } from "@/composables/useToast";
import { computed } from "vue";

const { toasts, removeToast } = useToast();

const hasError = computed(() => toasts.value.some((t) => t.type === "error"));

function handleToastClick(toast: Toast) {
  if (toast.onClick) {
    toast.onClick();
    removeToast(toast.id);
  }
}

const typeStyles = {
  info: {
    cardClass: "bg-base-100/95 border-base-content/20 text-base-content border-l-4 border-l-primary",
    topBar: "bg-primary/40",
    sealClass: "bg-primary/10 border-primary/30 text-primary",
    eyebrow: "Missive du Monde des Douze",
  },
  success: {
    cardClass: "bg-base-100/95 border-base-content/20 text-base-content border-l-4 border-l-success",
    topBar: "bg-success/40",
    sealClass: "bg-success/10 border-success/30 text-success",
    eyebrow: "Chronique Validée",
  },
  error: {
    cardClass: "bg-base-100/95 border-base-content/20 text-base-content border-l-4 border-l-error",
    topBar: "bg-error/40",
    sealClass: "bg-error/10 border-error/30 text-error",
    eyebrow: "Incident du Havre-Sac",
  },
  warning: {
    cardClass: "bg-base-100/95 border-base-content/20 text-base-content border-l-4 border-l-warning",
    topBar: "bg-warning/40",
    sealClass: "bg-warning/10 border-warning/30 text-warning",
    eyebrow: "Avertissement des Gardiens",
  },
};
</script>

<style scoped>
.toast-missive {
  box-shadow: 0 4px 18px -4px rgba(20, 18, 14, 0.25);
}

[data-theme="dark"] .toast-missive {
  box-shadow: 0 6px 24px -4px rgba(0, 0, 0, 0.7);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.28s cubic-bezier(0.2, 0.7, 0.2, 1);
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.96);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-16px) scale(0.96);
}
</style>
