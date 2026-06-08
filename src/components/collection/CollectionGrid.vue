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

    <!-- Grille de cartes avec virtualisation simple -->
    <div v-else class="cards-grid-container relative" ref="gridContainer">
      <!-- Indication de chargement -->
      <div
        v-if="isLoading"
        class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 border border-base-content/30 bg-base-100 px-4 py-2"
        role="status"
        aria-label="Chargement de cartes supplémentaires"
      >
        <span class="eyebrow flex items-center gap-2" aria-hidden="true">
          <span class="inline-block h-2 w-2 animate-pulse bg-primary"></span>
          Chargement…
        </span>
        <span class="sr-only">Chargement...</span>
      </div>

      <!-- Grille virtualisée (contact-sheet) -->
      <div
        class="contact-sheet mt-4 cards-grid"
        role="list"
        aria-label="Grille de cartes de la collection"
      >
        <div
          v-for="cardItem in visibleCards"
          :key="
            cardItem.hasOwnProperty('card') ? cardItem.card.id : cardItem.id
          "
          class="card-wrapper w-full h-auto relative"
          role="listitem"
        >
          <CollectionCardItem
            :card="cardItem.hasOwnProperty('card') ? cardItem.card : cardItem"
            :quantity="
              cardItem.hasOwnProperty('quantity')
                ? cardItem.quantity
                : getCardQuantity(cardItem.id)
            "
            :foil-quantity="
              cardItem.hasOwnProperty('foilQuantity')
                ? cardItem.foilQuantity
                : getFoilCardQuantity(cardItem.id)
            "
            :enable-add-to-deck="enableAddToDeck"
            :dim-unowned="dimUnowned"
            @update-quantity="handleQuantityUpdate"
            @select-card="handleCardSelect"
            @add-to-deck="handleAddToDeck"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Composant pour afficher une grille de cartes de la collection
 * Avec virtualisation simple pour améliorer les performances
 */
import {
  defineProps,
  defineEmits,
  computed,
  ref,
  onMounted,
  onUnmounted,
  watch,
  withDefaults,
} from "vue";
import { useCardStore } from "@/stores/cardStore";
import { useWindowScroll, useThrottleFn } from "@vueuse/core";
import CollectionCardItem from "./CollectionCardItem.vue";
import type { Card } from "@/types/cards";

// Définition des props
interface Props {
  filteredCards: any[]; // Accepte les deux formats de cartes
  pageSize?: number;
  enableAddToDeck?: boolean;
  dimUnowned?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  pageSize: 20,
  enableAddToDeck: false,
  dimUnowned: false,
});

// Définition des émissions
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

// Store
const cardStore = useCardStore();

// État pour la virtualisation
const isLoading = ref(false);
const gridContainer = ref<HTMLElement | null>(null);
const { y: scrollY } = useWindowScroll();
const currentPage = ref(0);

// Déterminer le format des cartes reçues
const isEncapsulatedFormat = computed(() => {
  if (!props.filteredCards || props.filteredCards.length === 0) return false;
  // Format { card, quantity, foilQuantity } vs Card directement
  return (
    props.filteredCards[0] &&
    typeof props.filteredCards[0] === "object" &&
    "card" in props.filteredCards[0]
  );
});

// Cartes valides (filtrage des entrées incorrectes)
const validCards = computed(() => {
  try {
    if (isEncapsulatedFormat.value) {
      return props.filteredCards.filter(
        (item) => item && item.card && item.card.id,
      );
    } else {
      // Convertir au format encapsulé pour unifier le traitement
      return props.filteredCards
        .filter((item) => item && item.id)
        .map((card) => ({
          card,
          quantity: getCardQuantity(card.id),
          foilQuantity: getFoilCardQuantity(card.id),
          available: getCardQuantity(card.id) + getFoilCardQuantity(card.id),
        }));
    }
  } catch (error) {
    console.error("Erreur lors du filtrage des cartes valides:", error);
    return [];
  }
});

// Cartes visibles (en fonction de la pagination)
const visibleCards = computed(() => {
  const endIdx = (currentPage.value + 1) * props.pageSize;
  return validCards.value.slice(0, endIdx);
});

// Charger plus de cartes quand on scroll
const loadMoreCards = useThrottleFn(() => {
  const scrollPosition = window.scrollY;
  const windowHeight = window.innerHeight;
  const documentHeight = document.documentElement.scrollHeight;

  // Si on approche du bas de la page (300px avant la fin)
  if (
    documentHeight - (scrollPosition + windowHeight) < 300 &&
    validCards.value.length > visibleCards.value.length
  ) {
    isLoading.value = true;

    // Simuler un petit délai pour éviter de bloquer le thread principal
    setTimeout(() => {
      currentPage.value++;
      isLoading.value = false;
    }, 50);
  }
}, 100);

// Surveiller le scroll pour charger plus de cartes
watch(scrollY, () => {
  loadMoreCards();
});

// Surveiller les changements de filtres pour réinitialiser la pagination
watch(
  () => props.filteredCards,
  () => {
    currentPage.value = 0;
  },
  { deep: true },
);

// Setup des écouteurs d'événements
onMounted(() => {
  window.addEventListener("scroll", loadMoreCards);
  // Charger les premières cartes
  loadMoreCards();
});

onUnmounted(() => {
  window.removeEventListener("scroll", loadMoreCards);
});

// Fonctions d'aide pour obtenir les quantités de cartes
function getCardQuantity(cardId: string): number {
  if (!cardId) return 0;
  return cardStore.getCardQuantity(cardId);
}

function getFoilCardQuantity(cardId: string): number {
  if (!cardId) return 0;
  return cardStore.getFoilCardQuantity(cardId);
}

// Gestion de la mise à jour de la quantité
function handleQuantityUpdate(
  cardId: string,
  quantity: number,
  isFoil: boolean,
) {
  if (!cardId) return;
  emit("update-quantity", cardId, quantity, isFoil);
}

// Gestion de la sélection de carte
function handleCardSelect(card: Card) {
  if (!card || !card.id) {
    return;
  }
  emit("select-card", card);
}

// Gestion de l'ajout de carte au deck
function handleAddToDeck(card: Card) {
  if (!card || !card.id) {
    return;
  }
  emit("add-to-deck", card);
}
</script>

<style scoped>
.card-wrapper {
  height: auto;
  transition: all 0.2s ease;
  overflow: visible;
  transform-style: preserve-3d;
}

/* Styles pour la grille de cartes */
.cards-grid {
  overflow: visible;
  width: 100%;
  padding-bottom: 20px;
}

.cards-grid-container {
  min-height: 50vh;
}

@media (min-width: 1600px) {
  .cards-grid {
    max-width: 1500px;
    margin: 0 auto;
  }
}
</style>
