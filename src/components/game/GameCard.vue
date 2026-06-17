<template>
  <button
    type="button"
    class="game-card"
    :class="{
      'game-card--tapped': tapped,
      'game-card--selected': selected,
      'game-card--draggable': draggable,
      'game-card--ghost': isDragSource,
    }"
    :style="{ '--spine': spine }"
    :aria-label="ariaLabel"
    :data-testid="`card-${instance.instanceId}`"
    @click="onClick"
    @dblclick="emit('zoom')"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
    @focus="onEnter"
    @blur="onLeave"
    @pointerdown="onPointerDown"
  >
    <img
      :src="imgSrc"
      :alt="label"
      class="game-card__img"
      loading="lazy"
      decoding="async"
      draggable="false"
    />
    <span class="game-card__sheen" aria-hidden="true"></span>
    <span
      v-if="damage"
      :key="`dmg-${damage}`"
      class="game-card__badge game-card__badge--dmg"
      title="Dommages"
    >
      {{ damage }}
    </span>
    <span
      v-if="hp !== undefined"
      :key="`hp-${hp}`"
      class="game-card__badge game-card__badge--hp"
      title="PV"
    >
      {{ hp }}
    </span>
    <span
      v-if="level && level > 1"
      :key="`lvl-${level}`"
      class="game-card__badge game-card__badge--lvl"
      title="Niveau"
    >
      N{{ level }}
    </span>
    <span
      v-if="force && force.delta !== 0"
      :key="`force-${force.value}-${force.delta}`"
      class="game-card__badge game-card__badge--force"
      :class="
        force.delta > 0
          ? 'game-card__badge--force-up'
          : 'game-card__badge--force-down'
      "
      :title="`Force effective ${force.value} (${force.delta > 0 ? '+' : ''}${force.delta} vs Force imprimée)`"
    >
      F{{ force.value }}
    </span>
    <span
      v-if="resistance !== undefined"
      :key="`res-${resistance}`"
      class="game-card__badge game-card__badge--res"
      title="Résistance du Havre-Sac"
    >
      🛡{{ resistance }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Card } from "@/types/cards";
import type { RedactedInstance } from "@/game";
import { getThumbPath } from "@/utils/imagePaths";
import { elementColor } from "@/config/elementColors";
import { useCardPreview } from "@/composables/useCardPreview";
import { useBoardDnd } from "@/composables/useBoardDnd";
import { useGameStore } from "@/stores/gameStore";

const props = defineProps<{
  instance: RedactedInstance;
  card: Card | null;
  selected?: boolean;
  draggable?: boolean;
}>();
const emit = defineEmits<{
  (e: "select"): void;
  (e: "zoom"): void;
}>();

const preview = useCardPreview();
const dnd = useBoardDnd();

const hidden = computed(
  () => props.instance.face === "hidden" || !props.instance.cardId,
);
const isDragSource = computed(
  () => dnd.drag.value?.instanceId === props.instance.instanceId,
);

function onEnter(): void {
  if (!hidden.value && !dnd.isDragging.value) preview.show(props.card);
}
function onLeave(): void {
  preview.hide();
}
function onClick(): void {
  if (dnd.consumeClick()) return;
  emit("select");
}
function onPointerDown(e: PointerEvent): void {
  if (!props.draggable || hidden.value) return;
  dnd.armDrag(e, {
    instanceId: props.instance.instanceId,
    card: props.card,
    imgSrc: imgSrc.value,
    onStart: () => preview.hide(),
  });
}

const game = useGameStore();

const tapped = computed(() => props.instance.orientation === "tapped");
const damage = computed(() => props.instance.counters.damage || 0);
const hp = computed(() => props.instance.counters.hp);
const level = computed(() => props.instance.counters.level);
const resistance = computed(() => props.instance.counters.resistance);
/** Force EFFECTIVE (auras, Vrombyx, jetons) — pas le jeton forceMod brut. */
const force = computed(() => game.effectiveForceOf(props.instance.instanceId));

const label = computed(() => props.card?.name ?? "Carte");
const spine = computed(() => elementColor(props.card?.stats?.niveau?.element));

const imgSrc = computed(() => {
  if (hidden.value) return "/images/card-back.webp";
  const id = props.instance.cardId as string;
  const isHero = props.card?.mainType === "Héros";
  const base = isHero
    ? `/images/cards/${id}_${props.instance.face === "verso" ? "verso" : "recto"}.webp`
    : `/images/cards/${id}.webp`;
  return getThumbPath(base);
});

const ariaLabel = computed(() => {
  if (hidden.value) return "Carte face cachée";
  const parts = [label.value];
  if (tapped.value) parts.push("inclinée");
  if (damage.value) parts.push(`${damage.value} dommage(s)`);
  return parts.join(", ");
});
</script>

<style scoped>
.game-card {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 63 / 88;
  border-radius: 5px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.55);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.45),
    0 4px 10px rgba(0, 0, 0, 0.25);
  background: #14110e;
  transition:
    transform 0.28s cubic-bezier(0.2, 0.9, 0.3, 1.15),
    box-shadow 0.22s ease,
    opacity 0.15s ease,
    outline-color 0.15s ease;
  cursor: pointer;
}
.game-card--draggable {
  cursor: grab;
  touch-action: none;
}
.game-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.game-card__sheen {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(
    155deg,
    rgba(255, 255, 255, 0.14) 0%,
    transparent 28%,
    transparent 75%,
    rgba(0, 0, 0, 0.22) 100%
  );
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}
.game-card:hover .game-card__sheen {
  opacity: 1;
}
.game-card::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--spine, #98a1af);
  z-index: 2;
}
.game-card--tapped {
  transform: rotate(90deg) scale(0.84);
  filter: saturate(0.75) brightness(0.88);
}
.game-card--selected {
  outline: 2px solid #f0a62b;
  outline-offset: 1px;
  box-shadow:
    0 0 0 4px rgba(240, 166, 43, 0.22),
    0 6px 18px rgba(240, 166, 43, 0.3);
}
.game-card--ghost {
  opacity: 0.3;
  filter: grayscale(0.4);
}
.game-card:hover {
  transform: translateY(-3px);
  box-shadow:
    0 8px 18px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.1);
}
.game-card--tapped:hover {
  transform: rotate(90deg) scale(0.86);
}
.game-card:focus-visible {
  outline: 2px solid #f04e22;
  outline-offset: 2px;
}
.game-card__badge {
  position: absolute;
  z-index: 3;
  min-width: 22px;
  height: 22px;
  padding: 0 5px;
  display: grid;
  place-items: center;
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 13px;
  font-weight: 700;
  color: #f6f5f1;
  border-radius: 11px;
  line-height: 1;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
  animation: badge-pop 0.28s cubic-bezier(0.2, 1.4, 0.4, 1);
}
@keyframes badge-pop {
  0% {
    transform: scale(0.4);
  }
  60% {
    transform: scale(1.25);
  }
  100% {
    transform: scale(1);
  }
}
.game-card__badge--dmg {
  top: 3px;
  right: 3px;
  background: linear-gradient(180deg, #d94a36, #a72f1f);
}
.game-card__badge--hp {
  bottom: 3px;
  right: 3px;
  background: linear-gradient(180deg, #2d2b26, #16140f);
}
.game-card__badge--lvl {
  top: 3px;
  left: 6px;
  background: linear-gradient(180deg, #f7bc4e, #de9418);
  color: #1b1a17;
}
.game-card__badge--force {
  bottom: 3px;
  left: 6px;
}
.game-card__badge--force-up {
  background: linear-gradient(180deg, #6cc23a, #4a8f1f);
}
.game-card__badge--force-down {
  background: linear-gradient(180deg, #d94a36, #a72f1f);
}
.game-card__badge--res {
  bottom: 3px;
  right: 3px;
  background: linear-gradient(180deg, #4a90c2, #2c5f8f);
}
@media (prefers-reduced-motion: reduce) {
  .game-card,
  .game-card:hover {
    transition: none;
    transform: none;
  }
  .game-card--tapped,
  .game-card--tapped:hover {
    transform: rotate(90deg) scale(0.84);
  }
  .game-card__badge {
    animation: none;
  }
}
</style>
