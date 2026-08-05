<template>
  <Teleport to="body">
    <div v-if="open" class="search-deck-backdrop" @click="close">
      <div class="search-deck-modal" @click.stop>
        <div class="search-deck-modal__header">
          <h3>🔍 Sac de Deck ({{ deckCards.length }} cartes restantes)</h3>
          <button type="button" class="search-deck-modal__close" @click="close">
            ✕
          </button>
        </div>

        <div class="search-deck-modal__filter">
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Filtrer par nom de carte..."
            class="search-deck-modal__input"
          />
        </div>

        <div class="search-deck-modal__grid">
          <div
            v-for="item in filteredCards"
            :key="item.instanceId"
            class="search-deck-card"
          >
            <img
              :src="getThumb(item.card)"
              :alt="item.card?.name || 'Carte du sac'"
              class="search-deck-card__img"
            />
            <div class="search-deck-card__info">
              <span class="search-deck-card__name">{{ item.card?.name || 'Carte Inconnue' }}</span>
              <span class="search-deck-card__type">{{ item.card?.mainType || '' }}</span>
            </div>
            <div class="search-deck-card__actions">
              <button
                type="button"
                class="search-deck-btn"
                title="Mettre dans la main"
                @click="takeTo(item.instanceId, 'hand')"
              >
                ✋ En Main
              </button>
              <button
                type="button"
                class="search-deck-btn"
                title="Placer sur le terrain"
                @click="takeTo(item.instanceId, 'board')"
              >
                ⚔️ Sur le Terrain
              </button>
              <button
                type="button"
                class="search-deck-btn search-deck-btn--discard"
                title="Défausser au cimetière"
                @click="takeTo(item.instanceId, 'discard')"
              >
                🪦 Cimetière
              </button>
              <button
                type="button"
                class="search-deck-btn"
                title="Placer au dessus du sac"
                @click="takeTo(item.instanceId, 'deck_top')"
              >
                🔝 Dessus Sac
              </button>
              <button
                type="button"
                class="search-deck-btn"
                title="Placer au dessous du sac"
                @click="takeTo(item.instanceId, 'deck_bottom')"
              >
                📥 Dessous Sac
              </button>
            </div>
          </div>

          <div v-if="filteredCards.length === 0" class="search-deck-modal__empty">
            Aucune carte ne correspond à la recherche.
          </div>
        </div>

        <div class="search-deck-modal__footer">
          <button
            type="button"
            class="search-deck-footer-btn search-deck-footer-btn--shuffle"
            @click="shuffle"
          >
            🔀 Mélanger le Sac
          </button>
          <button
            type="button"
            class="search-deck-footer-btn"
            @click="close"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import type { CardInstance } from "@/game";
import type { Card } from "@/types/cards";
import { getThumbPath } from "@/utils/imagePaths";
import { useCardStore } from "@/stores/cardStore";

const props = defineProps<{
  open: boolean;
  deckInstances: CardInstance[];
  resolveCard: (cardId: string | null) => Card | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "move-card", instanceId: string, targetZone: "hand" | "board" | "discard" | "deck_top" | "deck_bottom"): void;
  (e: "shuffle"): void;
}>();

const cardStore = useCardStore();

const searchQuery = ref("");

const deckCards = computed(() => {
  return props.deckInstances.map((inst) => {
    // inst est omniscient : cardId est toujours présent
    let card = props.resolveCard(inst.cardId);
    if (!card && inst.cardId) {
      card = cardStore.cards.find((c) => c.id === inst.cardId) ?? null;
    }
    return {
      instanceId: inst.instanceId,
      card,
    };
  });
});

const filteredCards = computed(() => {
  if (!searchQuery.value.trim()) return deckCards.value;
  const q = searchQuery.value.toLowerCase().trim();
  return deckCards.value.filter((item) =>
    item.card?.name.toLowerCase().includes(q),
  );
});

function getThumb(card: Card | null): string {
  if (!card) return getThumbPath("/images/card-back.webp");
  const path = card.mainType === "Héros" ? `/images/cards/${card.id}_recto.webp` : `/images/cards/${card.id}.webp`;
  return getThumbPath(path);
}

function close(): void {
  emit("close");
}

function takeTo(
  instanceId: string,
  targetZone: "hand" | "board" | "discard" | "deck_top" | "deck_bottom",
): void {
  emit("move-card", instanceId, targetZone);
}

function shuffle(): void {
  emit("shuffle");
}
</script>

<style scoped>
.search-deck-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-deck-modal {
  width: 90%;
  max-width: 800px;
  max-height: 85vh;
  background: #111827;
  border: 1px solid #374151;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.search-deck-modal__header {
  padding: 16px 20px;
  border-bottom: 1px solid #1f2937;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #f3f4f6;
}

.search-deck-modal__header h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: #fbbf24;
}

.search-deck-modal__close {
  background: transparent;
  border: none;
  color: #9ca3af;
  font-size: 1.2rem;
  cursor: pointer;
}

.search-deck-modal__close:hover {
  color: #ffffff;
}

.search-deck-modal__filter {
  padding: 12px 20px;
  background: #1f2937;
}

.search-deck-modal__input {
  width: 100%;
  padding: 8px 14px;
  background: #111827;
  border: 1px solid #374151;
  border-radius: 6px;
  color: #f3f4f6;
  font-size: 0.9rem;
}

.search-deck-modal__grid {
  padding: 20px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  max-height: 55vh;
}

.search-deck-card {
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.search-deck-card__img {
  width: 90px;
  height: 126px;
  object-fit: cover;
  border-radius: 4px;
}

.search-deck-card__info {
  text-align: center;
}

.search-deck-card__name {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: #f9fafb;
}

.search-deck-card__type {
  display: block;
  font-size: 0.75rem;
  color: #9ca3af;
}

.search-deck-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
  width: 100%;
}

.search-deck-btn {
  padding: 4px 8px;
  font-size: 0.72rem;
  font-weight: 600;
  border-radius: 4px;
  border: 1px solid #4b5563;
  background: #374151;
  color: #f3f4f6;
  cursor: pointer;
  transition: all 0.15s ease;
}

.search-deck-btn:hover {
  background: #4b5563;
  border-color: #fbbf24;
  color: #fbbf24;
}

.search-deck-btn--discard {
  border-color: #7f1d1d;
  background: #991b1b;
  color: #fef2f2;
}

.search-deck-btn--discard:hover {
  background: #dc2626;
  border-color: #f87171;
  color: #ffffff;
}

.search-deck-modal__empty {
  grid-column: 1 / -1;
  text-align: center;
  color: #9ca3af;
  padding: 20px;
}

.search-deck-modal__footer {
  padding: 12px 20px;
  border-top: 1px solid #1f2937;
  display: flex;
  justify-content: space-between;
}

.search-deck-footer-btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid #374151;
  background: #1f2937;
  color: #f3f4f6;
  cursor: pointer;
}

.search-deck-footer-btn:hover {
  background: #374151;
}

.search-deck-footer-btn--shuffle {
  background: #d97706;
  border-color: #b45309;
  color: #fff;
  font-weight: 600;
}

.search-deck-footer-btn--shuffle:hover {
  background: #f59e0b;
}
</style>
