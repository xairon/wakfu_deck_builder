<template>
  <div class="action-log">
    <p class="action-log__title">Journal</p>
    <TransitionGroup
      tag="ol"
      name="logline"
      class="action-log__list"
      aria-live="polite"
    >
      <li v-for="line in recent" :key="line.seq" class="action-log__line">
        <span class="action-log__seq">{{ line.seq }}</span>
        <span>{{ line.text }}</span>
      </li>
      <li v-if="!recent.length" key="__empty" class="action-log__empty">
        Aucun coup pour l'instant.
      </li>
    </TransitionGroup>
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
.action-log__title {
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #f04e22;
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
  color: rgba(246, 245, 241, 0.78);
  padding-bottom: 4px;
  border-bottom: 1px dotted rgba(246, 245, 241, 0.12);
}
.action-log__seq {
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 11px;
  color: rgba(246, 245, 241, 0.38);
  min-width: 20px;
}
.action-log__empty {
  color: rgba(246, 245, 241, 0.38);
  font-style: italic;
}
.logline-enter-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}
.logline-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}
.logline-move {
  transition: transform 0.25s ease;
}
@media (prefers-reduced-motion: reduce) {
  .logline-enter-active,
  .logline-move {
    transition: none;
  }
}
</style>
