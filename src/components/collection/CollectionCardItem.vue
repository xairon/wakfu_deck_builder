<template>
  <div
    class="card-container group relative"
    role="button"
    tabindex="0"
    :aria-label="`${card.name} - ${card.mainType}${quantity > 0 || foilQuantity > 0 ? ', possédée: ' + (quantity + foilQuantity) : ', non possédée'}`"
    @click="emitCardSelect"
    @keydown.enter="emitCardSelect"
    @keydown.space.prevent="emitCardSelect"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Carte : l'illustration a son propre cadre imprimé, pas de sur-cadre -->
    <figure
      class="plate-frame relative cursor-pointer"
      :class="{
        'grayscale opacity-60 hover:grayscale-0 hover:opacity-100':
          !isOwned && dimUnowned,
      }"
    >
      <!-- Illustration -->
      <div class="relative" :class="{ sheen: foilQuantity > 0 }">
        <img
          :src="cardImagePath"
          :alt="`Carte ${card?.name || 'Wakfu'} - ${card?.mainType || 'Type inconnu'}`"
          class="aspect-[7/10] w-full object-cover"
          loading="lazy"
          @error="handleImageError"
        />

        <!-- Étiquette brillante : tag mono 'F×N' -->
        <span
          v-if="foilQuantity > 0"
          class="absolute right-1 top-1 bg-base-100/90 px-1 py-0.5 font-mono text-[10px] font-bold uppercase text-base-content"
          style="letter-spacing: 0.06em"
        >
          F×{{ foilQuantity }}
        </span>

        <!-- Pastille de possession / playset (permanente, lisible au tactile) -->
        <span
          v-if="authStore.isAuthenticated && isOwned"
          class="absolute left-1 top-1 z-10 border px-1 py-0.5 font-mono text-[10px] font-bold tabular"
          :class="
            playsetComplete
              ? 'border-success bg-success text-success-content'
              : 'border-base-content bg-base-100/90 text-base-content'
          "
          :title="`Possédées : ${ownedTotal} / ${playsetTarget}`"
        >
          {{ ownedTotal }}/{{ playsetTarget }}
        </span>

        <!-- Bouton d'ajout au deck (mode constructeur) -->
        <button
          v-if="enableAddToDeck && isHovered"
          @click.stop="emitAddToDeck"
          class="absolute left-1 top-1 z-20 grid h-7 w-7 place-items-center border border-base-content bg-base-100 text-base-content transition-colors hover:bg-primary hover:text-primary-content"
          :aria-label="`Ajouter ${card.name} au deck`"
        >
          <svg
            viewBox="0 0 24 24"
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path stroke-linecap="round" d="M12 5v14M5 12h14" />
          </svg>
        </button>

        <!-- Bouton de retournement pour les cartes héros -->
        <button
          v-if="isHeroCard && isHovered"
          @click.stop="toggleCardSide"
          class="absolute right-1 top-1 z-20 grid h-7 w-7 place-items-center border border-base-content bg-base-100 text-base-content transition-colors hover:bg-primary hover:text-primary-content"
          :aria-label="showVerso ? 'Afficher le recto' : 'Afficher le verso'"
        >
          <svg
            viewBox="0 0 24 24"
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 9a8 8 0 0113.5-3.5L20 8M20 15a8 8 0 01-13.5 3.5L4 16"
            />
            <path stroke-linecap="round" d="M20 4v4h-4M4 20v-4h4" />
          </svg>
        </button>

        <!-- Indicateur recto/verso (héros) -->
        <span
          v-if="isHeroCard && isHovered"
          class="absolute bottom-1 left-1 z-20 bg-base-100/90 px-1 py-0.5 font-mono text-[10px] uppercase text-base-content"
          style="letter-spacing: 0.06em"
        >
          {{ showVerso ? "Verso" : "Recto" }}
        </span>

        <!-- Contrôles de possession (visibles uniquement si authentifié) -->
        <div
          v-if="authStore.isAuthenticated && isHovered"
          class="ownership-controls absolute inset-x-0 bottom-0 z-20 border-t border-base-content bg-base-100/95 p-2"
          @click.stop
        >
          <!-- Normal -->
          <div class="flex items-center justify-between gap-2">
            <span class="eyebrow text-base-content/60">Normal</span>
            <div class="flex items-center gap-1.5">
              <button
                class="grid h-6 w-6 place-items-center border border-base-content/40 font-mono text-sm leading-none text-base-content transition-colors hover:border-base-content disabled:opacity-30"
                @click.stop="updateQuantity(-1, false)"
                :disabled="quantity <= 0"
                :aria-label="`Retirer un exemplaire de ${card.name}`"
              >
                −
              </button>
              <span
                class="w-5 text-center font-mono text-sm tabular text-base-content"
                >{{ quantity }}</span
              >
              <button
                class="grid h-6 w-6 place-items-center border border-base-content/40 font-mono text-sm leading-none text-base-content transition-colors hover:border-base-content"
                @click.stop="updateQuantity(1, false)"
                :aria-label="`Ajouter un exemplaire de ${card.name}`"
              >
                +
              </button>
            </div>
          </div>

          <!-- Foil -->
          <div class="mt-1.5 flex items-center justify-between gap-2">
            <span class="eyebrow text-primary">Foil</span>
            <div class="flex items-center gap-1.5">
              <button
                class="grid h-6 w-6 place-items-center border border-base-content/40 font-mono text-sm leading-none text-base-content transition-colors hover:border-base-content disabled:opacity-30"
                @click.stop="updateQuantity(-1, true)"
                :disabled="foilQuantity <= 0"
                :aria-label="`Retirer un exemplaire brillant de ${card.name}`"
              >
                −
              </button>
              <span
                class="w-5 text-center font-mono text-sm tabular text-base-content"
                >{{ foilQuantity }}</span
              >
              <button
                class="grid h-6 w-6 place-items-center border border-base-content/40 font-mono text-sm leading-none text-base-content transition-colors hover:border-base-content"
                @click.stop="updateQuantity(1, true)"
                :aria-label="`Ajouter un exemplaire brillant de ${card.name}`"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Cartouche mono sous la planche -->
      <figcaption class="plate-caption">
        {{ card?.name || "Carte sans nom"
        }}<template v-if="isOwned"> ×{{ quantity + foilQuantity }}</template>
      </figcaption>
    </figure>
  </div>
</template>

<script setup lang="ts">
/**
 * Composant pour afficher une carte individuelle dans la collection
 * Mise en avant de l'illustration avec informations minimalistes
 */
import { computed, ref, onMounted, onUnmounted } from "vue";
import type { Card } from "@/types/cards";
import { useAuthStore } from "@/stores/authStore";

// Définition des props
interface Props {
  card: Card;
  quantity: number;
  foilQuantity: number;
  enableAddToDeck: boolean;
  /** Griser les cartes non possédées (option, désactivé par défaut). */
  dimUnowned?: boolean;
}

const props = defineProps<Props>();

const authStore = useAuthStore();

const isOwned = computed(() => props.quantity > 0 || props.foilQuantity > 0);

// Playset : objectif 3 exemplaires (1 si la carte est Unique).
const playsetTarget = computed(() =>
  props.card.keywords?.some((k) => k.name === "Unique") ? 1 : 3,
);
const ownedTotal = computed(() => props.quantity + props.foilQuantity);
const playsetComplete = computed(() => ownedTotal.value >= playsetTarget.value);

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

// État pour la gestion des erreurs d'image et l'interactivité
const hasImageError = ref(false);
const showVerso = ref(false);
const isHovered = ref(false);

// Computed properties
const isHeroCard = computed(() => {
  return props.card?.mainType === "Héros";
});

// Chemin de l'image - gère différents types de cartes
const cardImagePath = computed(() => {
  if (hasImageError.value || !props.card?.id) {
    return "/images/card-back.png";
  }

  // Si la carte a une imageUrl, l'utiliser directement
  if (props.card.imageUrl) {
    return props.card.imageUrl;
  }

  // Sinon, construire le chemin à partir de l'ID
  // Si c'est un héros, utiliser recto ou verso selon l'état
  if (isHeroCard.value) {
    return `/images/cards/${props.card.id}_${showVerso.value ? "verso" : "recto"}.png`;
  }

  return `/images/cards/${props.card.id}.png`;
});

// Gérer les erreurs de chargement d'image
function handleImageError() {
  // Si la carte a une URL d'image mais qu'elle ne charge pas, passer directement au fallback
  if (props.card.imageUrl) {
    hasImageError.value = true;
    return;
  }

  // Tenter de charger une version alternative de l'image (pour les chemins basés sur l'ID)
  const img = new Image();
  if (isHeroCard.value) {
    // Si c'est une image de héros, essayer l'autre face
    const alternatePath = `/images/cards/${props.card.id}_${showVerso.value ? "recto" : "verso"}.png`;
    img.src = alternatePath;

    // Si l'autre face charge correctement, basculer automatiquement
    img.onload = () => {
      showVerso.value = !showVerso.value;
      hasImageError.value = false;
    };

    img.onerror = () => {
      // Si l'autre face ne peut pas être chargée non plus, utiliser le placeholder
      hasImageError.value = true;
    };
  } else {
    // Pour les cartes normales, simplement marquer l'erreur
    hasImageError.value = true;
  }
}

// Mettre à jour la quantité
function updateQuantity(change: number, isFoil: boolean) {
  if (!props.card?.id) return;
  emit("update-quantity", props.card.id, change, isFoil);
}

// Sélectionner une carte (pour afficher le modal)
function emitCardSelect() {
  if (!props.card) {
    return;
  }
  emit("select-card", props.card);
}

// Basculer entre recto et verso pour les cartes héros
function toggleCardSide(event: Event) {
  event.stopPropagation(); // Empêcher la propagation au parent (qui ouvrirait le modal)

  if (isHeroCard.value) {
    // Réinitialiser l'état d'erreur
    hasImageError.value = false;

    // Inverser l'état recto/verso
    showVerso.value = !showVerso.value;
  }
}

// Événements d'entrée/sortie de souris
onMounted(() => {
  const container = document.querySelector(".card-container");
  if (container) {
    container.addEventListener("mouseenter", () => {
      isHovered.value = true;
    });
    container.addEventListener("mouseleave", () => {
      isHovered.value = false;
    });
  }
});

onUnmounted(() => {
  const container = document.querySelector(".card-container");
  if (container) {
    container.removeEventListener("mouseenter", () => {
      isHovered.value = true;
    });
    container.removeEventListener("mouseleave", () => {
      isHovered.value = false;
    });
  }
});

// Événements d'ajout au deck
function emitAddToDeck() {
  if (!props.card) {
    return;
  }
  emit("add-to-deck", props.card);
}
</script>

<style scoped>
.card-container {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.plate-frame {
  height: 100%;
  width: 100%;
}
</style>
