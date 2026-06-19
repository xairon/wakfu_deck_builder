<template>
  <div>
    <!-- Message si aucune carte -->
    <div
      v-if="validCards.length === 0"
      class="border border-base-content/30 bg-base-100 px-6 py-16 text-center"
      role="status"
      aria-live="polite"
    >
      <p class="eyebrow">Aucun résultat</p>
      <h2 class="mt-2 font-display text-2xl">Aucune carte trouvée</h2>
      <p class="mt-2 text-base-content/70">Essayez de modifier vos filtres.</p>
    </div>

    <div v-else class="cards-grid-container relative" ref="gridContainer">
      <!-- Grille (contact-sheet), une page à la fois -->
      <div
        class="contact-sheet mt-4 cards-grid"
        role="list"
        aria-label="Grille de cartes de la collection"
      >
        <div
          v-for="cardItem in pagedCards"
          :key="cardItem.card.id"
          class="card-wrapper relative h-auto w-full"
          role="listitem"
        >
          <CollectionCardItem
            :card="cardItem.card"
            :quantity="cardItem.quantity"
            :foil-quantity="cardItem.foilQuantity"
            :enable-add-to-deck="enableAddToDeck"
            :dim-unowned="dimUnowned"
            @update-quantity="handleQuantityUpdate"
            @select-card="handleCardSelect"
            @add-to-deck="handleAddToDeck"
          />
        </div>
      </div>

      <!-- Pagination -->
      <nav
        v-if="totalPages > 1"
        class="mt-8 flex flex-wrap items-center justify-center gap-2 border-t border-base-content/15 pt-6"
        aria-label="Pagination de la collection"
      >
        <button
          class="btn btn-ghost btn-sm px-2"
          :disabled="currentPage === 0"
          aria-label="Page précédente"
          @click="goTo(currentPage - 1)"
        >
          ←
        </button>

        <button
          v-for="p in pageButtons"
          :key="p.key"
          class="btn btn-sm min-w-9 font-mono tabular"
          :class="
            p.page === currentPage
              ? 'btn-neutral'
              : p.page === -1
                ? 'btn-ghost pointer-events-none'
                : 'btn-ghost'
          "
          :disabled="p.page === -1"
          :aria-current="p.page === currentPage ? 'page' : undefined"
          @click="p.page !== -1 && goTo(p.page)"
        >
          {{ p.page === -1 ? "…" : p.page + 1 }}
        </button>

        <button
          class="btn btn-ghost btn-sm px-2"
          :disabled="currentPage >= totalPages - 1"
          aria-label="Page suivante"
          @click="goTo(currentPage + 1)"
        >
          →
        </button>
      </nav>

      <p
        class="mt-3 text-center font-mono text-[11px] uppercase tracking-wider text-base-content/45"
      >
        {{ validCards.length }} carte{{ validCards.length > 1 ? "s" : "" }}
        <template v-if="totalPages > 1">
          · page {{ currentPage + 1 }}/{{ totalPages }}
        </template>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Grille paginée de la collection : une page de cartes à la fois (DOM borné,
 * collection complète parcourable sans plafond).
 */
import { computed, ref, watch, nextTick, withDefaults } from "vue";
import { useCardStore } from "@/stores/cardStore";
import CollectionCardItem from "./CollectionCardItem.vue";
import type { Card } from "@/types/cards";

interface Props {
  filteredCards: any[];
  pageSize?: number;
  enableAddToDeck?: boolean;
  dimUnowned?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  pageSize: 60,
  enableAddToDeck: false,
  dimUnowned: false,
});

const emit = defineEmits<{
  (
    e: "update-quantity",
    cardId: string,
    quantity: number,
    isFoil: boolean,
  ): void;
  (e: "select-card", card: Card): void;
  (e: "add-to-deck", card: Card): void;
}>();

const cardStore = useCardStore();
const gridContainer = ref<HTMLElement | null>(null);
const currentPage = ref(0);

const isEncapsulatedFormat = computed(() => {
  if (!props.filteredCards || props.filteredCards.length === 0) return false;
  return (
    props.filteredCards[0] &&
    typeof props.filteredCards[0] === "object" &&
    "card" in props.filteredCards[0]
  );
});

// Normalise toujours au format { card, quantity, foilQuantity }.
const validCards = computed(() => {
  try {
    if (isEncapsulatedFormat.value) {
      return props.filteredCards.filter(
        (item) => item && item.card && item.card.id,
      );
    }
    return props.filteredCards
      .filter((item) => item && item.id)
      .map((card) => ({
        card,
        quantity: getCardQuantity(card.id),
        foilQuantity: getFoilCardQuantity(card.id),
      }));
  } catch (error) {
    console.error("Erreur lors du filtrage des cartes valides:", error);
    return [];
  }
});

const totalPages = computed(() =>
  Math.max(1, Math.ceil(validCards.value.length / props.pageSize)),
);

const pagedCards = computed(() => {
  const start = currentPage.value * props.pageSize;
  return validCards.value.slice(start, start + props.pageSize);
});

// Boutons de page compacts : 1 … (p-1) p (p+1) … N
const pageButtons = computed(() => {
  const total = totalPages.value;
  const cur = currentPage.value;
  const pages = new Set<number>([0, total - 1, cur, cur - 1, cur + 1]);
  const sorted = [...pages]
    .filter((p) => p >= 0 && p < total)
    .sort((a, b) => a - b);
  const out: { key: string; page: number }[] = [];
  let prev = -2;
  for (const p of sorted) {
    if (p - prev > 1) out.push({ key: `gap-${p}`, page: -1 });
    out.push({ key: `p-${p}`, page: p });
    prev = p;
  }
  return out;
});

function goTo(page: number) {
  const clamped = Math.min(Math.max(0, page), totalPages.value - 1);
  if (clamped === currentPage.value) return;
  currentPage.value = clamped;
  nextTick(() => {
    gridContainer.value?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

// Le SET ORDONNÉ des cartes affichées (ids seuls) : ne change QUE si la
// recherche / les filtres / le tri changent — PAS quand on ajuste la quantité
// d'une carte (ajout/retrait). Le parent repasse un nouveau tableau à chaque
// changement de quantité ; déclencher sur cette clé (et non sur la référence
// ou le contenu profond) évite le retour intempestif en page 1 sur une page > 1.
const resultKey = computed(() =>
  validCards.value.map((item) => item.card?.id ?? "").join("|"),
);
watch(resultKey, () => {
  currentPage.value = 0;
});
watch(totalPages, (tp) => {
  if (currentPage.value > tp - 1) currentPage.value = tp - 1;
});

function getCardQuantity(cardId: string): number {
  if (!cardId) return 0;
  return cardStore.getCardQuantity(cardId);
}
function getFoilCardQuantity(cardId: string): number {
  if (!cardId) return 0;
  return cardStore.getFoilCardQuantity(cardId);
}

function handleQuantityUpdate(
  cardId: string,
  quantity: number,
  isFoil: boolean,
) {
  if (!cardId) return;
  emit("update-quantity", cardId, quantity, isFoil);
}
function handleCardSelect(card: Card) {
  if (!card || !card.id) return;
  emit("select-card", card);
}
function handleAddToDeck(card: Card) {
  if (!card || !card.id) return;
  emit("add-to-deck", card);
}
</script>

<style scoped>
.card-wrapper {
  height: auto;
  transition: all 0.2s ease;
  overflow: visible;
  transform-style: preserve-3d;
  /* Cartes hors écran non peintes par le navigateur (virtualisation native). */
  content-visibility: auto;
  contain-intrinsic-size: auto 280px;
}

.cards-grid {
  overflow: visible;
  width: 100%;
  padding-bottom: 20px;
}

.cards-grid-container {
  min-height: 50vh;
  scroll-margin-top: 5rem;
}

@media (min-width: 1600px) {
  .cards-grid {
    max-width: 1500px;
    margin: 0 auto;
  }
}
</style>
