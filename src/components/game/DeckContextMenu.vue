<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="deck-ctx-menu-backdrop"
      @click="close"
      @contextmenu.prevent="close"
    >
      <div
        class="deck-ctx-menu"
        :style="{ top: `${adjustedY}px`, left: `${adjustedX}px` }"
        @click.stop
      >
        <div class="deck-ctx-menu__header">
          <span class="deck-ctx-menu__title">🎴 Sac de Deck</span>
          <span class="deck-ctx-menu__count">({{ count }} cartes)</span>
        </div>

        <div class="deck-ctx-menu__group">
          <button
            type="button"
            class="deck-ctx-menu__item deck-ctx-menu__item--highlight"
            @click="action('search')"
          >
            <span class="deck-ctx-menu__icon">🔍</span>
            <span>Tutoriser / Regarder le Sac</span>
          </button>

          <button
            type="button"
            class="deck-ctx-menu__item"
            @click="action('shuffle')"
          >
            <span class="deck-ctx-menu__icon">🔀</span>
            <span>Mélanger le Sac</span>
          </button>
        </div>

        <div class="deck-ctx-menu__divider"></div>

        <div class="deck-ctx-menu__group">
          <div class="deck-ctx-menu__label">Piocher des cartes</div>

          <button
            type="button"
            class="deck-ctx-menu__item"
            @click="action('draw_1')"
          >
            <span class="deck-ctx-menu__icon">🎴</span>
            <span>Piocher 1 carte</span>
          </button>

          <button
            type="button"
            class="deck-ctx-menu__item"
            @click="action('draw_3')"
          >
            <span class="deck-ctx-menu__icon">🎴</span>
            <span>Piocher 3 cartes</span>
          </button>

          <button
            type="button"
            class="deck-ctx-menu__item"
            @click="action('draw_5')"
          >
            <span class="deck-ctx-menu__icon">🎴</span>
            <span>Piocher 5 cartes</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  visible: boolean;
  x: number;
  y: number;
  count: number;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "action", act: string): void;
}>();

const adjustedX = computed(() => {
  const menuWidth = 220;
  if (props.x + menuWidth > window.innerWidth) {
    return Math.max(10, window.innerWidth - menuWidth - 10);
  }
  return props.x;
});

const adjustedY = computed(() => {
  const menuHeight = 260;
  if (props.y + menuHeight > window.innerHeight) {
    return Math.max(10, window.innerHeight - menuHeight - 10);
  }
  return props.y;
});

function close(): void {
  emit("close");
}

function action(act: string): void {
  emit("action", act);
  close();
}
</script>

<style scoped>
.deck-ctx-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: transparent;
}

.deck-ctx-menu {
  position: fixed;
  width: 220px;
  background: rgba(18, 22, 34, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 10px;
  box-shadow:
    0 10px 30px rgba(0, 0, 0, 0.8),
    0 0 15px rgba(255, 215, 0, 0.15);
  padding: 8px;
  color: #e2e8f0;
  font-family: inherit;
  font-size: 0.85rem;
  animation: ctx-pop 0.15s ease-out;
}

@keyframes ctx-pop {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.deck-ctx-menu__header {
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  margin-bottom: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.deck-ctx-menu__title {
  font-weight: 700;
  color: #ffd700;
}

.deck-ctx-menu__count {
  font-size: 0.75rem;
  color: #94a3b8;
}

.deck-ctx-menu__group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.deck-ctx-menu__label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
  padding: 4px 8px 2px;
}

.deck-ctx-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: none;
  background: transparent;
  color: #e2e8f0;
  font-size: 0.85rem;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  transition:
    background 0.15s,
    color 0.15s;
}

.deck-ctx-menu__item:hover {
  background: rgba(255, 215, 0, 0.15);
  color: #ffffff;
}

.deck-ctx-menu__item--highlight {
  color: #fbbf24;
  font-weight: 600;
}

.deck-ctx-menu__icon {
  font-size: 1rem;
}

.deck-ctx-menu__divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 6px 0;
}
</style>
