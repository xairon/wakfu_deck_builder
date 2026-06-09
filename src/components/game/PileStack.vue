<template>
  <button
    type="button"
    class="gpile"
    :class="[
      deck ? 'gpile--deck' : 'gpile--discard',
      { 'gpile--reserve': reserve, 'gpile--empty': count === 0 },
    ]"
    :style="{ '--depth': depth }"
    :aria-label="`${label} : ${count} cartes`"
    @click="onClick"
  >
    <img v-if="topImg" class="gpile__img" :src="topImg" alt="" />
    <span v-else-if="deck" class="gpile__back" aria-hidden="true"></span>
    <span class="gpile__count">{{ count }}</span>
    <span class="gpile__label">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Card } from "@/types/cards";
import type { RedactedInstance } from "@/game";
import { getThumbPath } from "@/utils/imagePaths";

const props = defineProps<{
  label: string;
  count: number;
  deck?: boolean;
  reserve?: boolean;
  top?: RedactedInstance | null;
  topCard?: Card | null;
}>();
const emit = defineEmits<{
  (e: "act"): void;
  (e: "zoom", instanceId: string): void;
}>();

const depth = computed(() => Math.min(props.count, 6));

const topImg = computed(() => {
  if (props.deck || !props.top || !props.topCard) return null;
  return getThumbPath(
    props.topCard.mainType === "Héros"
      ? `/images/cards/${props.top.cardId}_recto.webp`
      : `/images/cards/${props.top.cardId}.webp`,
  );
});

function onClick(): void {
  if (props.deck) emit("act");
  else if (props.top) emit("zoom", props.top.instanceId);
  else emit("act");
}
</script>

<style scoped>
.gpile {
  position: relative;
  width: var(--pile, 80px);
  aspect-ratio: 63 / 88;
  border-radius: 6px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(246, 245, 241, 0.16);
  background: rgba(0, 0, 0, 0.3);
  /* épaisseur de pile proportionnelle au nombre de cartes */
  box-shadow:
    calc(var(--depth, 0) * 1px) calc(var(--depth, 0) * 1px) 0
      rgba(58, 50, 42, 0.9),
    calc(var(--depth, 0) * 2px) calc(var(--depth, 0) * 2px) 0
      rgba(28, 24, 19, 0.85),
    calc(var(--depth, 0) * 2px + 4px) calc(var(--depth, 0) * 2px + 6px) 14px
      rgba(0, 0, 0, 0.5);
  cursor: pointer;
  transition:
    transform 0.18s cubic-bezier(0.2, 0.9, 0.3, 1.2),
    box-shadow 0.18s ease;
  overflow: visible;
}
.gpile:hover {
  transform: translateY(-4px);
}
.gpile:active {
  transform: translateY(-1px) scale(0.98);
}
.gpile:focus-visible {
  outline: 2px solid #f04e22;
  outline-offset: 2px;
}
.gpile--reserve {
  border-color: rgba(240, 166, 43, 0.5);
}
.gpile--empty {
  opacity: 0.45;
  box-shadow: none;
}
.gpile__back {
  position: absolute;
  inset: 0;
  border-radius: 6px;
  background:
    radial-gradient(
      80% 60% at 50% 40%,
      rgba(240, 78, 34, 0.14),
      transparent 70%
    ),
    repeating-linear-gradient(
      45deg,
      #3a322a,
      #3a322a 6px,
      #2a241e 6px,
      #2a241e 12px
    );
  box-shadow: inset 0 0 0 2px rgba(246, 245, 241, 0.05);
}
.gpile__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
}
.gpile__count {
  position: relative;
  z-index: 1;
  font-family: "Space Mono", ui-monospace, monospace;
  font-weight: 700;
  font-size: 22px;
  color: #f6f5f1;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
}
.gpile__label {
  position: absolute;
  z-index: 1;
  bottom: 4px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(246, 245, 241, 0.8);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95);
}
@media (prefers-reduced-motion: reduce) {
  .gpile,
  .gpile:hover {
    transition: none;
    transform: none;
  }
}
</style>
