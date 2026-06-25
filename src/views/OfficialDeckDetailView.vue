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
      <!-- Bandeau héros -->
      <header class="flex flex-col gap-6 sm:flex-row">
        <div class="w-40 shrink-0">
          <div class="plate-frame">
            <img
              :src="heroImage"
              :alt="deck.hero"
              class="aspect-[7/10] object-cover object-[50%_18%]"
              @error="onHeroError"
            />
          </div>
          <p class="plate-caption text-center">{{ deck.hero }}</p>
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
              <dt class="eyebrow">Havre-Sac</dt>
              <dd>{{ deck.havreSac }}</dd>
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
        <DeckCardGrid :groups="groups" />
      </section>
    </template>

    <CardHoverPreview />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import {
  getOfficialDeckById,
  EXTENSION_NAME_BY_SLUG,
  resolveDeckCardGroups,
} from "@/data/allOfficialDecks";
import { useCardStore } from "@/stores/cardStore";
import { useDeckStore } from "@/stores/deckStore";
import { useOfficialDeckImport } from "@/composables/useOfficialDeckImport";
import DeckMagMeta from "@/components/deck/DeckMagMeta.vue";
import DeckCardGrid from "@/components/deck/DeckCardGrid.vue";
import CardHoverPreview from "@/components/card/CardHoverPreview.vue";

const route = useRoute();
const cardStore = useCardStore();
const deckStore = useDeckStore();
const { importDeck, importingId } = useOfficialDeckImport();

const ready = ref(false);
const deck = computed(() => getOfficialDeckById(String(route.params.id)));

const cardCount = computed(
  () => deck.value?.cards.reduce((s, c) => s + c.quantity, 0) ?? 0,
);

const groups = computed(() => {
  if (!deck.value || !ready.value) return [];
  const ext = EXTENSION_NAME_BY_SLUG[deck.value.extension];
  return resolveDeckCardGroups(deck.value, (name) =>
    deckStore.findCardByName(name, undefined, ext),
  );
});

const heroImage = computed(() => {
  if (!deck.value || !ready.value) return "/images/card-back.webp";
  const ext = EXTENSION_NAME_BY_SLUG[deck.value.extension];
  const c = deckStore.findCardByName(deck.value.hero, undefined, ext);
  if (!c) return "/images/card-back.webp";
  if (c.imageUrl) return c.imageUrl;
  return `/images/cards/${c.id}_recto.webp`;
});

function onHeroError(e: Event) {
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
