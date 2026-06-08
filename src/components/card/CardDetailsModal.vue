<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    @click.self="$emit('close')"
  >
    <div
      class="modal-box max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-base-content bg-base-100 p-6"
    >
      <!-- En-tête -->
      <div class="mb-5 flex items-start justify-between gap-3">
        <div class="spine" :style="{ '--spine': elementColor }">
          <p class="eyebrow text-base-content/50">
            {{ card?.mainType || card?.type }}
          </p>
          <h2 class="font-display text-2xl leading-tight">{{ card?.name }}</h2>
        </div>
        <button
          class="btn btn-ghost btn-sm shrink-0 px-2"
          @click="$emit('close')"
          aria-label="Fermer"
        >
          <svg
            viewBox="0 0 24 24"
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <!-- Contenu -->
      <div v-if="card" class="grid gap-6 sm:grid-cols-[auto_1fr]">
        <!-- Planche montée -->
        <div class="sm:w-44">
          <div class="plate-frame" :style="{ '--spine': elementColor }">
            <img
              :src="cardImg"
              :alt="card.name"
              class="aspect-[7/10] object-cover"
              @error="onImgError"
            />
          </div>
          <p class="plate-caption text-center">
            {{
              typeof card.extension === "string"
                ? card.extension
                : card.extension.name
            }}
          </p>
        </div>

        <!-- Fiche -->
        <div class="min-w-0 space-y-5">
          <!-- Caractéristiques (mono tabulaire) -->
          <dl
            v-if="displayedStats"
            class="grid grid-cols-2 gap-x-6 gap-y-2 border-y border-base-content/15 py-3"
          >
            <div
              v-if="displayedStats.niveau"
              class="flex items-center justify-between gap-2"
            >
              <dt class="eyebrow text-base-content/50">Niveau</dt>
              <dd class="font-mono text-sm tabular">
                <StatWithElement
                  :value="displayedStats.niveau.value"
                  :element="displayedStats.niveau.element"
                />
              </dd>
            </div>
            <div
              v-if="displayedStats.force"
              class="flex items-center justify-between gap-2"
            >
              <dt class="eyebrow text-base-content/50">Force</dt>
              <dd class="font-mono text-sm tabular">
                <StatWithElement
                  :value="displayedStats.force.value"
                  :element="displayedStats.force.element"
                />
              </dd>
            </div>
            <div
              v-if="displayedStats.pa !== undefined"
              class="flex items-center justify-between gap-2"
            >
              <dt class="eyebrow text-base-content/50">PA</dt>
              <dd class="font-mono text-sm tabular">{{ displayedStats.pa }}</dd>
            </div>
            <div
              v-if="displayedStats.pm !== undefined"
              class="flex items-center justify-between gap-2"
            >
              <dt class="eyebrow text-base-content/50">PM</dt>
              <dd class="font-mono text-sm tabular">{{ displayedStats.pm }}</dd>
            </div>
            <div
              v-if="displayedStats.pv !== undefined"
              class="flex items-center justify-between gap-2"
            >
              <dt class="eyebrow text-base-content/50">PV</dt>
              <dd class="font-mono text-sm tabular">{{ displayedStats.pv }}</dd>
            </div>
          </dl>

          <!-- Effets -->
          <div v-if="card.effects?.length">
            <p class="section-rule eyebrow mb-2">Effets</p>
            <ul class="space-y-2">
              <li
                v-for="(effect, index) in card.effects"
                :key="index"
                class="border-l-2 border-base-content/20 pl-3 text-sm leading-relaxed"
              >
                {{ typeof effect === "string" ? effect : effect.description }}
              </li>
            </ul>
          </div>

          <!-- Mots-clés -->
          <div v-if="card.keywords?.length">
            <p class="section-rule eyebrow mb-2">Mots-clés</p>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="keyword in card.keywords"
                :key="keyword.name"
                class="inline-flex items-center gap-1 border border-base-content/30 px-2 py-0.5 font-mono text-[11px] uppercase"
                :title="keyword.description"
              >
                {{ keyword.name }}
                <span
                  v-if="keyword.elements?.length"
                  class="inline-flex items-center gap-1"
                >
                  <ElementIcon
                    v-for="element in keyword.elements"
                    :key="element"
                    :element="element"
                    size="sm"
                  />
                </span>
              </span>
            </div>
          </div>

          <!-- Citation -->
          <p
            v-if="card.flavor"
            class="border-l-2 border-primary pl-3 font-display text-sm italic text-base-content/70"
          >
            « {{ card.flavor.text }} »
            <span v-if="card.flavor.attribution" class="not-italic"
              >— {{ card.flavor.attribution }}</span
            >
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Card } from "@/types/cards";
import StatWithElement from "@/components/elements/StatWithElement.vue";
import ElementIcon from "@/components/elements/ElementIcon.vue";

const props = defineProps<{
  card: Card | null;
  isOpen: boolean;
}>();

defineEmits<{
  (e: "close"): void;
}>();

const elementColors: Record<string, string> = {
  air: "#5FB22A",
  eau: "#1F9CEC",
  feu: "#F04E22",
  terre: "#F0A62B",
  neutre: "#98A1AF",
};

const displayedStats = computed(() => props.card?.stats ?? null);

const elementColor = computed(() => {
  const el = (
    props.card?.stats?.niveau?.element ||
    props.card?.stats?.force?.element ||
    "neutre"
  )
    .toString()
    .toLowerCase();
  return elementColors[el] || elementColors.neutre;
});

const cardImg = computed(() => {
  const c = props.card;
  if (!c) return "/images/card-back.png";
  if (c.imageUrl) return c.imageUrl;
  if (c.mainType === "Héros") return `/images/cards/${c.id}_recto.png`;
  return `/images/cards/${c.id}.png`;
});

function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = "/images/card-back.png";
}
</script>
