<template>
  <dialog
    class="modal"
    :open="open"
    data-testid="confirm-dialog"
    @click.self="$emit('cancel')"
    @keydown.esc="$emit('cancel')"
  >
    <div class="modal-box border border-base-content/30 bg-base-100 modalPop">
      <h3 class="font-display text-lg leading-snug">{{ title }}</h3>
      <p v-if="message" class="mt-2 text-sm text-base-content/70">
        {{ message }}
      </p>
      <div class="modal-action mt-6 flex gap-2 justify-end">
        <button
          class="btn btn-ghost btn-sm font-mono uppercase tracking-wider"
          data-testid="confirm-cancel"
          @click="$emit('cancel')"
        >
          {{ cancelLabel }}
        </button>
        <button
          class="btn btn-sm font-mono uppercase tracking-wider"
          :class="danger ? 'btn-error' : 'btn-primary'"
          data-testid="confirm-ok"
          @click="$emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
  }>(),
  {
    message: "",
    confirmLabel: "Confirmer",
    cancelLabel: "Annuler",
    danger: false,
  },
);

defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>
