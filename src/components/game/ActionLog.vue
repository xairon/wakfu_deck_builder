<template>
  <div class="action-log">
    <p class="eyebrow text-primary">Journal</p>
    <ol class="action-log__list" aria-live="polite">
      <li v-for="line in recent" :key="line.seq" class="action-log__line">
        <span class="action-log__seq">{{ line.seq }}</span>
        <span>{{ line.text }}</span>
      </li>
      <li v-if="!recent.length" class="action-log__empty">
        Aucun coup pour l'instant.
      </li>
    </ol>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { LogLine } from "@/stores/gameStore";

const props = defineProps<{ lines: LogLine[] }>();
const recent = computed(() => props.lines.slice(-14).reverse());
</script>

<style scoped>
.action-log {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}
.action-log__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  font-size: 13px;
}
.action-log__line {
  display: flex;
  gap: 8px;
  color: rgba(27, 26, 23, 0.8);
  padding-bottom: 4px;
  border-bottom: 1px dotted rgba(27, 26, 23, 0.12);
}
.action-log__seq {
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 11px;
  color: rgba(27, 26, 23, 0.4);
  min-width: 20px;
}
.action-log__empty {
  color: rgba(27, 26, 23, 0.4);
  font-style: italic;
}
</style>
