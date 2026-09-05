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
    <img
      v-else-if="deck && count > 0"
      class="gpile__img"
      src="/images/card-back.webp"
      alt=""
      aria-hidden="true"
    />
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
  /** Pile PUBLIQUE consultable (Défausse) : le clic OUVRE le contenu complet
   * (façon cimetière MTGA) au lieu de zoomer la seule carte du dessus. */
  browse?: boolean;
}>();
const emit = defineEmits<{
  (e: "act"): void;
  (e: "zoom", instanceId: string): void;
  (e: "browse"): void;
}>();

const depth = computed(() => Math.min(props.count, 6));

const topImg = computed(() => {
  if (props.deck || !props.top?.cardId || !props.topCard) return null;
  const cleanId = props.top.cardId.replace(/_(recto|verso)$/, "");
  const faceSuffix = props.top.face === "verso" ? "verso" : "recto";
  return getThumbPath(
    props.topCard.mainType === "Héros"
      ? `/images/cards/${cleanId}_${faceSuffix}.webp`
      : `/images/cards/${props.top.cardId}.webp`,
  );
});

function onClick(): void {
  if (props.deck) emit("act");
  else if (props.browse && props.count > 0) emit("browse");
  else if (props.top) emit("zoom", props.top.instanceId);
  else emit("act");
}
</script>

<style scoped>
.gpile {
  position: relative;
  width: var(--pile, 80px);
  aspect-ratio: 63 / 88;
  border-radius: 8px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(240, 166, 43, 0.25);
  background: linear-gradient(
    145deg,
    rgba(32, 26, 20, 0.7) 0%,
    rgba(14, 11, 8, 0.85) 100%
  );
  /* épaisseur de pile proportionnelle au nombre de cartes */
  box-shadow:
    calc(var(--depth, 0) * 1px) calc(var(--depth, 0) * 1px) 0
      rgba(58, 50, 42, 0.9),
    calc(var(--depth, 0) * 2px) calc(var(--depth, 0) * 2px) 0
      rgba(28, 24, 19, 0.85),
    calc(var(--depth, 0) * 2px + 4px) calc(var(--depth, 0) * 2px + 6px) 14px
      rgba(0, 0, 0, 0.6);
  cursor: pointer;
  transition:
    transform 0.18s cubic-bezier(0.2, 0.9, 0.3, 1.2),
    border-color 0.2s ease,
    box-shadow 0.18s ease;
  overflow: visible;
}
.gpile:hover {
  transform: translateY(-4px) scale(1.02);
  border-color: rgba(240, 166, 43, 0.6);
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.7),
    0 0 14px rgba(240, 166, 43, 0.25);
}
.gpile:active {
  transform: translateY(-1px) scale(0.98);
}
.gpile:focus-visible {
  outline: 2px solid #f0a62b;
  outline-offset: 2px;
}
.gpile--deck {
  border-color: rgba(240, 166, 43, 0.4);
}
.gpile--reserve {
  border-color: rgba(168, 85, 247, 0.35);
}
.gpile--empty {
  opacity: 0.5;
  border-style: dashed;
  border-color: rgba(255, 255, 255, 0.15);
  box-shadow: none;
  background: rgba(0, 0, 0, 0.2);
}
.gpile--empty:hover {
  opacity: 0.85;
  border-color: rgba(240, 166, 43, 0.45);
}
.gpile__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 7px;
}
.gpile__count {
  position: absolute;
  z-index: 2;
  top: 3px;
  right: 3px;
  min-width: 18px;
  padding: 1px 5px;
  border-radius: 999px;
  background: rgba(14, 11, 8, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.18);
  font-family: "Space Mono", ui-monospace, monospace;
  font-weight: 700;
  font-size: 11px;
  line-height: 1.2;
  color: #f6f5f1;
  text-align: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.7);
}
.gpile--deck .gpile__count {
  background: linear-gradient(135deg, #f0a62b, #b45309);
  border-color: rgba(255, 255, 255, 0.3);
  color: #120e09;
}
.gpile__label {
  position: absolute;
  z-index: 2;
  bottom: 3px;
  left: 3px;
  right: 3px;
  text-align: center;
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(246, 245, 241, 0.9);
  background: rgba(10, 8, 6, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  padding: 1px 2px;
  backdrop-filter: blur(4px);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
@media (prefers-reduced-motion: reduce) {
  .gpile,
  .gpile:hover {
    transition: none;
    transform: none;
  }
}
</style>
