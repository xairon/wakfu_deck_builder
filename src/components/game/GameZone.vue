<template>
  <div class="game-zone" role="group" :aria-label="label">
    <div class="game-zone__head">
      <span class="eyebrow">{{ label }}</span>
      <span class="game-zone__count">{{ count }}</span>
    </div>

    <!-- Zone comptée / pile forcée (Pioche) : pile face cachée + clic -->
    <button
      v-if="zone.kind === 'count' || forcePile"
      type="button"
      class="game-zone__pile"
      :class="{ 'game-zone__pile--empty': count === 0 }"
      :aria-label="`${label} : ${count} cartes`"
      @click="emit('pile')"
    >
      <span class="game-zone__pile-count">{{ count }}</span>
    </button>

    <!-- Zone visible : cartes -->
    <div
      v-else
      class="game-zone__cards"
      :class="`game-zone__cards--${layout || 'row'}`"
    >
      <GameCard
        v-for="inst in zone.instances"
        :key="inst.instanceId"
        :instance="inst"
        :card="resolveCard(inst.cardId)"
        :selected="inst.instanceId === selectedId"
        class="game-zone__card"
        @select="emit('select', inst.instanceId)"
        @zoom="emit('zoom', inst.instanceId)"
      />
      <p v-if="!zone.instances.length" class="game-zone__empty">—</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Card } from "@/types/cards";
import type { RedactedZone } from "@/game";
import GameCard from "./GameCard.vue";

const props = defineProps<{
  zone: RedactedZone;
  label: string;
  resolveCard: (cardId: string | null) => Card | null;
  layout?: "row" | "fan" | "pile";
  selectedId?: string | null;
  forcePile?: boolean;
}>();
const emit = defineEmits<{
  (e: "select", instanceId: string): void;
  (e: "zoom", instanceId: string): void;
  (e: "pile"): void;
}>();

const count = computed(() =>
  props.zone.kind === "count" ? props.zone.count : props.zone.instances.length,
);
</script>

<style scoped>
.game-zone {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.game-zone__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.game-zone__count {
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 11px;
  color: rgba(27, 26, 23, 0.55);
}
.game-zone__cards {
  display: flex;
  gap: 6px;
  min-height: 76px;
}
.game-zone__cards--row {
  flex-wrap: wrap;
}
.game-zone__cards--fan {
  flex-wrap: nowrap;
  overflow-x: auto;
  padding-bottom: 4px;
}
.game-zone__card {
  width: 58px;
  flex: 0 0 auto;
}
.game-zone__cards--fan .game-zone__card {
  width: 64px;
}
.game-zone__empty {
  color: rgba(27, 26, 23, 0.3);
  font-size: 22px;
  align-self: center;
  padding: 0 8px;
}
.game-zone__pile {
  width: 58px;
  aspect-ratio: 63 / 88;
  border-radius: 4px;
  border: 1px dashed rgba(27, 26, 23, 0.4);
  background:
    repeating-linear-gradient(
      45deg,
      rgba(27, 26, 23, 0.06),
      rgba(27, 26, 23, 0.06) 4px,
      transparent 4px,
      transparent 8px
    ),
    var(--paper-300, #dfdcd2);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: transform 0.15s ease;
}
.game-zone__pile:hover {
  transform: translateY(-2px);
}
.game-zone__pile--empty {
  opacity: 0.5;
  cursor: default;
}
.game-zone__pile-count {
  font-family: "Space Mono", ui-monospace, monospace;
  font-weight: 700;
  font-size: 18px;
  color: #1b1a17;
}
</style>
