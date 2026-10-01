<template>
  <div
    class="group relative select-none rounded-[3px] overflow-hidden border border-base-content/20 bg-base-300 shadow-sm transition-all duration-150 hover:shadow-md hover:border-primary/60 hover:-translate-y-0.5"
    :style="{ '--spine': spineColor }"
    @mouseenter="preview.show(dc.card)"
    @mouseleave="preview.hide()"
  >
    <!-- Conteneur image 7/10 occupant tout l'espace -->
    <div
      class="relative aspect-[7/10] w-full cursor-pointer bg-base-200 overflow-hidden"
      :title="`Agrandir ${dc.card.name}`"
      @click.stop="$emit('open-zoom', dc.card)"
    >
      <img
        :src="cardThumb"
        :alt="dc.card.name"
        class="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
        loading="lazy"
        @error="onImgFallback"
      />

      <!-- Filet / liseré de couleur élémentaire sur le bord gauche -->
      <div
        class="absolute left-0 top-0 bottom-0 w-1 pointer-events-none z-10"
        :style="{ backgroundColor: spineColor }"
      ></div>

      <!-- Badge Quantité (Haut gauche) : style parchemin / braise proéminent -->
      <div class="absolute left-2 top-2 z-20 flex items-center shadow-md">
        <span
          class="rounded-[2px] bg-primary px-1.5 py-0.5 font-mono text-xs font-bold tabular text-primary-content ring-1 ring-black/40"
          :title="`${dc.quantity} copie(s) dans le deck`"
        >
          ×{{ dc.quantity }}
        </span>
      </div>

      <!-- Badge Erraté éventuel (sous le badge quantité) -->
      <div class="absolute left-2 top-8 z-20">
        <ErrataBadge :card-id="dc.card.id" />
      </div>

      <!-- Badge Coût PA (Haut droite) -->
      <div
        v-if="cardPa !== null"
        class="absolute right-2 top-2 z-20 flex items-center shadow-md"
      >
        <span
          class="rounded-[2px] bg-base-900/85 backdrop-blur-xs px-1.5 py-0.5 font-mono text-[11px] font-bold text-amber-300 border border-white/10"
          :title="`Coût : ${cardPa} PA`"
        >
          {{ cardPa }} PA
        </span>
      </div>

      <!-- Sélecteur d'édition si multiples impressions (Haut droite sous les PA) -->
      <div
        v-if="hasMultipleEditions"
        class="absolute right-2 top-8 z-20"
        @mouseenter="preview.hide()"
        @click.stop
      >
        <select
          class="select select-bordered select-xs h-6 min-h-0 bg-base-900/90 text-white border-white/20 font-mono text-[9px] uppercase tracking-wider px-1 shadow-md max-w-[5.5rem] truncate"
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
          <option
            v-for="e in editions"
            :key="e.id"
            :value="e.id"
            class="bg-base-900 text-white"
          >
            {{ e.extension.name }}
          </option>
        </select>
      </div>

      <!-- Overlay bas : Nom + Type + Actions (+ / - / Réserve) -->
      <div
        class="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/95 via-black/75 to-transparent pt-6 pb-2 px-2 flex flex-col justify-end"
      >
        <!-- Nom & Type -->
        <p
          class="truncate font-display text-xs font-bold leading-tight text-white drop-shadow-sm hover:text-primary transition-colors"
          :title="dc.card.name"
        >
          {{ dc.card.name }}
        </p>
        <p class="truncate font-mono text-[9px] text-white/70 uppercase tracking-wide">
          {{ dc.card.mainType }}
        </p>

        <!-- Barre d'actions au bas de la carte -->
        <div class="mt-1.5 flex items-center justify-between border-t border-white/15 pt-1.5" @click.stop>
          <button
            type="button"
            class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono text-white/70 hover:text-white hover:bg-white/20 transition"
            :title="isReserve ? 'Renvoyer au deck principal' : 'Déplacer en réserve'"
            :aria-label="isReserve ? 'Renvoyer au deck principal' : 'Déplacer en réserve'"
            @click="
              preview.hide();
              isReserve ? $emit('move-to-main', dc.card.id) : $emit('move-to-reserve', dc.card.id);
            "
          >
            <svg
              viewBox="0 0 24 24"
              class="h-3 w-3"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              aria-hidden="true"
            >
              <path
                v-if="!isReserve"
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"
              />
              <path
                v-else
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 20V9m0 0-4 4m4-4 4 4M5 4h14"
              />
            </svg>
            <span class="hidden sm:inline">{{ isReserve ? 'Deck' : 'Rés.' }}</span>
          </button>

          <div class="flex items-center gap-1">
            <!-- Bouton Retirer (-) -->
            <button
              type="button"
              class="h-5 w-5 rounded bg-white/15 hover:bg-white/30 text-white font-mono text-xs font-bold flex items-center justify-center transition"
              title="Retirer une copie"
              aria-label="Retirer une copie"
              @click="
                preview.hide();
                $emit('remove', dc.card.id);
              "
            >
              −
            </button>
            <!-- Bouton Ajouter (+) -->
            <button
              type="button"
              class="h-5 w-5 rounded bg-primary hover:bg-primary/80 text-primary-content font-mono text-xs font-bold flex items-center justify-center shadow-sm transition"
              title="Ajouter une copie"
              aria-label="Ajouter une copie"
              @click="
                preview.hide();
                $emit('add', dc.card);
              "
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
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

const props = withDefaults(
  defineProps<{
    dc: DeckCard;
    spineColor: string;
    isReserve?: boolean;
  }>(),
  {
    isReserve: false,
  },
);

defineEmits<{
  "move-to-reserve": [id: string];
  "move-to-main": [id: string];
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
