<template>
  <button
    type="button"
    class="game-card"
    :class="{ 'game-card--tapped': tapped, 'game-card--selected': selected }"
    :style="{ '--spine': spine }"
    :aria-label="ariaLabel"
    @click="emit('select')"
    @dblclick="emit('zoom')"
  >
    <img
      :src="imgSrc"
      :alt="label"
      class="game-card__img"
      loading="lazy"
      decoding="async"
      draggable="false"
    />
    <span
      v-if="damage"
      class="game-card__badge game-card__badge--dmg"
      title="Dommages"
    >
      {{ damage }}
    </span>
    <span
      v-if="hp !== undefined"
      class="game-card__badge game-card__badge--hp"
      title="PV"
    >
      {{ hp }}
    </span>
    <span
      v-if="level && level > 1"
      class="game-card__badge game-card__badge--lvl"
      title="Niveau"
    >
      N{{ level }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Card } from "@/types/cards";
import type { RedactedInstance } from "@/game";
import { getThumbPath } from "@/utils/imagePaths";
import { elementColor } from "@/config/elementColors";

const props = defineProps<{
  instance: RedactedInstance;
  card: Card | null;
  selected?: boolean;
}>();
const emit = defineEmits<{ (e: "select"): void; (e: "zoom"): void }>();

const hidden = computed(
  () => props.instance.face === "hidden" || !props.instance.cardId,
);
const tapped = computed(() => props.instance.orientation === "tapped");
const damage = computed(() => props.instance.counters.damage || 0);
const hp = computed(() => props.instance.counters.hp);
const level = computed(() => props.instance.counters.level);

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
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid rgba(27, 26, 23, 0.18);
  box-shadow: 0 1px 2px rgba(27, 26, 23, 0.18);
  background: var(--paper-300, #dfdcd2);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;
  cursor: pointer;
}
.game-card::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--spine, #98a1af);
  z-index: 2;
}
.game-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.game-card--tapped {
  transform: rotate(90deg) scale(0.84);
}
.game-card--selected {
  outline: 2px solid #f04e22;
  outline-offset: 1px;
  box-shadow: 0 4px 12px rgba(240, 78, 34, 0.35);
}
.game-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 14px rgba(27, 26, 23, 0.28);
}
.game-card--tapped:hover {
  transform: rotate(90deg) scale(0.86);
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
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}
.game-card__badge--dmg {
  top: 3px;
  right: 3px;
  background: #c0392b;
}
.game-card__badge--hp {
  bottom: 3px;
  right: 3px;
  background: #1b1a17;
}
.game-card__badge--lvl {
  top: 3px;
  left: 6px;
  background: #f0a62b;
  color: #1b1a17;
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
}
</style>
