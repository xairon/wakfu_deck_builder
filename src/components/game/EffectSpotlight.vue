<template>
  <div class="espot" aria-live="polite">
    <TransitionGroup name="espot">
      <article
        v-for="entry in store.effectSpotlight"
        :key="entry.id"
        class="espot__card"
        :class="entry.seat === store.perspective ? 'espot--mine' : 'espot--opp'"
        data-testid="effect-spotlight"
      >
        <img :src="thumb(entry.cardId)" :alt="entry.name" class="espot__img" />
        <div class="espot__body">
          <p class="espot__eyebrow">
            {{
              entry.seat === store.perspective ? "Ton effet" : "Effet adverse"
            }}
          </p>
          <h4 class="espot__name">{{ entry.name }}</h4>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <p
            class="espot__desc"
            v-html="highlightEffectHtml(entry.description)"
          ></p>
        </div>
      </article>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
/**
 * Pile d'effets flottante : chaque carte À EFFET jouée (Action résolue, Allié qui
 * arrive avec un effet d'apparition) s'empile ici quelques secondes — miniature +
 * texte d'effet mis en forme — pour que le joueur voie « ce qui se joue », y
 * compris les effets AUTO-résolus qui n'ouvrent aucun overlay. Purement lisible
 * (aucune interaction), piloté par `gameStore.effectSpotlight`.
 */
import { useGameStore } from "@/stores/gameStore";
import { getThumbPath } from "@/utils/imagePaths";
import { highlightEffectHtml } from "@/utils/effectText";

const store = useGameStore();

function thumb(cardId: string): string {
  return getThumbPath(`/images/cards/${cardId}.webp`);
}
</script>

<style scoped>
.espot {
  position: fixed;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 55;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 260px;
  max-width: 42vw;
  pointer-events: none;
}
.espot__card {
  display: flex;
  gap: 10px;
  padding: 8px;
  border-radius: 12px;
  background: rgba(20, 17, 14, 0.92);
  border: 1px solid rgba(240, 166, 43, 0.35);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}
.espot--opp {
  border-color: rgba(217, 74, 54, 0.4);
}
.espot__img {
  width: 44px;
  height: 62px;
  object-fit: cover;
  border-radius: 6px;
  flex: none;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
}
.espot__body {
  min-width: 0;
}
.espot__eyebrow {
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #f0a62b;
}
.espot--opp .espot__eyebrow {
  color: #e08a7c;
}
.espot__name {
  font-family: "Bricolage Grotesque", system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.15;
  color: #f6f5f1;
}
.espot__desc {
  margin-top: 3px;
  font-size: 11.5px;
  line-height: 1.35;
  color: rgba(246, 245, 241, 0.78);
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.espot-enter-active,
.espot-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}
.espot-enter-from {
  opacity: 0;
  transform: translateX(24px) scale(0.94);
}
.espot-leave-to {
  opacity: 0;
  transform: translateX(24px) scale(0.94);
}
@media (prefers-reduced-motion: reduce) {
  .espot-enter-active,
  .espot-leave-active {
    transition: opacity 0.2s ease;
  }
  .espot-enter-from,
  .espot-leave-to {
    transform: none;
  }
}
</style>
