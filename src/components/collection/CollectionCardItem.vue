<template>
  <div 
    class="card-container relative hover:z-10"
    @click="emitCardSelect"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Conteneur principal centré sur l'image -->
    <div 
      class="card-frame relative rounded-lg overflow-hidden shadow-lg transition-all duration-300 transform hover:shadow-xl cursor-pointer"
      :class="{ 
        'grayscale opacity-80 hover:grayscale-0 hover:opacity-100': quantity === 0 && foilQuantity === 0,
        'hero-card': isHeroCard 
      }"
    >
      <!-- Image (élément principal) -->
      <div class="image-container relative aspect-[7/10] flex items-center justify-center overflow-hidden bg-base-300">
        <img
          :src="cardImagePath"
          :alt="card?.name || 'Carte Wakfu'"
          class="w-full h-full object-contain transition-all duration-300"
          loading="lazy"
          @error="handleImageError"
        />
        
        <!-- Overlay de nom (en bas) - disparaît au survol -->
        <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-white transition-opacity duration-300 card-overlay">
          <h3 class="font-bold text-center truncate">{{ card?.name || 'Carte sans nom' }}</h3>
        </div>
      </div>
      
      <!-- Compteurs (en bas à droite) - style amélioré -->
      <div class="absolute right-2 bottom-12 flex flex-col gap-1 transition-opacity duration-300 card-counter">
        <!-- Normal -->
        <div class="badge badge-md bg-base-100 text-base-content shadow-sm" :class="quantity > 0 ? 'badge-primary' : 'badge-ghost opacity-60'">
          {{ quantity }}
        </div>
        <!-- Foil -->
        <div class="badge badge-md bg-base-100 text-base-content shadow-sm" :class="foilQuantity > 0 ? 'badge-secondary' : 'badge-ghost opacity-60'">
          {{ foilQuantity }} ✨
        </div>
      </div>
      
      <!-- Bouton de retournement pour les cartes héros (reste visible au survol) -->
      <button 
        v-if="isHeroCard && isHovered" 
        @click.stop="toggleCardSide"
        class="flip-button absolute top-3 right-3 btn btn-circle btn-sm btn-primary bg-primary/80 hover:bg-primary z-20"
      >
        <span v-if="showVerso">↺</span>
        <span v-else>↻</span>
      </button>
      
      <!-- Indicateur recto/verso en mode hover -->
      <div 
        v-if="isHeroCard && isHovered" 
        class="absolute top-3 left-3 bg-black/50 text-white px-2 py-1 rounded-full text-xs z-20 card-side-indicator"
      >
        {{ showVerso ? 'Verso' : 'Recto' }}
      </div>
      
      <!-- Boutons d'action (visibles en mode hover) -->
      <div 
        v-if="isHovered" 
        class="action-controls absolute inset-0 flex flex-col items-center justify-center z-20"
        @click.stop
      >
        <div class="action-panel bg-base-300/80 backdrop-blur-sm p-3 rounded-lg shadow-lg">
          <div class="flex flex-col gap-4">
            <!-- Compteur et contrôle normaux -->
            <div class="flex items-center gap-3">
              <div class="badge badge-lg badge-primary">{{ quantity }}</div>
              <div class="join">
                <button 
                  class="join-item btn btn-sm btn-error"
                  @click.stop="updateQuantity(-1, false)"
                  :disabled="quantity <= 0"
                >
                  -
                </button>
                <button 
                  class="join-item btn btn-sm btn-primary"
                  @click.stop="updateQuantity(1, false)"
                >
                  +
                </button>
              </div>
            </div>
            
            <!-- Compteur et contrôle foil -->
            <div class="flex items-center gap-3">
              <div class="badge badge-lg badge-secondary">{{ foilQuantity }} ✨</div>
              <div class="join">
                <button 
                  class="join-item btn btn-sm btn-error"
                  @click.stop="updateQuantity(-1, true)"
                  :disabled="foilQuantity <= 0"
                >
                  -
                </button>
                <button 
                  class="join-item btn btn-sm btn-secondary"
                  @click.stop="updateQuantity(1, true)"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Composant pour afficher une carte individuelle dans la collection
 * Mise en avant de l'illustration avec informations minimalistes
 */
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { Card } from '@/types/cards'

// Définition des props
interface Props {
  card: Card
  quantity: number
  foilQuantity: number
}

const props = defineProps<Props>()

// Définition des émissions
const emit = defineEmits<{
  (e: 'update-quantity', cardId: string, quantity: number, isFoil: boolean): void;
  (e: 'select-card', card: Card): void;
}>()

// État pour la gestion des erreurs d'image et l'interactivité
const hasImageError = ref(false)
const showVerso = ref(false)
const isHovered = ref(false)

// Computed properties
const isHeroCard = computed(() => {
  return props.card?.mainType === 'Héros';
});

const getNiveauValue = computed(() => {
  // Vérifier le chemin pour éviter les erreurs undefined
  return props.card?.stats?.niveau?.value ?? '-';
})

const getNiveauElement = computed(() => {
  return props.card?.stats?.niveau?.element ?? null;
})

// Fonction pour obtenir la classe du badge d'élément
function getBadgeClass(element: string): string {
  switch (element.toLowerCase()) {
    case 'feu':
      return 'badge-error';
    case 'eau':
      return 'badge-primary';
    case 'air':
      return 'badge-info';
    case 'terre':
      return 'badge-success';
    default:
      return 'badge-neutral';
  }
}

// Chemin de l'image - gère différents types de cartes
const cardImagePath = computed(() => {
  if (hasImageError.value || !props.card?.id) {
    return '/images/cards/placeholder.png';
  }

  // Si c'est un héros, utiliser recto ou verso selon l'état
  if (isHeroCard.value) {
    return `/images/cards/${props.card.id}_${showVerso.value ? 'verso' : 'recto'}.png`;
  }
  
  return `/images/cards/${props.card.id}.png`;
})

// Gérer les erreurs de chargement d'image
function handleImageError() {
  console.warn(`❌ Erreur de chargement d'image pour ${props.card?.name} (ID: ${props.card?.id})`);
  
  // Tenter de charger une version alternative de l'image
  const img = new Image();
  if (isHeroCard.value) {
    // Si c'est une image de héros, essayer l'autre face
    img.src = `/images/cards/${props.card.id}_${showVerso.value ? 'recto' : 'verso'}.png`;
    
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
  emit('update-quantity', props.card.id, change, isFoil);
}

// Sélectionner une carte (pour afficher le modal)
function emitCardSelect() {
  if (!props.card) {
    console.error(`❌ Tentative d'émission select-card avec une carte null`);
    return;
  }
  console.log('🔍 CardItem: émission de select-card pour', props.card.name, props.card.id);
  emit('select-card', props.card);
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
  const container = document.querySelector('.card-container');
  if (container) {
    container.addEventListener('mouseenter', () => { isHovered.value = true; });
    container.addEventListener('mouseleave', () => { isHovered.value = false; });
  }
});

onUnmounted(() => {
  const container = document.querySelector('.card-container');
  if (container) {
    container.removeEventListener('mouseenter', () => { isHovered.value = true; });
    container.removeEventListener('mouseleave', () => { isHovered.value = false; });
  }
});
</script>

<style scoped>
.card-container {
  height: 100%;
  width: 100%;
  perspective: 1000px;
  overflow: visible;
  display: flex;
  flex-direction: column;
}

.card-frame {
  transition: all 0.35s ease;
  height: 100%;
  width: 100%;
  transform-style: preserve-3d;
  transform-origin: center center;
  border-radius: 12px;
  backface-visibility: hidden;
  position: relative;
  will-change: transform;
}

/* Ajustement du facteur d'échelle et de l'élévation pour éviter le débordement */
.card-container:hover .card-frame {
  transform: translateY(-3px) scale(1.15);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.25);
  z-index: 20;
}

.card-container:hover .card-badge,
.card-container:hover .card-overlay {
  opacity: 0;
}

/* Style pour le panneau de contrôle qui apparaît au survol */
.action-controls {
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.card-container:hover .action-controls {
  opacity: 1;
}

.action-panel {
  transform: translateY(10px);
  opacity: 0;
  transition: all 0.3s ease 0.1s;
  pointer-events: auto;
}

.card-container:hover .action-panel {
  transform: translateY(0);
  opacity: 1;
}

.flip-button {
  transition: all 0.3s ease;
  pointer-events: auto;
}

.card-side-indicator {
  pointer-events: auto;
}

.hero-card::before {
  content: "";
  position: absolute;
  inset: 0;
  border: 2px solid gold;
  border-radius: 0.5rem;
  opacity: 0.5;
  z-index: 5;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.hero-card:hover::before {
  opacity: 0.2;
}

/* Pour éviter que les cartes ne se chevauchent en mode grille */
.card-wrapper {
  padding: 5px;
  overflow: visible;
  height: 100%;
  width: 100%;
}
</style> 