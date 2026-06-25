<template>
  <div data-testid="deck-card-grid" :data-view="view">
    <div class="mb-4 flex items-center justify-end">
      <button
        type="button"
        class="btn btn-ghost btn-xs gap-2"
        data-testid="toggle-view"
        @click="view = view === 'grid' ? 'list' : 'grid'"
      >
        {{ view === "grid" ? "Vue liste" : "Vue grille" }}
      </button>
    </div>

    <section v-for="g in groups" :key="g.section" class="mb-8">
      <p class="section-rule eyebrow">
        {{ g.section }} ·
        <span class="tabular text-base-content">{{ g.total }}</span>
      </p>

      <!-- GRILLE -->
      <div
        v-if="view === 'grid'"
        class="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6"
      >
        <div
          v-for="e in g.entries"
          :key="e.name"
          class="relative"
          :class="e.card ? 'cursor-pointer' : ''"
          :data-testid="e.card ? `card-tile-${e.card.id}` : undefined"
          @mouseenter="e.card && preview.show(e.card)"
          @mouseleave="preview.hide()"
          @click="e.card && emit('select', e.card)"
        >
          <div class="aspect-[7/10] overflow-hidden bg-base-200">
            <img
              v-if="e.card"
              :src="cardImg(e.card)"
              :alt="e.name"
              class="h-full w-full object-cover"
              loading="lazy"
              @error="onImgError"
            />
            <div
              v-else
              class="flex h-full w-full items-center justify-center p-1 text-center text-[10px] text-base-content/60"
            >
              {{ e.name }}
            </div>
          </div>
          <span
            class="absolute bottom-1 right-1 bg-base-100/90 px-1 font-mono text-[11px] font-bold tabular"
            >×{{ e.quantity }}</span
          >
        </div>
      </div>

      <!-- LISTE -->
      <ul v-else class="mt-3 space-y-1">
        <li
          v-for="e in g.entries"
          :key="e.name"
          class="flex items-baseline text-sm"
          :class="e.card ? 'spine cursor-pointer hover:text-primary' : ''"
          :style="e.card ? { '--spine': cardSpineColor(e.card) } : undefined"
          @mouseenter="e.card && preview.show(e.card)"
          @mouseleave="preview.hide()"
          @click="e.card && emit('select', e.card)"
        >
          <span :class="e.card ? 'text-base-content/85' : 'text-warning'">{{
            e.name
          }}</span>
          <span class="leader"></span>
          <span
            v-if="e.card"
            class="shrink-0 font-mono text-[11px] uppercase tracking-wide text-base-content/55"
            >{{ cardPaLabel(e.card) }}</span
          >
          <span class="ml-3 shrink-0 font-mono tabular text-base-content/70"
            >×{{ e.quantity }}</span
          >
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { Card } from "@/types/cards";
import type { DeckGalleryGroup } from "./deckGallery";
import { cardSpineColor, cardPaLabel } from "@/utils/cardDisplay";
import { getThumbPath } from "@/utils/imagePaths";
import { useCardPreview } from "@/composables/useCardPreview";

defineProps<{ groups: DeckGalleryGroup[] }>();
const emit = defineEmits<{ (e: "select", card: Card): void }>();

const view = ref<"grid" | "list">("grid");
const preview = useCardPreview();

function cardImg(card: Card): string {
  if (card.imageUrl) return card.imageUrl;
  const full =
    card.mainType === "Héros"
      ? `/images/cards/${card.id}_recto.webp`
      : `/images/cards/${card.id}.webp`;
  return getThumbPath(full);
}

function onImgError(e: Event) {
  const img = e.target as HTMLImageElement;
  if (img.src.includes("/thumbs/")) {
    img.src = img.src.replace("/thumbs/", "/");
    return;
  }
  img.src = "/images/card-back.webp";
}
</script>
