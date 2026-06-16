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
    </div>
    <div class="ghud__body">
      <span class="ghud__seat">
        <span class="ghud__seat-dot"></span>
        <span class="ghud__name">{{ name }}</span>
        <span v-if="active" class="ghud__active-tag">● actif</span>
      </span>
      <div class="ghud__row">
        <div
          v-for="s in stats"
          :key="s.key"
          class="ghud__stat"
          :class="{ 'ghud__stat--big': s.big }"
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
      <div
        v-if="resourceTotal"
        class="ghud__mana"
        aria-label="Ressources disponibles par élément"
      >
        <span class="ghud__mana-label">MANA</span>
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
          {{ r.count }}
        </span>
        <span
          v-if="bonus"
          class="ghud__mana-bonus"
          title="1er tour du 2e joueur : ton Havre-Sac produit 2 Ressources (règle 2342)"
          >+1</span
        >
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
  padding: 6px 10px 6px 6px;
  border-radius: 12px;
  background: linear-gradient(
    160deg,
    rgba(255, 255, 255, 0.045),
    rgba(0, 0, 0, 0.32)
  );
  border: 1px solid rgba(246, 245, 241, 0.09);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  transition:
    border-color 0.25s ease,
    box-shadow 0.25s ease;
}
.ghud--active {
  border-color: rgba(240, 78, 34, 0.65);
  box-shadow:
    0 0 0 1px rgba(240, 78, 34, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
.ghud__avatar {
  position: relative;
  flex: 0 0 auto;
}
.ghud__portrait {
  width: 64px;
  height: 64px;
  border-radius: 10px;
  object-fit: cover;
  object-position: center 16%;
  border: 2px solid var(--accent, #98a1af);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.55);
  display: block;
}
.ghud__portrait--empty {
  background: rgba(255, 255, 255, 0.06);
}
.ghud__ring {
  position: absolute;
  inset: -5px;
  border-radius: 14px;
  border: 2px solid rgba(240, 78, 34, 0.45);
  pointer-events: none;
}
.ghud__seat {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 6px;
}
.ghud__seat-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--accent, #98a1af);
}
.ghud__name {
  font-family: Fraunces, Georgia, serif;
  font-size: 16px;
  color: #f6f5f1;
}
.ghud__active-tag {
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.08em;
  color: #f04e22;
}
.ghud__row {
  display: flex;
  gap: 11px;
  align-items: flex-end;
}
/* ── Compteur de mana (Ressources) typé par Élément ── */
.ghud__mana {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 8px;
}
.ghud__mana-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: rgba(246, 245, 241, 0.5);
  margin-right: 1px;
}
.ghud__mana-pip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 22px;
  padding: 0 7px 0 3px;
  border-radius: 999px;
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 13px;
  font-weight: 700;
  color: #f6f5f1;
  background: rgba(0, 0, 0, 0.34);
  border: 1px solid var(--el, #98a1af);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}
.ghud__mana-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.55));
}
.ghud__mana-bonus {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 11px;
  font-weight: 700;
  color: #14110d;
  background: #f0a62b;
  cursor: help;
}
.ghud__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.ghud__k {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: rgba(246, 245, 241, 0.7);
}
.ghud__v {
  font-family: "Space Mono", ui-monospace, monospace;
  font-weight: 700;
  font-size: 19px;
  line-height: 1;
  color: #f6f5f1;
}
.ghud__stat--big .ghud__v {
  font-size: 31px;
  color: #f0a62b;
  text-shadow: 0 0 18px rgba(240, 166, 43, 0.35);
}
.ghud__pm {
  display: flex;
  gap: 3px;
  margin-top: 3px;
  opacity: 0.55;
  transition: opacity 0.15s ease;
}
.ghud__stat:hover .ghud__pm,
.ghud__pm:focus-within {
  opacity: 1;
}
.ghud__btn {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  background: rgba(246, 245, 241, 0.12);
  color: #f6f5f1;
  font-size: 14px;
  line-height: 1;
  display: grid;
  place-items: center;
  transition:
    background 0.12s ease,
    transform 0.12s ease;
}
.ghud__btn:hover {
  background: #f04e22;
  transform: translateY(-1px);
}
.ghud__btn:active {
  transform: translateY(0) scale(0.94);
}
.ghud__btn:focus-visible {
  outline: 2px solid #f04e22;
  outline-offset: 1px;
}
@media (max-width: 640px) {
  .ghud__btn {
    width: 30px;
    height: 30px;
  }
  .ghud__pm {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ghud__ring {
    animation: none;
  }
}
</style>
