<template>
  <Teleport to="body">
    <div v-if="open" class="gtuto-backdrop" @click="close">
      <div class="gtuto-modal" @click.stop>
        <div class="gtuto-modal__header">
          <h3>
            🔍 Tutoriser le Deck
            <span class="gtuto-modal__count">({{ deckCards.length }} cartes restantes)</span>
          </h3>
          <button type="button" class="gtuto-modal__close" title="Fermer" @click="close">
            ✕
          </button>
        </div>

        <div class="gtuto-modal__filter">
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Rechercher une carte par son nom..."
            class="gtuto-modal__input"
          />
        </div>

        <div class="gtuto-modal__grid">
          <div
            v-for="(item, idx) in filteredCards"
            :key="item.instanceId"
            class="gtuto-card"
            :class="{ 'gtuto-card--selected': selectedInstanceId === item.instanceId }"
            @click="selectCard(item.instanceId)"
          >
            <div class="gtuto-card__pos">
              Position #{{ idx + 1 }} {{ idx === 0 ? '· (Sommet)' : idx === filteredCards.length - 1 ? '· (Fond)' : '' }}
            </div>
            <div class="gtuto-card__img-wrapper">

              <img
                :src="item.imgSrc"
                :alt="item.name"
                class="gtuto-card__img"
                @error="onImgError($event)"
              />
              <span v-if="item.level" class="gtuto-card__badge">
                Niv. {{ item.level }}
              </span>
            </div>

            <div class="gtuto-card__info">
              <span class="gtuto-card__name" :title="item.name">{{ item.name }}</span>
              <span v-if="item.mainType" class="gtuto-card__type">
                {{ item.mainType }} {{ item.subTypes ? `• ${item.subTypes}` : '' }}
              </span>
            </div>

            <div class="gtuto-card__actions" @click.stop>
              <button
                type="button"
                class="gbtn gbtn--accent"
                title="Déplacer sur le terrain (Monde)"
                @click="takeTo(item.instanceId, 'board')"
              >
                → Monde
              </button>
              <button
                type="button"
                class="gbtn gbtn--accent"
                title="Ajouter à ta main"
                @click="takeTo(item.instanceId, 'hand')"
              >
                → Main
              </button>
              <button
                type="button"
                class="gbtn gbtn--discard"
                title="Défausser au Cimetière"
                @click="takeTo(item.instanceId, 'discard')"
              >
                Défausser
              </button>
              <button
                type="button"
                class="gbtn gbtn--banish"
                title="Bannir (Exil)"
                @click="takeTo(item.instanceId, 'exile')"
              >
                🚫 Bannir
              </button>
              <button
                type="button"
                class="gbtn"
                title="Placer au dessus du Deck"
                @click="takeTo(item.instanceId, 'deck_top')"
              >
                ↑ Pioche
              </button>
              <button
                type="button"
                class="gbtn"
                title="Placer en dessous du Deck"
                @click="takeTo(item.instanceId, 'deck_bottom')"
              >
                ↓ Pioche
              </button>
            </div>
          </div>

          <div v-if="filteredCards.length === 0" class="gtuto-modal__empty">
            {{ searchQuery.trim() ? "Aucune carte ne correspond à la recherche." : "Aucune carte restante dans le deck." }}
          </div>
        </div>

        <div class="gtuto-modal__footer">
          <button
            type="button"
            class="gbtn gbtn--accent"
            @click="shuffle"
          >
            🔀 Mélanger le Deck
          </button>
          <button
            type="button"
            class="gbtn gbtn--ghost"
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
import { ref, computed, onMounted } from "vue";
import type { CardInstance } from "@/game";
import type { Card } from "@/types/cards";
import { getThumbPath } from "@/utils/imagePaths";
import { useCardStore } from "@/stores/cardStore";

const props = defineProps<{
  open: boolean;
  deckInstances: CardInstance[];
  resolveCard: (cardIdOrInstId: string | null) => Card | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "move-card", instanceId: string, targetZone: "hand" | "board" | "discard" | "exile" | "deck_top" | "deck_bottom"): void;
  (e: "shuffle"): void;
}>();

const cardStore = useCardStore();
const searchQuery = ref("");
const selectedInstanceId = ref<string | null>(null);

onMounted(() => {
  if (!cardStore.cards.length) {
    void cardStore.initialize().catch(() => {});
  }
});


function cardLevel(card: Card | null): number | null {
  if (!card) return null;
  return "level" in card && typeof card.level === "number" ? card.level : null;
}

const deckCards = computed(() => {
  return props.deckInstances.map((inst) => {
    let card = props.resolveCard(inst.instanceId);
    if (!card && inst.cardId) {
      card = props.resolveCard(inst.cardId);
    }
    if (!card && inst.cardId) {
      const rawId = String(inst.cardId);
      card = cardStore.cards.find(
        (c) => String(c.id) === rawId || String((c as any).code) === rawId,
      ) ?? null;
    }

    const rawId = card?.id ?? inst.cardId ?? null;

    let imgSrc = getThumbPath("/images/card-back.webp");
    if (card) {
      const isHero = card.mainType === "Héros";
      const path = isHero ? `/images/cards/${card.id}_recto.webp` : `/images/cards/${card.id}.webp`;
      imgSrc = getThumbPath(path);
    } else if (rawId) {
      imgSrc = getThumbPath(`/images/cards/${rawId}.webp`);
    }

    const name = card?.name || (rawId ? String(rawId) : "Carte Inconnue");
    const mainType = card?.mainType || "";
    const subTypes = card?.subTypes?.length ? card.subTypes.join(", ") : "";
    const level = cardLevel(card);

    return {
      instanceId: inst.instanceId,
      cardId: rawId,
      card,
      name,
      mainType,
      subTypes,
      level,
      imgSrc,
    };
  });
});

const filteredCards = computed(() => {
  if (!searchQuery.value.trim()) return deckCards.value;
  const q = searchQuery.value.toLowerCase().trim();
  return deckCards.value.filter((item) =>
    item.name.toLowerCase().includes(q) || item.mainType.toLowerCase().includes(q),
  );
});

function selectCard(instanceId: string): void {
  selectedInstanceId.value = selectedInstanceId.value === instanceId ? null : instanceId;
}

function close(): void {
  selectedInstanceId.value = null;
  emit("close");
}

function takeTo(
  instanceId: string,
  targetZone: "hand" | "board" | "discard" | "exile" | "deck_top" | "deck_bottom",
): void {
  if (selectedInstanceId.value === instanceId) {
    selectedInstanceId.value = null;
  }
  emit("move-card", instanceId, targetZone);
}

function shuffle(): void {
  emit("shuffle");
}

function onImgError(event: Event): void {
  const target = event.target as HTMLImageElement;
  if (target && !target.dataset.failed) {
    target.dataset.failed = "true";
    target.src = getThumbPath("/images/card-back.webp");
  }
}
</script>

<style scoped>
.gtuto-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(10, 8, 6, 0.82);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: gtuto-fade-in 0.2s ease-out;
}

@keyframes gtuto-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.gtuto-modal {
  width: min(960px, 95vw);
  max-height: 88vh;
  background: linear-gradient(180deg, #241d16 0%, #1a1510 100%);
  border: 1px solid rgba(246, 245, 241, 0.18);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8), 0 0 25px rgba(240, 78, 34, 0.15);
  overflow: hidden;
}

.gtuto-modal__header {
  padding: 14px 20px;
  background: rgba(26, 21, 16, 0.9);
  border-bottom: 1px solid rgba(246, 245, 241, 0.12);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.gtuto-modal__header h3 {
  margin: 0;
  font-family: Fraunces, Georgia, serif;
  font-size: 1.25rem;
  font-weight: 700;
  color: #f6f5f1;
  display: flex;
  align-items: center;
  gap: 10px;
}

.gtuto-modal__count {
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 0.82rem;
  color: rgba(246, 245, 241, 0.65);
}

.gtuto-modal__close {
  background: rgba(246, 245, 241, 0.08);
  border: 1px solid rgba(246, 245, 241, 0.16);
  border-radius: 999px;
  color: #f6f5f1;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.gtuto-modal__close:hover {
  background: rgba(240, 78, 34, 0.35);
  border-color: #f04e22;
  color: #ffffff;
}

.gtuto-modal__filter {
  padding: 10px 20px;
  background: rgba(10, 8, 6, 0.4);
  border-bottom: 1px solid rgba(246, 245, 241, 0.08);
}

.gtuto-modal__input {
  width: 100%;
  padding: 8px 14px;
  background: rgba(10, 8, 6, 0.6);
  border: 1px solid rgba(246, 245, 241, 0.2);
  border-radius: 8px;
  color: #f6f5f1;
  font-size: 0.9rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.gtuto-modal__input:focus {
  outline: none;
  border-color: #f04e22;
  box-shadow: 0 0 10px rgba(240, 78, 34, 0.3);
}

.gtuto-modal__grid {
  padding: 20px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  max-height: 60vh;
}

.gtuto-card {
  background: rgba(246, 245, 241, 0.05);
  border: 1px solid rgba(246, 245, 241, 0.12);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.gtuto-card__pos {
  font-family: "Space Mono", ui-monospace, monospace;
  font-size: 11px;
  font-weight: 700;
  color: #fbbf24;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(251, 191, 36, 0.3);
  padding: 2px 8px;
  border-radius: 6px;
  width: 100%;
  text-align: center;
}

.gtuto-card:hover {

  transform: translateY(-2px);
  border-color: rgba(240, 78, 34, 0.5);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5);
}

.gtuto-card--selected {
  border-color: #f04e22 !important;
  box-shadow: 0 0 20px rgba(240, 78, 34, 0.5) !important;
  background: rgba(240, 78, 34, 0.08);
}

.gtuto-card__img-wrapper {
  position: relative;
  width: 90px;
  height: 126px;
}

.gtuto-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.6);
}

.gtuto-card__badge {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(10, 8, 6, 0.85);
  border: 1px solid #f04e22;
  color: #f04e22;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 5px;
  border-radius: 4px;
}

.gtuto-card__info {
  text-align: center;
  width: 100%;
}

.gtuto-card__name {
  display: block;
  font-size: 0.88rem;
  font-weight: 700;
  color: #f6f5f1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gtuto-card__type {
  display: block;
  font-size: 0.72rem;
  color: rgba(246, 245, 241, 0.6);
  margin-top: 2px;
}

.gtuto-card__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
  width: 100%;
  margin-top: 4px;
}

.gbtn {
  font-size: 11px;
  font-weight: 600;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(246, 245, 241, 0.1);
  color: #f6f5f1;
  border: none;
  cursor: pointer;
  text-align: center;
  transition: background 0.15s ease, transform 0.15s ease;
}

.gbtn:hover {
  background: rgba(246, 245, 241, 0.22);
  transform: translateY(-1px);
}

.gbtn--accent {
  background: rgba(240, 78, 34, 0.32);
  color: #f6f5f1;
}

.gbtn--accent:hover {
  background: #f04e22;
  color: #ffffff;
}

.gbtn--discard {
  background: rgba(220, 38, 38, 0.32);
  color: #fca5a5;
}

.gbtn--discard:hover {
  background: #dc2626;
  color: #ffffff;
}

.gbtn--banish {
  background: rgba(147, 51, 234, 0.32);
  color: #e9d5ff;
}

.gbtn--banish:hover {
  background: #9333ea;
  color: #ffffff;
}

.gbtn--ghost {
  background: transparent;
  outline: 1px solid rgba(246, 245, 241, 0.25);
  color: #f6f5f1;
}

.gbtn--ghost:hover {
  background: rgba(246, 245, 241, 0.15);
}

.gtuto-modal__empty {
  grid-column: 1 / -1;
  text-align: center;
  color: rgba(246, 245, 241, 0.6);
  padding: 30px 20px;
  font-size: 0.95rem;
}

.gtuto-modal__footer {
  padding: 14px 20px;
  background: rgba(26, 21, 16, 0.9);
  border-top: 1px solid rgba(246, 245, 241, 0.12);
  display: flex;
  justify-content: space-between;
}
</style>
