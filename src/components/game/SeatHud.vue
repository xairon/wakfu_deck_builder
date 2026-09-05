<template>
  <div
    class="ghud"
    :class="{ 'ghud--active': active }"
    :style="{ '--accent': accent }"
  >
    <div class="ghud__avatar">
      <img
        v-if="portrait"
        class="ghud__portrait"
        :src="portrait"
        :alt="heroName ?? ''"
      />
      <div v-else class="ghud__portrait ghud__portrait--empty"></div>
      <span v-if="active" class="ghud__ring" aria-hidden="true"></span>
      <span v-if="counters.level" class="ghud__level-badge" title="Niveau du héros">
        N{{ counters.level }}
      </span>
    </div>
    <div class="ghud__body">
      <div class="ghud__header">
        <div class="ghud__seat">
          <span class="ghud__seat-dot"></span>
          <span class="ghud__name">{{ name }}</span>
          <span v-if="heroName" class="ghud__hero-sub">· {{ heroName }}</span>
        </div>
        <span v-if="active" class="ghud__active-tag">
          <span class="ghud__active-pulse"></span>
          actif
        </span>
      </div>

      <div class="ghud__content">
        <!-- Rangée des stats clés : PV mis en valeur + PA/PM/XP/NIV épurés -->
        <div class="ghud__row">
          <div
            v-for="s in stats"
            :key="s.key"
            class="ghud__stat"
            :class="{ 'ghud__stat--big': s.big, [`ghud__stat--${s.key}`]: true }"
          >
            <span class="ghud__k">{{ s.label }}</span>
            <span class="ghud__v">{{ s.value ?? "—" }}</span>
            <span class="ghud__pm">
              <button
                class="ghud__btn"
                :aria-label="`+ ${s.label}`"
                @click="emit('bump', s.key, 1)"
              >
                +
              </button>
              <button
                class="ghud__btn"
                :aria-label="`− ${s.label}`"
                @click="emit('bump', s.key, -1)"
              >
                −
              </button>
            </span>
          </div>
        </div>

        <!-- Mana disponible (Ressources élémentaires) -->
        <div
          v-if="resourceTotal"
          class="ghud__mana"
          aria-label="Ressources disponibles par élément"
        >
          <span class="ghud__mana-label">MANA</span>
          <div class="ghud__mana-pips">
            <span
              v-for="r in resourceList"
              :key="r.element"
              class="ghud__mana-pip"
              :style="{ '--el': r.color }"
              :title="`${r.count} Ressource(s) ${r.element}`"
            >
              <img
                class="ghud__mana-icon"
                :src="`/images/elements/ressource-${r.key}.png`"
                :alt="r.element"
                draggable="false"
              />
              <span class="ghud__mana-val">{{ r.count }}</span>
            </span>
            <span
              v-if="bonus"
              class="ghud__mana-bonus"
              title="1er tour du 2e joueur : ton Havre-Sac produit 2 Ressources (règle 2342)"
            >
              +1 SAC
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { CardCounters } from "@/game";
import { elementColor } from "@/config/elementColors";

const props = defineProps<{
  name: string;
  active?: boolean;
  portrait?: string | null;
  heroName?: string | null;
  accent: string;
  counters: CardCounters;
  /** « Mana » disponible par Élément (producteurs redressés). */
  resources?: Record<string, number>;
  /** Bonus du 2e joueur à son 1er tour : Havre-Sac ×2 (règle 2342). */
  bonus?: boolean;
}>();
const emit = defineEmits<{
  (e: "bump", counter: string, delta: number): void;
}>();

const stats = computed(() => [
  { key: "hp", label: "PV", value: props.counters.hp, big: true },
  { key: "pa", label: "PA", value: props.counters.pa, big: false },
  { key: "pm", label: "PM", value: props.counters.pm, big: false },
  { key: "xp", label: "XP", value: props.counters.xp, big: false },
  { key: "level", label: "NIV", value: props.counters.level, big: false },
]);

const ELEMENT_ORDER = ["feu", "eau", "terre", "air", "neutre"];
/** Pastilles de mana, une par Élément disponible (count > 0), avec l'icône Ressource. */
const resourceList = computed(() =>
  Object.entries(props.resources ?? {})
    .filter(([, n]) => n > 0)
    .map(([element, count]) => ({
      element,
      count,
      key: element.toLowerCase(),
      color: elementColor(element),
    }))
    .sort(
      (a, b) => ELEMENT_ORDER.indexOf(a.key) - ELEMENT_ORDER.indexOf(b.key),
    ),
);
const resourceTotal = computed(() =>
  resourceList.value.reduce((s, r) => s + r.count, 0),
);
</script>

<style scoped>
.ghud {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px 6px 8px;
  border-radius: 12px;
  background: linear-gradient(
    135deg,
    rgba(28, 22, 17, 0.92) 0%,
    rgba(16, 12, 9, 0.96) 100%
  );
  border: 1px solid rgba(240, 166, 43, 0.22);
  box-shadow:
    0 6px 20px rgba(0, 0, 0, 0.65),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition:
    border-color 0.25s ease,
    box-shadow 0.25s ease;
}

.ghud--active {
  border-color: rgba(240, 166, 43, 0.7);
  box-shadow:
    0 0 20px rgba(240, 166, 43, 0.28),
    inset 0 0 14px rgba(240, 166, 43, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

.ghud__avatar {
  position: relative;
  flex: 0 0 auto;
}

.ghud__portrait {
  width: 54px;
  height: 54px;
  border-radius: 10px;
  object-fit: cover;
  object-position: center 16%;
  border: 2px solid var(--accent, #f0a62b);
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.7);
  display: block;
}

.ghud__portrait--empty {
  background: rgba(255, 255, 255, 0.06);
}

.ghud__ring {
  position: absolute;
  inset: -4px;
  border-radius: 14px;
  border: 2px solid rgba(240, 166, 43, 0.7);
  box-shadow: 0 0 10px rgba(240, 166, 43, 0.4);
  animation: ghud-pulse 2s ease-in-out infinite;
  pointer-events: none;
}

.ghud__level-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
  padding: 2px 5px;
  border-radius: 6px;
  background: linear-gradient(135deg, #f0a62b, #d97706);
  color: #1a1309;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
}

@keyframes ghud-pulse {
  0%,
  100% {
    opacity: 0.85;
    transform: scale(1);
  }
  50% {
    opacity: 0.25;
    transform: scale(1.05);
  }
}

.ghud__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.ghud__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ghud__seat {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.ghud__seat-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent, #f0a62b);
  box-shadow: 0 0 6px var(--accent, #f0a62b);
  flex: 0 0 auto;
}

.ghud__name {
  font-family: Fraunces, Georgia, serif;
  font-size: 14px;
  font-weight: 600;
  color: #f6f5f1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ghud__hero-sub {
  font-size: 11px;
  color: rgba(246, 245, 241, 0.55);
  white-space: nowrap;
}

.ghud__active-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #f0a62b;
  background: rgba(240, 166, 43, 0.15);
  border: 1px solid rgba(240, 166, 43, 0.35);
  border-radius: 999px;
  padding: 1px 6px;
}

.ghud__active-pulse {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #f0a62b;
  box-shadow: 0 0 6px #f0a62b;
  animation: ghud-dot-pulse 1.2s ease-in-out infinite alternate;
}

@keyframes ghud-dot-pulse {
  from {
    transform: scale(0.8);
    opacity: 0.6;
  }
  to {
    transform: scale(1.3);
    opacity: 1;
  }
}

.ghud__content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ghud__row {
  display: flex;
  align-items: center;
  gap: 5px;
}

.ghud__stat {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: all 0.18s ease;
}

.ghud__stat:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.15);
}

.ghud__k {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: rgba(246, 245, 241, 0.6);
}

.ghud__v {
  font-family: "Space Mono", ui-monospace, monospace;
  font-weight: 700;
  font-size: 14px;
  line-height: 1;
  color: #f6f5f1;
}

/* Stat PV : mise en valeur majeure comme total de points de vie */
.ghud__stat--big {
  background: linear-gradient(135deg, rgba(220, 38, 38, 0.28), rgba(153, 27, 27, 0.15));
  border: 1px solid rgba(239, 68, 68, 0.45);
  box-shadow: 0 2px 8px rgba(220, 38, 38, 0.2);
  padding: 3px 8px;
}

.ghud__stat--big .ghud__k {
  color: #fca5a5;
  font-size: 10px;
}

.ghud__stat--big .ghud__v {
  font-size: 20px;
  color: #fee2e2;
  text-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
}

/* Micro-steppers +/- : discrets et élégants */
.ghud__pm {
  display: inline-flex;
  gap: 1px;
  margin-left: 2px;
  opacity: 0.35;
  transition: opacity 0.15s ease;
}

.ghud__stat:hover .ghud__pm,
.ghud__pm:focus-within {
  opacity: 1;
}

.ghud__btn {
  width: 15px;
  height: 15px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.12);
  color: #f6f5f1;
  font-size: 11px;
  line-height: 1;
  display: grid;
  place-items: center;
  transition:
    background 0.12s ease,
    transform 0.12s ease;
}

.ghud__btn:hover {
  background: #f0a62b;
  color: #18120a;
  transform: scale(1.1);
}

.ghud__stat--big .ghud__btn:hover {
  background: #ef4444;
  color: #fff;
}

.ghud__btn:active {
  transform: scale(0.92);
}

.ghud__btn:focus-visible {
  outline: 2px solid #f0a62b;
  outline-offset: 1px;
}

/* Mana disponibles (Ressources élémentaires) */
.ghud__mana {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 1px;
}

.ghud__mana-label {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: rgba(246, 245, 241, 0.45);
}

.ghud__mana-pips {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.ghud__mana-pip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 19px;
  padding: 0 6px 0 3px;
  border-radius: 999px;
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 11px;
  font-weight: 700;
  color: #f6f5f1;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid var(--el, #f0a62b);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

.ghud__mana-icon {
  width: 13px;
  height: 13px;
  object-fit: contain;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.55));
}

.ghud__mana-bonus {
  display: inline-flex;
  align-items: center;
  height: 17px;
  padding: 0 5px;
  border-radius: 999px;
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 9px;
  font-weight: 700;
  color: #14110d;
  background: #f0a62b;
  box-shadow: 0 0 6px rgba(240, 166, 43, 0.4);
  cursor: help;
}

@media (max-width: 767px) {
  .ghud__row {
    flex-wrap: wrap;
    gap: 4px 6px;
  }
}

@media (max-width: 640px) {
  .ghud__btn {
    width: 22px;
    height: 22px;
  }
  .ghud__pm {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ghud__ring,
  .ghud__active-pulse {
    animation: none;
  }
}
</style>
