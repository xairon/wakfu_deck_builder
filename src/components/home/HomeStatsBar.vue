<template>
  <div class="grid grid-cols-2 gap-6 sm:grid-cols-4">
    <div v-for="s in items" :key="s.label">
      <p class="eyebrow">{{ s.label }}</p>
      <p class="mt-1 font-mono text-3xl tabular">{{ s.value }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface StatItem {
  label: string;
  value: string | number;
}
defineProps<{ items: StatItem[] }>();
</script>
