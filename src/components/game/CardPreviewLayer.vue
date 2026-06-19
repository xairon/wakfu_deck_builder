<template>
  <Teleport to="body">
    <Transition name="cardprev">
      <div v-if="card" class="cardprev" :style="style" aria-hidden="true">
        <img :src="img" :alt="card.name" class="cardprev__img" />
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onUnmounted } from "vue";
import { useCardPreview } from "@/composables/useCardPreview";

const { card, mouseX, mouseY, hide } = useCardPreview();

// Le calque démonté → on vide le singleton partagé pour qu'aucun aperçu ne
// reste « armé » et ne réapparaisse sur une autre page (cf. CardHoverPreview).
onUnmounted(hide);

const PREVIEW_W = 320;
const PREVIEW_H = Math.round((PREVIEW_W * 88) / 63);

const img = computed(() => {
  const c = card.value;
  if (!c) return "";
  return c.mainType === "Héros"
    ? `/images/cards/${c.id}_recto.webp`
    : `/images/cards/${c.id}.webp`;
});

const style = computed(() => {
  const pad = 16;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;
  // par défaut à droite du curseur ; bascule à gauche si ça déborde
  let left = mouseX.value + 28;
  if (left + PREVIEW_W + pad > vw) left = mouseX.value - PREVIEW_W - 28;
  left = Math.max(pad, Math.min(left, vw - PREVIEW_W - pad));
  let top = mouseY.value - PREVIEW_H / 2;
  top = Math.max(pad, Math.min(top, vh - PREVIEW_H - pad));
  return { left: `${left}px`, top: `${top}px`, width: `${PREVIEW_W}px` };
});
</script>

<style scoped>
.cardprev {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  filter: drop-shadow(0 16px 40px rgba(0, 0, 0, 0.7));
}
.cardprev__img {
  width: 100%;
  border-radius: 14px;
  display: block;
}
.cardprev-enter-active,
.cardprev-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}
.cardprev-enter-from,
.cardprev-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
</style>
