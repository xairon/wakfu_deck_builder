<template>
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">{{ title }}</h3>
      <p>{{ message }}</p>
      <div class="modal-action">
        <button 
          class="btn"
          @click="$emit('cancel')"
        >
          Annuler
        </button>
        <button 
          class="btn btn-error"
          @click="$emit('confirm')"
        >
          Confirmer
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  message: string
}>()

defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()
</script> 