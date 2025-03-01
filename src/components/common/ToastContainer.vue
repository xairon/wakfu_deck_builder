<template>
  <div class="toast toast-end">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      :class="[
        'alert',
        toast.type === 'success' ? 'alert-success' : 'alert-error'
      ]"
    >
      <span>{{ toast.message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { toasts } = useToast()
</script>

<style scoped>
.toast {
  z-index: 1000;
}
</style> 