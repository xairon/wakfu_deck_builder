<template>
  <TransitionGroup
    tag="div"
    name="fan"
    class="hand-fan"
    :class="{ 'hand-fan--opp': !mine }"
    :style="{ '--overlap': `${overlap}px` }"
    role="group"
    :aria-label="mine ? 'Votre main' : 'Main de l\'adversaire'"
  >
    <div
      v-for="(item, i) in items"
      :key="item.key"
      class="hand-fan__card"
      :style="cardStyle(i)"
    >
      <GameCard
        v-if="item.inst"
        :instance="item.inst"
        :card="resolveCard(item.inst.cardId)"
        :draggable="mine && draggable"
        :selected="item.inst.instanceId === selectedId"
        @select="emit('select', item.inst!.instanceId)"
        @zoom="emit('zoom', item.inst!.instanceId)"
      />
      <div v-else class="hand-fan__back"></div>
    </div>
    <p v-if="mine && !items.length" key="__empty" class="hand-fan__empty">
      Main vide
    </p>
  </TransitionGroup>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { CSSProperties } from "vue";
import type { Card } from "@/types/cards";
import type { RedactedInstance } from "@/game";
import GameCard from "./GameCard.vue";

export interface HandItem {
  key: string;
  inst: RedactedInstance | null;
}

const props = defineProps<{
  items: HandItem[];
  resolveCard: (cardId: string | null) => Card | null;
  selectedId?: string | null;
  mine?: boolean;
  draggable?: boolean;
}>();
const emit = defineEmits<{
  (e: "select", instanceId: string): void;
  (e: "zoom", instanceId: string): void;
}>();

const overlap = computed(() => {
  const n = props.items.length;
  if (n <= 1) return 0;
  if (!props.mine) return n <= 6 ? 26 : 38;
  return n <= 5 ? 22 : n <= 8 ? 40 : 56;
});

/** Éventail : rotation linéaire + arc parabolique autour de la carte centrale. */
function cardStyle(i: number): CSSProperties {
  const n = props.items.length;
  const mid = (n - 1) / 2;
  const off = i - mid;
  const maxRot = Math.min(5, 30 / Math.max(n, 1));
  const rot = off * maxRot * (props.mine ? 1 : -1);
  const lift = Math.pow(Math.abs(off), 1.6) * Math.min(4, 22 / Math.max(n, 1));
  const ty = props.mine ? lift : -lift;
  return {
    "--rot": `${rot.toFixed(2)}deg`,
    "--ty": `${ty.toFixed(1)}px`,
    zIndex: i + 1,
  };
}
</script>

<style scoped>
.hand-fan {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  padding: 8px 0 2px;
  min-height: 40px;
}
.hand-fan--opp {
  align-items: flex-start;
}
.hand-fan__card {
  width: var(--card-hand, 130px);
  flex: 0 0 auto;
  transform: rotate(var(--rot, 0deg)) translateY(var(--ty, 0px));
  transform-origin: 50% 100%;
  transition:
    transform 0.24s cubic-bezier(0.2, 0.9, 0.3, 1.1),
    margin 0.24s ease;
}
.hand-fan__card + .hand-fan__card {
  margin-left: calc(var(--overlap, 0px) * -1);
}
.hand-fan--opp .hand-fan__card {
  width: var(--card-opp, 72px);
  transform-origin: 50% 0%;
}
.hand-fan:not(.hand-fan--opp) .hand-fan__card:hover,
.hand-fan:not(.hand-fan--opp) .hand-fan__card:focus-within {
  transform: rotate(0deg) translateY(-44px) scale(1.16);
  z-index: 40 !important;
}
.hand-fan--opp .hand-fan__card:hover {
  transform: rotate(var(--rot, 0deg)) translateY(calc(var(--ty, 0px) + 6px));
}
.hand-fan__back {
  width: 100%;
  aspect-ratio: 63 / 88;
  border-radius: 5px;
  background-image: url("/images/card-back.webp");
  background-size: cover;
  background-position: center;
  border: 1px solid rgba(0, 0, 0, 0.55);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.45);
}
.hand-fan__empty {
  align-self: center;
  font-size: 14px;
  color: rgba(246, 245, 241, 0.5);
  font-style: italic;
}

/* FLIP — arrivée / départ / réordonnancement */
.fan-move {
  transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.3, 1);
}
.fan-enter-active {
  transition:
    transform 0.32s cubic-bezier(0.2, 1.1, 0.3, 1),
    opacity 0.25s ease;
}
.fan-enter-from {
  transform: translateY(36px) scale(0.7);
  opacity: 0;
}
.fan-leave-active {
  position: absolute;
  transition:
    transform 0.22s ease,
    opacity 0.18s ease;
}
.fan-leave-to {
  transform: translateY(-24px) scale(0.85);
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .hand-fan__card,
  .fan-move,
  .fan-enter-active,
  .fan-leave-active {
    transition: none;
  }
}
</style>
