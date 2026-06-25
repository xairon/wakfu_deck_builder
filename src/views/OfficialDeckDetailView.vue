<template>
  <div class="space-y-10">
    <router-link to="/decks/official" class="btn btn-ghost btn-sm gap-2">
      ← Decks officiels
    </router-link>

    <div v-if="!deck" class="border border-base-content/15 p-12 text-center">
      <h1 class="font-display text-2xl">Deck introuvable</h1>
      <p class="mt-2 text-base-content/70">Ce deck n'existe pas (ou plus).</p>
    </div>

    <template v-else>
      <!-- Bandeau : Héros + Havre-Sac (cartes cliquables) + infos -->
      <header class="flex flex-col gap-6 sm:flex-row">
        <div class="flex shrink-0 gap-3">
          <button
            type="button"
            class="w-32 text-left"
            :title="`${deck.hero} — voir la carte`"
            @click="openCard(heroCard)"
            @mouseenter="heroCard && preview.show(heroCard)"
            @mouseleave="preview.hide()"
          >
            <div class="plate-frame">
              <img
                :src="plateImg(heroCard)"
                :alt="deck.hero"
                class="aspect-[7/10] object-cover object-[50%_18%]"
                @error="onPlateError"
              />
            </div>
            <p class="plate-caption text-center">{{ deck.hero }}</p>
          </button>

          <button
            type="button"
            class="w-32 text-left"
            :title="`${deck.havreSac} — voir la carte`"
            @click="openCard(havreSacCard)"
            @mouseenter="havreSacCard && preview.show(havreSacCard)"
            @mouseleave="preview.hide()"
          >
            <div class="plate-frame">
              <img
                :src="plateImg(havreSacCard)"
                :alt="deck.havreSac"
                class="aspect-[7/10] object-cover"
                @error="onPlateError"
              />
            </div>
            <p class="plate-caption text-center">{{ deck.havreSac }}</p>
          </button>
        </div>

        <div class="min-w-0 flex-1">
          <p class="eyebrow text-primary">
            {{ formatExtensionName(deck.extension) }}
          </p>
          <h1 class="mt-2 font-display text-4xl leading-tight">
            {{ deck.name }}
          </h1>
          <p class="mt-2 text-base-content/70">{{ deck.description }}</p>

          <dl class="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div v-if="deck.alignment">
              <dt class="eyebrow">Alignement</dt>
              <dd>{{ deck.alignment }}</dd>
            </div>
            <div>
              <dt class="eyebrow">Cartes</dt>
              <dd class="font-mono tabular">{{ cardCount }}</dd>
            </div>
          </dl>

          <span
            v-if="deck.formatNote"
            class="mt-3 inline-flex items-center gap-1 border border-warning/50 bg-warning/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-warning"
            :title="deck.formatNote"
          >
            ⚠ Incohérence magazine
          </span>

          <div class="mt-6">
            <button
              class="btn btn-primary btn-sm gap-2"
              :disabled="importingId === deck.id"
              @click="importDeck(deck)"
            >
              {{
                importingId === deck.id
                  ? "Import en cours…"
                  : "Importer ce deck"
              }}
            </button>
          </div>
        </div>
      </header>

      <!-- Récit (lore / conseil / méta) -->
      <section class="max-w-3xl border-t border-base-content/15 pt-6">
        <DeckMagMeta :deck="deck" />
      </section>

      <!-- Cartes -->
      <section class="border-t border-base-content/15 pt-6">
        <p class="eyebrow mb-4">Cartes du deck</p>
        <DeckCardGrid :groups="groups" @select="openCard" />
      </section>
    </template>

    <CardHoverPreview />
    <CardZoomModal
      :card="zoomCard"
      :open="!!zoomCard"
      @close="zoomCard = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import type { Card } from "@/types/cards";
import {
  getOfficialDeckById,
  EXTENSION_NAME_BY_SLUG,
  resolveDeckCardGroups,
} from "@/data/allOfficialDecks";
import { useCardStore } from "@/stores/cardStore";
import { useDeckStore } from "@/stores/deckStore";
import { useCardPreview } from "@/composables/useCardPreview";
import { useOfficialDeckImport } from "@/composables/useOfficialDeckImport";
import DeckMagMeta from "@/components/deck/DeckMagMeta.vue";
import DeckCardGrid from "@/components/deck/DeckCardGrid.vue";
import CardHoverPreview from "@/components/card/CardHoverPreview.vue";
import CardZoomModal from "@/components/card/CardZoomModal.vue";

const route = useRoute();
const cardStore = useCardStore();
const deckStore = useDeckStore();
const preview = useCardPreview();
const { importDeck, importingId } = useOfficialDeckImport();

const ready = ref(false);
const deck = computed(() => getOfficialDeckById(String(route.params.id)));

// Carte ouverte en grand (toutes les infos). null = modale fermée.
const zoomCard = ref<Card | null>(null);
function openCard(card: Card | null): void {
  if (card) zoomCard.value = card;
}

const cardCount = computed(
  () => deck.value?.cards.reduce((s, c) => s + c.quantity, 0) ?? 0,
);

function resolve(name: string): Card | null {
  if (!deck.value || !ready.value) return null;
  const ext = EXTENSION_NAME_BY_SLUG[deck.value.extension];
  return deckStore.findCardByName(name, undefined, ext);
}

const heroCard = computed(() => (deck.value ? resolve(deck.value.hero) : null));
const havreSacCard = computed(() =>
  deck.value ? resolve(deck.value.havreSac) : null,
);

const groups = computed(() => {
  if (!deck.value || !ready.value) return [];
  return resolveDeckCardGroups(deck.value, resolve);
});

function plateImg(card: Card | null): string {
  if (!card) return "/images/card-back.webp";
  if (card.imageUrl) return card.imageUrl;
  return card.mainType === "Héros"
    ? `/images/cards/${card.id}_recto.webp`
    : `/images/cards/${card.id}.webp`;
}

function onPlateError(e: Event) {
  (e.target as HTMLImageElement).src = "/images/card-back.webp";
}

function formatExtensionName(ext: string): string {
  const names: Record<string, string> = {
    incarnam: "Incarnam",
    "bonta-brakmar": "Bonta & Brakmar",
    "dofus-mag": "Dofus Mag",
  };
  return names[ext] || ext;
}

onMounted(async () => {
  if (!cardStore.isInitialized) await cardStore.initialize();
  deckStore.initialize();
  ready.value = true;
});
</script>
