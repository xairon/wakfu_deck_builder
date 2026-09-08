<template>
  <li
    class="spine group flex items-center gap-2 border-b border-base-content/10 py-1.5 transition-colors hover:bg-base-200/40"
    :style="{ '--spine': spineColor }"
    @mouseenter="preview.show(dc.card)"
    @mouseleave="preview.hide()"
  >
    <span
      class="w-4 shrink-0 text-right font-mono text-xs sm:text-sm font-bold tabular text-base-content/70"
      >{{ dc.quantity }}</span
    >
    <div
      class="plate-frame w-7 shrink-0 cursor-pointer overflow-hidden rounded-[2px] bg-base-300 ring-1 ring-base-content/15 shadow-sm transition-transform duration-150 group-hover:scale-105 group-hover:ring-primary/50"
      :style="{ '--spine': spineColor }"
      :title="`Agrandir ${dc.card.name}`"
      @click.stop="$emit('open-zoom', dc.card)"
    >
      <img
        :src="cardThumb"
        :alt="dc.card.name"
        class="aspect-[7/10] w-full object-cover object-[50%_18%]"
        loading="lazy"
        @error="onImgFallback"
      />
    </div>
    <span
      class="truncate font-display text-sm leading-tight cursor-pointer hover:text-primary transition-colors"
      :title="dc.card.name"
      @click.stop="$emit('open-zoom', dc.card)"
      >{{ dc.card.name }}</span
    >
    <ErrataBadge :card-id="dc.card.id" class="shrink-0" />
    <span class="leader"></span>
    <span
      class="shrink-0 whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-base-content/45"
    >
      {{ dc.card.mainType }} · {{ cardPa }} PA
    </span>
    <span
      v-if="hasMultipleEditions"
      class="shrink-0"
      @mouseenter="preview.hide()"
    >
      <select
        class="select select-ghost select-xs h-6 min-h-0 max-w-[7.5rem] truncate font-mono text-[10px] uppercase tracking-wider"
        :value="dc.card.id"
        :title="`Édition : ${dc.card.extension.name}`"
        :aria-label="`Édition de ${dc.card.name}`"
        @change="
          $emit(
            'set-edition',
            dc.card.id,
            editions.find(
              (e) => e.id === ($event.target as HTMLSelectElement).value,
            )!,
          )
        "
      >
        <option v-for="e in editions" :key="e.id" :value="e.id">
          {{ e.extension.name }}
        </option>
      </select>
    </span>
    <span class="ml-1 flex shrink-0 items-center gap-1.5">
      <button
        class="text-base-content/40 hover:text-primary"
        @click="
          preview.hide();
          $emit('move-to-reserve', dc.card.id);
        "
        title="Déplacer en réserve"
        aria-label="Déplacer en réserve"
      >
        <svg
          viewBox="0 0 24 24"
          class="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"
          />
        </svg>
      </button>
      <button
        class="font-mono text-base font-bold leading-none text-base-content/50 hover:text-base-content"
        @click="
          preview.hide();
          $emit('remove', dc.card.id);
        "
        aria-label="Retirer une copie"
      >
        −
      </button>
      <button
        class="font-mono text-base font-bold leading-none text-base-content/50 hover:text-base-content"
        @click="$emit('add', dc.card)"
        aria-label="Ajouter une copie"
      >
        +
      </button>
    </span>
  </li>
</template>

<script setup lang="ts">
import type { Card, DeckCard } from "@/types/cards";
import { computed } from "vue";
import { useCardPreview } from "@/composables/useCardPreview";
import { useCardStore } from "@/stores/cardStore";
import { cardCost } from "@/utils/cardDisplay";
import { getCardThumbPath } from "@/utils/imagePaths";
import ErrataBadge from "@/components/card/ErrataBadge.vue";

const preview = useCardPreview();
const cardStore = useCardStore();

const props = defineProps<{
  dc: DeckCard;
  spineColor: string;
}>();

defineEmits<{
  "move-to-reserve": [id: string];
  remove: [id: string];
  add: [card: Card];
  "open-zoom": [card: Card];
  "set-edition": [cardId: string, printing: Card];
}>();

const editions = computed(() => cardStore.printingsOf(props.dc.card));
const hasMultipleEditions = computed(() => editions.value.length > 1);
const cardPa = computed(() => cardCost(props.dc.card));
const cardThumb = computed(() => getCardThumbPath(props.dc.card));

function onImgFallback(e: Event) {
  const img = e.target as HTMLImageElement;
  if (img.src.includes("/thumbs/")) {
    img.src = img.src.replace("/thumbs/", "/");
    return;
  }
  img.src = "/images/card-back.webp";
}
</script>
