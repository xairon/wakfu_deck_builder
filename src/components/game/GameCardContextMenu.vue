<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="card-ctx-menu-backdrop"
      @click="close"
      @contextmenu.prevent="close"
    >
      <div
        class="card-ctx-menu"
        :style="{ top: `${adjustedY}px`, left: `${adjustedX}px` }"
        @click.stop
      >
        <div v-if="cardName" class="card-ctx-menu__header">
          <span class="card-ctx-menu__title">{{ cardName }}</span>
          <span v-if="zoneName" class="card-ctx-menu__zone">({{ zoneName }})</span>
        </div>

        <div class="card-ctx-menu__group">
          <button
            v-if="isAttached"
            type="button"
            class="card-ctx-menu__item card-ctx-menu__item--detach"
            @click="action('detach')"
          >
            <span class="card-ctx-menu__icon">🔓</span>
            <span>Détacher du Porteur</span>
          </button>

          <button
            type="button"
            class="card-ctx-menu__item"
            @click="action('toggle_tap')"
          >
            <span class="card-ctx-menu__icon">🔄</span>
            <span>{{ isTapped ? 'Redresser cette carte' : 'Incurver cette carte' }}</span>
          </button>

          <button
            v-if="hasAttachments || isAttached"
            type="button"
            class="card-ctx-menu__item"
            @click="action('tap_stack')"
          >
            <span class="card-ctx-menu__icon">🥞</span>
            <span>Incurver la pile entière</span>
          </button>

          <button
            v-if="hasAttachments || isAttached"
            type="button"
            class="card-ctx-menu__item"
            @click="action('untap_stack')"
          >
            <span class="card-ctx-menu__icon">⬆️</span>
            <span>Redresser la pile entière</span>
          </button>

          <button
            type="button"
            class="card-ctx-menu__item"
            @click="action('toggle_flip')"
          >
            <span class="card-ctx-menu__icon">👁️</span>
            <span>{{ isFaceDown ? 'Mettre face visible' : 'Mettre face cachée' }}</span>
          </button>
        </div>

        <div class="card-ctx-menu__divider"></div>

        <div class="card-ctx-menu__group">
          <div class="card-ctx-menu__label">État de Combat</div>
          <button
            type="button"
            class="card-ctx-menu__item"
            :class="{ 'card-ctx-menu__item--active': currentCombatState === 'attacking' }"
            @click="action('set_combat_attacking')"
          >
            <span class="card-ctx-menu__icon">⚔️</span>
            <span>Déclarer comme Attaquante</span>
          </button>

          <button
            type="button"
            class="card-ctx-menu__item"
            :class="{ 'card-ctx-menu__item--active': currentCombatState === 'blocking' }"
            @click="action('set_combat_blocking')"
          >
            <span class="card-ctx-menu__icon">🛡️</span>
            <span>Déclarer comme Bloquante</span>
          </button>

          <button
            v-if="currentCombatState"
            type="button"
            class="card-ctx-menu__item"
            @click="action('clear_combat_state')"
          >
            <span class="card-ctx-menu__icon">❌</span>
            <span>Retirer l'état de combat</span>
          </button>
        </div>

        <div class="card-ctx-menu__divider"></div>

        <div class="card-ctx-menu__group">
          <div class="card-ctx-menu__label">Marqueurs Dégâts</div>
          <div class="card-ctx-menu__counter-row">
            <button
              type="button"
              class="card-ctx-menu__counter-btn"
              @click="action('dmg_minus')"
            >
              -1
            </button>
            <span class="card-ctx-menu__counter-val">{{ currentDamage }}</span>
            <button
              type="button"
              class="card-ctx-menu__counter-btn"
              @click="action('dmg_plus')"
            >
              +1
            </button>
            <button
              v-if="currentDamage > 0"
              type="button"
              class="card-ctx-menu__counter-btn card-ctx-menu__counter-btn--reset"
              title="Réinitialiser"
              @click="action('dmg_reset')"
            >
              Reset
            </button>
          </div>
        </div>

        <div class="card-ctx-menu__divider"></div>

        <div class="card-ctx-menu__group">
          <div class="card-ctx-menu__label">Déplacer vers</div>

          <button
            type="button"
            class="card-ctx-menu__item"
            @click="action('move_to_hand')"
          >
            <span class="card-ctx-menu__icon">✋</span>
            <span>En Main</span>
          </button>

          <button
            type="button"
            class="card-ctx-menu__item"
            @click="action('move_to_board')"
          >
            <span class="card-ctx-menu__icon">⚔️</span>
            <span>Sur le Terrain (Monde)</span>
          </button>

          <button
            type="button"
            class="card-ctx-menu__item"
            @click="action('move_to_discard')"
          >
            <span class="card-ctx-menu__icon">🪦</span>
            <span>Cimetière (Défausse)</span>
          </button>

          <button
            type="button"
            class="card-ctx-menu__item"
            @click="action('move_to_exile')"
          >
            <span class="card-ctx-menu__icon">🌀</span>
            <span>Banni (Exile)</span>
          </button>

          <button
            type="button"
            class="card-ctx-menu__item"
            @click="action('move_to_deck_top')"
          >
            <span class="card-ctx-menu__icon">🔝</span>
            <span>Dessus du Sac (Deck)</span>
          </button>

          <button
            type="button"
            class="card-ctx-menu__item"
            @click="action('move_to_deck_bottom')"
          >
            <span class="card-ctx-menu__icon">📥</span>
            <span>Dessous du Sac (Deck)</span>
          </button>
        </div>

        <div class="card-ctx-menu__divider"></div>

        <div class="card-ctx-menu__group">
          <button
            type="button"
            class="card-ctx-menu__item"
            @click="action('zoom')"
          >
            <span class="card-ctx-menu__icon">🔍</span>
            <span>Inspecter / Agrandir</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { RedactedInstance } from "@/game";
import type { Card } from "@/types/cards";

const props = defineProps<{
  visible: boolean;
  x: number;
  y: number;
  instance: RedactedInstance | null;
  card: Card | null;
  isAttached?: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "action", act: string, instanceId?: string): void;
}>();

const cardName = computed(() => {
  if (!props.instance) return "";
  if (props.card) return props.card.name;
  return `Carte #${props.instance.instanceId.slice(0, 6)}`;
});

const zoneName = computed(() => {
  if (!props.instance) return "";
  return props.instance.owner;
});

const isTapped = computed(() => props.instance?.orientation === "tapped");
const isFaceDown = computed(() => props.instance?.face === "hidden");
const currentDamage = computed(() => props.instance?.counters.damage || 0);
const hasAttachments = computed(
  () => (props.instance?.attachments?.length ?? 0) > 0,
);
const currentCombatState = computed(
  () => props.instance?.counters.combatState,
);

// Évite que le menu ne sorte de la fenêtre
const adjustedX = computed(() => {
  const menuWidth = 220;
  if (props.x + menuWidth > window.innerWidth) {
    return Math.max(10, window.innerWidth - menuWidth - 10);
  }
  return props.x;
});

const adjustedY = computed(() => {
  const menuHeight = 400;
  if (props.y + menuHeight > window.innerHeight) {
    return Math.max(10, window.innerHeight - menuHeight - 10);
  }
  return props.y;
});

function close(): void {
  emit("close");
}

function action(act: string): void {
  if (props.instance) {
    emit("action", act, props.instance.instanceId);
  }
  close();
}
</script>

<style scoped>
.card-ctx-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: transparent;
}

.card-ctx-menu {
  position: fixed;
  width: 220px;
  background: rgba(18, 22, 34, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8), 0 0 15px rgba(255, 215, 0, 0.15);
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

.card-ctx-menu__header {
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  margin-bottom: 6px;
}

.card-ctx-menu__title {
  display: block;
  font-weight: 700;
  color: #ffd700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-ctx-menu__zone {
  font-size: 0.75rem;
  color: #94a3b8;
}

.card-ctx-menu__group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.card-ctx-menu__label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
  padding: 4px 8px 2px;
}

.card-ctx-menu__item {
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
  transition: background 0.15s, color 0.15s;
}

.card-ctx-menu__item:hover {
  background: rgba(255, 215, 0, 0.15);
  color: #ffffff;
}

.card-ctx-menu__item--detach {
  color: #f59e0b;
  font-weight: 700;
}

.card-ctx-menu__item--detach:hover {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.card-ctx-menu__icon {
  font-size: 1rem;
}

.card-ctx-menu__divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 6px 0;
}

.card-ctx-menu__counter-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
}

.card-ctx-menu__counter-btn {
  padding: 3px 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}

.card-ctx-menu__counter-btn:hover {
  background: rgba(255, 215, 0, 0.3);
  border-color: #ffd700;
}

.card-ctx-menu__counter-btn--reset {
  font-size: 0.75rem;
  font-weight: 400;
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
}

.card-ctx-menu__counter-btn--reset:hover {
  background: rgba(239, 68, 68, 0.5);
}

.card-ctx-menu__counter-val {
  font-weight: 800;
  color: #ef4444;
  min-width: 20px;
  text-align: center;
}
</style>
