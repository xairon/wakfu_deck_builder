<template>
  <dialog 
    ref="cardModal" 
    class="modal"
    :class="{ 'modal-open': card }"
  >
    <div class="modal-box max-w-3xl">
      <div v-if="card" class="space-y-4">
        <!-- En-tête -->
        <div class="flex justify-between items-center">
          <h3 class="text-2xl font-bold">{{ card.name }}</h3>
          <div v-if="isHero" class="join">
            <button 
              class="join-item btn"
              :class="{ 'btn-active': !showVerso }"
              @click="showVerso = false"
            >
              Recto
            </button>
            <button 
              class="join-item btn"
              :class="{ 'btn-active': showVerso }"
              @click="showVerso = true"
            >
              Verso
            </button>
          </div>
        </div>

        <div class="grid md:grid-cols-2 gap-4">
          <!-- Image -->
          <div class="relative aspect-[7/10] h-auto">
            <OptimizedImage
              :src="`/images/cards/${cardImagePath}`"
              :alt="card.name"
              :width="420"
              :height="600"
              loading="eager"
              fetchpriority="high"
              class="rounded-lg w-full h-full"
            />
          </div>

          <!-- Informations -->
          <div class="space-y-4">
            <!-- Type et sous-types -->
            <div class="flex flex-wrap gap-2">
              <div class="badge badge-lg">{{ card.mainType }}</div>
              <div 
                v-for="subType in card.subTypes" 
                :key="subType" 
                class="badge badge-outline"
              >
                {{ subType }}
              </div>
            </div>

            <!-- Stats -->
            <div v-if="displayedStats" class="stats stats-vertical shadow w-full">
              <div v-if="displayedStats.niveau" class="stat">
                <div class="stat-title">Niveau</div>
                <div class="stat-value flex items-center gap-2">
                  {{ displayedStats.niveau.value }}
                  <span 
                    v-if="displayedStats.niveau.element !== 'neutre'"
                    :class="getElementClass(displayedStats.niveau.element)"
                    class="text-2xl"
                  >
                    <ElementIcon :element="displayedStats.niveau.element" size="sm" />
                  </span>
                </div>
              </div>
              <div v-if="displayedStats.force" class="stat">
                <div class="stat-title">Force</div>
                <div class="stat-value flex items-center gap-2">
                  {{ displayedStats.force.value }}
                  <span 
                    v-if="displayedStats.force.element !== 'neutre'"
                    :class="getElementClass(displayedStats.force.element)"
                    class="text-2xl"
                  >
                    <ElementIcon :element="displayedStats.force.element" size="sm" />
                  </span>
                </div>
              </div>
              <div v-if="displayedStats.pa" class="stat">
                <div class="stat-title">PA</div>
                <div class="stat-value">{{ displayedStats.pa }}</div>
              </div>
              <div v-if="displayedStats.pm" class="stat">
                <div class="stat-title">PM</div>
                <div class="stat-value">{{ displayedStats.pm }}</div>
              </div>
              <div v-if="displayedStats.pv" class="stat">
                <div class="stat-title">PV</div>
                <div class="stat-value">{{ displayedStats.pv }}</div>
              </div>
            </div>

            <!-- Mots-clés -->
            <div v-if="displayedKeywords?.length" class="divider">Mots-clés</div>
            <div v-if="displayedKeywords?.length" class="flex flex-wrap gap-2">
              <div 
                v-for="keyword in displayedKeywords" 
                :key="keyword.name"
                class="badge badge-lg badge-outline tooltip tooltip-top"
                :data-tip="keyword.description"
              >
                <span class="font-medium">{{ keyword.name }}</span>
                <span 
                  v-if="keyword.elements?.length"
                  class="ml-2 flex items-center gap-1"
                >
                  <span 
                    v-for="element in keyword.elements" 
                    :key="element"
                    :class="getElementClass(element)"
                    class="text-lg"
                  >
                    <ElementIcon :element="element" size="sm" />
                  </span>
                </span>
              </div>
            </div>

            <!-- Effets -->
            <div class="divider">Effets</div>
            <div class="space-y-4">
              <div 
                v-for="(effect, index) in displayedEffects" 
                :key="index"
                class="card bg-base-200"
              >
                <div class="card-body p-4">
                  <p class="text-sm">{{ effect.description }}</p>
                  <div class="flex flex-wrap gap-2 mt-2">
                    <div 
                      v-if="effect.elements?.length" 
                      class="flex items-center gap-1"
                    >
                      <span 
                        v-for="element in effect.elements" 
                        :key="element"
                        :class="getElementClass(element)"
                        class="text-lg"
                      >
                        <ElementIcon :element="element" size="sm" />
                      </span>
                    </div>
                    <div 
                      v-if="effect.isOncePerTurn" 
                      class="badge badge-sm"
                    >
                      Une fois par tour
                    </div>
                    <div 
                      v-if="effect.requiresIncline" 
                      class="badge badge-sm"
                    >
                      Nécessite d'incliner
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Informations complémentaires -->
            <div class="divider">Informations</div>
            <div class="card bg-base-200">
              <div class="card-body p-4 space-y-2">
                <!-- Extension -->
                <div class="flex items-center gap-2">
                  <span class="text-base-content/60">Extension :</span>
                  <span class="badge badge-neutral">
                    {{ card.extension.name }}
                    <span v-if="card.extension.number" class="ml-2 opacity-70">
                      #{{ card.extension.number }}
                    </span>
                  </span>
                </div>

                <!-- Artistes -->
                <div v-if="card.artists?.length" class="flex items-center gap-2">
                  <span class="text-base-content/60">Artiste(s) :</span>
                  <div class="flex flex-wrap gap-1">
                    <span 
                      v-for="artist in card.artists" 
                      :key="artist"
                      class="badge badge-ghost"
                    >
                      {{ artist }}
                    </span>
                  </div>
                </div>

                <!-- Flavor -->
                <div v-if="card.flavor" class="mt-4">
                  <blockquote class="italic text-base-content/70 border-l-4 border-primary/20 pl-4">
                    "{{ card.flavor.text }}"
                    <footer v-if="card.flavor.attribution" class="text-right mt-1">
                      - {{ card.flavor.attribution }}
                    </footer>
                  </blockquote>
                </div>
              </div>
            </div>

            <!-- Collection -->
            <div class="divider">Collection</div>
            <div class="flex items-center gap-4 bg-base-200 p-4 rounded-box">
              <div class="flex-1">
                <p class="text-sm text-base-content/70">Quantité dans la collection</p>
                <p class="text-3xl font-bold">{{ quantity }}</p>
              </div>
              <div class="join">
                <button 
                  class="join-item btn"
                  @click="$emit('remove', card)"
                >
                  -
                </button>
                <button 
                  class="join-item btn btn-primary"
                  @click="$emit('add', card)"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-action">
        <button class="btn" @click="$emit('close')">Fermer</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="$emit('close')">
      <button>Fermer</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { ref, computed, defineExpose, defineProps, defineEmits, watch } from 'vue';
import type { Card, HeroCard } from '@/types/cards';
import OptimizedImage from '@/components/common/OptimizedImage.vue';
import ElementIcon from '@/components/elements/ElementIcon.vue';
import { useCardStore } from '@/stores/cardStore';

const props = defineProps<{
  card: Card | null;
  quantity: number;
}>();

const emit = defineEmits<{
  (e: 'add', card: Card): void;
  (e: 'remove', card: Card): void;
  (e: 'close'): void;
}>();

const cardModal = ref<HTMLDialogElement | null>(null);
const showVerso = ref(false);
const cardStore = useCardStore();

const isHero = computed(() => props.card?.mainType === 'Héros');

const cardImagePath = computed(() => {
  if (!props.card) return '';
  if (isHero.value) {
    return showVerso.value ? `${props.card.id}_verso.png` : `${props.card.id}_recto.png`;
  }
  return `${props.card.id}.png`;
});

const displayedStats = computed(() => {
  if (!props.card) return null;
  if (isHero.value) {
    const heroCard = props.card as HeroCard;
    return showVerso.value ? heroCard.verso?.stats : heroCard.recto.stats;
  }
  return props.card.stats;
});

const displayedEffects = computed(() => {
  if (!props.card) return [];
  if (isHero.value) {
    const heroCard = props.card as HeroCard;
    return showVerso.value ? heroCard.verso?.effects : heroCard.recto.effects;
  }
  return props.card.effects;
});

const displayedKeywords = computed(() => {
  if (!props.card) return [];
  if (isHero.value) {
    const heroCard = props.card as HeroCard;
    return showVerso.value ? heroCard.verso?.keywords : heroCard.recto.keywords;
  }
  return props.card.keywords;
});

function getElementClass(element: string): string {
  switch (element.toLowerCase()) {
    case 'feu':
      return 'text-error';
    case 'eau':
      return 'text-primary';
    case 'air':
      return 'text-info';
    case 'terre':
      return 'text-success';
    default:
      return 'text-base-content';
  }
}

function open() {
  cardModal.value?.showModal();
}

function close() {
  cardModal.value?.close();
  showVerso.value = false;
}

// Reset verso state when card changes
watch(() => props.card, () => {
  showVerso.value = false;
});

// Expose methods to parent component
defineExpose({
  open,
  close
});
</script> 