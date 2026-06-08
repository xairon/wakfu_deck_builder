<template>
  <div class="space-y-8">
    <!-- ── EN-TÊTE ── -->
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <router-link
          to="/decks"
          class="eyebrow inline-flex items-center gap-1 text-base-content/55 hover:text-base-content"
        >
          <span aria-hidden="true">‹</span> Mes decks
        </router-link>
        <h1 class="mt-3 truncate font-display text-4xl sm:text-5xl">
          {{ deck?.name || "Deck" }}
        </h1>
        <div v-if="deck" class="mt-2 flex items-center gap-3">
          <span
            class="eyebrow"
            :class="isDeckValid ? 'text-primary' : 'text-base-content/55'"
          >
            {{ isDeckValid ? "Prêt à jouer" : "En cours" }}
          </span>
          <span class="h-3 w-px bg-base-content/25"></span>
          <span
            class="font-mono text-[11px] uppercase tracking-wider text-base-content/55"
          >
            {{ getDeckClassElement(deck) }} · modifié le
            {{ formatDate(deck.updatedAt) }}
          </span>
        </div>
      </div>

      <div v-if="deck" class="flex flex-wrap gap-2">
        <router-link
          :to="`/deck-builder/${deckId}`"
          class="btn btn-neutral gap-2"
        >
          <svg
            viewBox="0 0 24 24"
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="m16 3 5 5L8 21H3v-5L16 3Z"
            />
          </svg>
          Modifier
        </router-link>
        <button class="btn btn-outline gap-2" @click="onDuplicate">
          <svg
            viewBox="0 0 24 24"
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
          >
            <rect x="9" y="9" width="12" height="12" rx="0" />
            <path d="M5 15V5a2 2 0 0 1 2-2h8" />
          </svg>
          Dupliquer
        </button>
        <button class="btn btn-ghost gap-2" @click="shareDeck">
          <svg
            viewBox="0 0 24 24"
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
          </svg>
          Partager
        </button>
        <button
          class="btn btn-ghost gap-2"
          @click="exportImage"
          :disabled="exportingImage"
        >
          <svg
            viewBox="0 0 24 24"
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
          >
            <rect x="3" y="3" width="18" height="18" rx="0" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="m21 15-5-5L5 21"
            />
          </svg>
          Image
        </button>
        <button
          class="btn btn-ghost gap-2"
          @click="exportDeck"
          :disabled="!isDeckValid"
        >
          <svg
            viewBox="0 0 24 24"
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 15V3m0 12 4-4m-4 4-4-4M5 21h14"
            />
          </svg>
          Exporter
        </button>
      </div>
    </header>

    <div class="h-px w-full bg-base-content/80"></div>

    <div v-if="loading" class="flex justify-center py-20">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div
      v-else-if="error"
      class="border border-base-content/15 p-8 text-center"
    >
      <p class="text-error">{{ error }}</p>
      <router-link to="/decks" class="btn btn-ghost btn-sm mt-4">
        Retour aux decks
      </router-link>
    </div>

    <template v-else-if="deck">
      <!-- Notes -->
      <p
        v-if="deck.description"
        class="max-w-2xl border-l-2 border-base-content/20 pl-3 text-sm leading-relaxed text-base-content/75"
      >
        {{ deck.description }}
      </p>

      <!-- ── SPREAD DEUX PAGES ── -->
      <div class="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,18rem)_1fr]">
        <!-- ════ PAGE GAUCHE : planches + répartition ════ -->
        <div class="space-y-8 lg:border-r lg:border-base-content/15 lg:pr-10">
          <!-- Héros / Havre-sac -->
          <section>
            <p class="section-rule eyebrow">Pilier du deck</p>
            <div class="mt-4 grid grid-cols-2 gap-4">
              <!-- Héros -->
              <figure v-if="deck.hero" class="group">
                <button
                  type="button"
                  class="block w-full text-left"
                  @click="openZoom(deck.hero)"
                >
                  <div class="plate-frame" :style="{ '--spine': heroColor }">
                    <img
                      :src="
                        deck.hero.imageUrl ||
                        `/images/cards/${deck.hero.id}_recto.png`
                      "
                      :alt="deck.hero.name"
                      class="aspect-[7/10] object-cover object-[50%_18%]"
                      loading="lazy"
                      @error="onImageError"
                    />
                  </div>
                </button>
                <figcaption>
                  <p class="eyebrow mt-2 text-base-content/45">Héros</p>
                  <p class="font-display text-base leading-tight">
                    {{ deck.hero.name }}
                  </p>
                  <p class="plate-caption mt-0.5">{{ deck.hero.rarity }}</p>
                </figcaption>
              </figure>
              <div
                v-else
                class="grid aspect-[7/10] place-items-center border border-dashed border-base-content/25 text-center font-mono text-[11px] uppercase text-base-content/40"
              >
                Pas de héros
              </div>

              <!-- Havre-sac -->
              <figure v-if="deck.havreSac" class="group">
                <button
                  type="button"
                  class="block w-full text-left"
                  @click="openZoom(deck.havreSac)"
                >
                  <div class="plate-frame" :style="{ '--spine': '#98A1AF' }">
                    <img
                      :src="
                        deck.havreSac.imageUrl ||
                        `/images/cards/${deck.havreSac.id}.png`
                      "
                      :alt="deck.havreSac.name"
                      class="aspect-[7/10] object-cover object-[50%_18%]"
                      loading="lazy"
                      @error="onImageError"
                    />
                  </div>
                </button>
                <figcaption>
                  <p class="eyebrow mt-2 text-base-content/45">Havre-Sac</p>
                  <p class="font-display text-base leading-tight">
                    {{ deck.havreSac.name }}
                  </p>
                  <p class="plate-caption mt-0.5">{{ deck.havreSac.rarity }}</p>
                </figcaption>
              </figure>
              <div
                v-else
                class="grid aspect-[7/10] place-items-center border border-dashed border-base-content/25 text-center font-mono text-[11px] uppercase text-base-content/40"
              >
                Pas de havre-sac
              </div>
            </div>
          </section>

          <!-- Répartition élémentaire -->
          <section>
            <p class="section-rule eyebrow">Répartition élémentaire</p>
            <!-- Filet segmenté 1px coloré par encre élémentaire -->
            <div class="mt-4 flex h-px w-full">
              <div
                v-for="el in elementDist"
                :key="el.name"
                :style="{
                  width: (el.count / Math.max(1, totalCardCount)) * 100 + '%',
                  backgroundColor: el.color,
                }"
                :title="`${el.name}: ${el.count}`"
              ></div>
              <div
                v-if="!elementDist.length"
                class="h-px w-full bg-base-content/20"
              ></div>
            </div>
            <!-- Légende tally mono -->
            <dl class="mt-3 space-y-1.5">
              <div
                v-for="el in elementDist"
                :key="el.name"
                class="spine flex items-baseline"
                :style="{ '--spine': el.color }"
              >
                <span class="font-mono text-[12px] uppercase tracking-wide">{{
                  el.name
                }}</span>
                <span class="leader"></span>
                <span class="font-mono text-[12px] tabular">{{
                  el.count
                }}</span>
              </div>
            </dl>
          </section>

          <!-- Courbe de PA -->
          <section>
            <p class="section-rule eyebrow">Courbe de PA</p>
            <div class="mt-4 flex h-20 items-end gap-1">
              <div
                v-for="bar in costCurve"
                :key="bar.cost"
                class="flex flex-1 flex-col items-center justify-end gap-1"
                :title="`${bar.cost} PA: ${bar.count}`"
              >
                <span
                  class="font-mono text-[10px] tabular text-base-content/45"
                  >{{ bar.count }}</span
                >
                <div
                  class="w-full bg-base-content/70"
                  :style="{
                    height: (bar.count / Math.max(1, maxCostCount)) * 100 + '%',
                  }"
                ></div>
                <span
                  class="font-mono text-[10px] tabular text-base-content/55"
                  >{{ bar.cost }}</span
                >
              </div>
              <div
                v-if="!costCurve.length"
                class="self-center font-mono text-[11px] uppercase text-base-content/40"
              >
                Aucune donnée de PA
              </div>
            </div>
          </section>
        </div>

        <!-- ════ PAGE DROITE : feuille d'inventaire ════ -->
        <div class="min-w-0">
          <!-- Compteur d'effectif + bascule de tri -->
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-4">
              <div
                v-if="totalCardCount === 48"
                class="seal animate-[sealStamp_0.24s_cubic-bezier(0.2,0.7,0.2,1)_both]"
                style="transform: rotate(-3deg)"
              >
                48/48
              </div>
              <p v-else class="font-mono text-3xl tabular leading-none">
                {{ totalCardCount
                }}<span class="text-base-content/40">/48</span>
              </p>
              <p class="eyebrow text-base-content/50">Cartes consignées</p>
            </div>

            <div
              class="flex border border-base-content/30"
              role="tablist"
              aria-label="Tri des cartes"
            >
              <button
                v-for="mode in sortModes"
                :key="mode.value"
                class="border-r border-base-content/30 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wide transition-colors last:border-r-0"
                :class="
                  cardSortMode === mode.value
                    ? 'bg-base-content text-base-100'
                    : 'text-base-content/55 hover:text-base-content'
                "
                role="tab"
                :aria-selected="cardSortMode === mode.value"
                @click="cardSortMode = mode.value"
              >
                {{ mode.label }}
              </button>
            </div>
          </div>

          <div
            v-if="!deck.cards.length"
            class="mt-8 border-y border-base-content/15 py-12 text-center font-mono text-[12px] uppercase text-base-content/45"
          >
            Aucune carte dans ce deck.
          </div>

          <!-- Grouped par type -->
          <template v-else-if="cardSortMode === 'type'">
            <section
              v-for="group in cardsByType"
              :key="group.type"
              class="mt-7"
            >
              <p class="section-rule eyebrow">
                {{ group.type }} · {{ group.count }}
              </p>
              <ul class="mt-2 border-t border-base-content/15">
                <li
                  v-for="c in group.cards"
                  :key="c.card.id"
                  class="spine border-b border-base-content/15"
                  :style="{ '--spine': cardColor(c.card) }"
                >
                  <button
                    type="button"
                    class="flex w-full items-baseline gap-3 py-2 text-left hover:bg-base-200"
                    @click="openZoom(c.card)"
                  >
                    <span
                      class="w-8 shrink-0 font-mono text-sm tabular text-base-content/55"
                      >{{ c.quantity }}×</span
                    >
                    <span class="truncate font-display text-[15px]">{{
                      c.card.name
                    }}</span>
                    <span class="leader"></span>
                    <span
                      class="shrink-0 font-mono text-[11px] uppercase tracking-wide text-base-content/55"
                    >
                      {{ paLabel(c.card) }}
                    </span>
                  </button>
                </li>
              </ul>
            </section>
          </template>

          <!-- Plat (PA / nom) -->
          <template v-else>
            <section class="mt-7">
              <ul class="border-t border-base-content/15">
                <li
                  v-for="c in flatSortedCards"
                  :key="c.card.id"
                  class="spine border-b border-base-content/15"
                  :style="{ '--spine': cardColor(c.card) }"
                >
                  <button
                    type="button"
                    class="flex w-full items-baseline gap-3 py-2 text-left hover:bg-base-200"
                    @click="openZoom(c.card)"
                  >
                    <span
                      class="w-8 shrink-0 font-mono text-sm tabular text-base-content/55"
                      >{{ c.quantity }}×</span
                    >
                    <span class="truncate font-display text-[15px]">{{
                      c.card.name
                    }}</span>
                    <span class="leader"></span>
                    <span
                      class="shrink-0 font-mono text-[11px] uppercase tracking-wide text-base-content/55"
                    >
                      {{ paLabel(c.card) }}
                    </span>
                  </button>
                </li>
              </ul>
            </section>
          </template>
        </div>
      </div>

      <!-- Réserve -->
      <section v-if="reserveCards.length">
        <p class="section-rule eyebrow">
          Réserve · {{ reserveCardCount }} / 12
        </p>
        <ul class="mt-3 max-w-2xl">
          <li
            v-for="c in reserveCards"
            :key="'r-' + c.card.id"
            class="spine border-b border-base-content/10"
            :style="{ '--spine': cardColor(c.card) }"
          >
            <button
              type="button"
              class="flex w-full items-baseline gap-3 py-2 text-left hover:bg-base-200"
              @click="openZoom(c.card)"
            >
              <span
                class="w-8 shrink-0 font-mono text-sm tabular text-base-content/55"
                >{{ c.quantity }}×</span
              >
              <span class="truncate font-display text-[15px]">{{
                c.card.name
              }}</span>
              <span class="leader"></span>
              <span
                class="shrink-0 font-mono text-[11px] uppercase tracking-wide text-base-content/55"
                >{{ paLabel(c.card) }}</span
              >
            </button>
          </li>
        </ul>
      </section>

      <!-- Simulateur de pioche (goldfishing) -->
      <DeckDrawSimulator :deck="deck" />
    </template>

    <!-- Modal détail carte -->
    <CardZoomModal
      :card="zoomCard"
      :open="zoomOpen"
      @close="zoomOpen = false"
    />

    <!-- Modal export -->
    <dialog class="modal" :open="showExportModal">
      <div class="modal-box border border-base-content bg-base-100">
        <h3 class="mb-4 font-display text-xl">Exporter le deck</h3>
        <textarea
          v-model="exportedDeckText"
          class="textarea textarea-bordered h-64 w-full font-mono text-sm"
          readonly
        ></textarea>
        <div class="modal-action">
          <button class="btn btn-neutral" @click="copyExportToClipboard">
            Copier
          </button>
          <button class="btn btn-ghost" @click="showExportModal = false">
            Fermer
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showExportModal = false">Fermer</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watchEffect, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDeckStore } from "@/stores/deckStore";
import { useToast } from "@/composables/useToast";
import { generateShareUrl } from "@/utils/deckSharing";
import CardZoomModal from "@/components/card/CardZoomModal.vue";
import DeckDrawSimulator from "@/components/deck/DeckDrawSimulator.vue";
import { exportDeckImage } from "@/utils/deckImage";
import type { Card, DeckCard, Deck } from "@/types/cards";

const deckStore = useDeckStore();
const toast = useToast();
const route = useRoute();
const router = useRouter();

const loading = ref(true);
const error = ref("");
const deckId = computed(() => route.params.id as string);
const deck = computed(() => deckStore.decks.find((d) => d.id === deckId.value));
const cardSortMode = ref<"type" | "cost" | "name">("type");
const showExportModal = ref(false);
const exportedDeckText = ref("");

// Détail carte (zoom)
const zoomCard = ref<Card | null>(null);
const zoomOpen = ref(false);
function openZoom(card: Card) {
  zoomCard.value = card;
  zoomOpen.value = true;
}

const sortModes = [
  { value: "type", label: "Par type" },
  { value: "cost", label: "Par PA" },
  { value: "name", label: "Par nom" },
] as const;

const mainCards = computed(
  () => deck.value?.cards.filter((c) => !c.isReserve) ?? [],
);
const reserveCards = computed(() =>
  [...(deck.value?.cards.filter((c) => c.isReserve) ?? [])].sort(
    (a, b) => (a.card.stats?.pa || 0) - (b.card.stats?.pa || 0),
  ),
);
const totalCardCount = computed(() =>
  mainCards.value.reduce((a, c) => a + c.quantity, 0),
);
const reserveCardCount = computed(() =>
  reserveCards.value.reduce((a, c) => a + c.quantity, 0),
);
const isDeckValid = computed(
  () =>
    !!deck.value?.hero && !!deck.value?.havreSac && totalCardCount.value === 48,
);

const elementColors: Record<string, string> = {
  air: "#5FB22A",
  eau: "#1F9CEC",
  feu: "#F04E22",
  terre: "#F0A62B",
  neutre: "#98A1AF",
};
function cardElement(card: Card): string {
  return (
    card.stats?.niveau?.element ||
    card.stats?.force?.element ||
    "Neutre"
  ).toLowerCase();
}
function cardColor(card: Card): string {
  return elementColors[cardElement(card)] || elementColors.neutre;
}
const heroColor = computed(() =>
  deck.value?.hero ? cardColor(deck.value.hero) : elementColors.neutre,
);

function paLabel(card: Card): string {
  const pa = card.stats?.pa;
  const el = cardElement(card);
  const elName = el.charAt(0).toUpperCase() + el.slice(1);
  if (pa === undefined) return elName;
  return `${pa} PA · ${elName}`;
}

const elementDist = computed(() => {
  const map: Record<string, number> = {};
  for (const dc of mainCards.value) {
    const el = cardElement(dc.card);
    map[el] = (map[el] || 0) + dc.quantity;
  }
  return Object.entries(map)
    .map(([name, count]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      count,
      color: elementColors[name] || elementColors.neutre,
    }))
    .sort((a, b) => b.count - a.count);
});

const costCurve = computed(() => {
  const map: Record<number, number> = {};
  for (const dc of mainCards.value) {
    const pa = dc.card.stats?.pa;
    if (pa === undefined) continue;
    map[pa] = (map[pa] || 0) + dc.quantity;
  }
  return Object.entries(map)
    .map(([cost, count]) => ({ cost: Number(cost), count }))
    .sort((a, b) => a.cost - b.cost);
});
const maxCostCount = computed(() =>
  Math.max(1, ...costCurve.value.map((c) => c.count)),
);

const cardsByType = computed(() => {
  const map: Record<string, { count: number; cards: DeckCard[] }> = {};
  for (const dc of mainCards.value) {
    const t = dc.card.mainType;
    if (!map[t]) map[t] = { count: 0, cards: [] };
    map[t].cards.push(dc);
    map[t].count += dc.quantity;
  }
  return Object.entries(map)
    .map(([type, d]) => ({
      type,
      count: d.count,
      cards: d.cards.sort(
        (a, b) => (a.card.stats?.pa || 0) - (b.card.stats?.pa || 0),
      ),
    }))
    .sort((a, b) => b.count - a.count);
});

const flatSortedCards = computed(() => {
  const cards = [...mainCards.value];
  if (cardSortMode.value === "cost")
    return cards.sort(
      (a, b) => (a.card.stats?.pa || 0) - (b.card.stats?.pa || 0),
    );
  return cards.sort((a, b) => a.card.name.localeCompare(b.card.name));
});

onMounted(() => {
  deckStore.initialize();
  watchEffect(() => {
    if (deckStore.decks.length >= 0) {
      loading.value = false;
      if (deckId.value && !deck.value) error.value = "Deck introuvable";
      else error.value = "";
    }
  });
});

function formatDate(d: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(d));
}

function getDeckClassElement(d: Deck): string {
  if (!d.hero) return "Sans héros";
  let result = d.hero.subTypes?.[0] || "";
  const el = d.hero.stats?.niveau?.element || d.hero.stats?.force?.element;
  if (el) result += result ? ` · ${el}` : el;
  return result || "Héros";
}

function onImageError(e: Event) {
  (e.target as HTMLImageElement).src = "/images/card-back.png";
}

function onDuplicate() {
  if (!deck.value) return;
  const id = deckStore.duplicateDeck(deck.value.id);
  if (id) {
    toast.success("Deck dupliqué", { duration: 2500 });
    router.push(`/deck/${id}`);
  }
}

async function shareDeck() {
  if (!deck.value) return;
  try {
    await navigator.clipboard.writeText(generateShareUrl(deck.value));
    toast.success("Lien de partage copié !", { duration: 2500 });
  } catch {
    toast.error("Impossible de copier le lien");
  }
}

const exportingImage = ref(false);
async function exportImage() {
  if (!deck.value || exportingImage.value) return;
  exportingImage.value = true;
  try {
    await exportDeckImage(deck.value);
    toast.success("Image du deck générée", { duration: 2500 });
  } catch {
    toast.error("Impossible de générer l'image");
  } finally {
    exportingImage.value = false;
  }
}

function exportDeck() {
  if (!deck.value || !isDeckValid.value) {
    toast.warning("Le deck doit être complet pour être exporté");
    return;
  }
  exportedDeckText.value = deckStore.exportDeck(deckId.value);
  showExportModal.value = true;
}

async function copyExportToClipboard() {
  try {
    await navigator.clipboard.writeText(exportedDeckText.value);
    toast.success("Copié !", { duration: 2500 });
  } catch {
    toast.error("Impossible de copier");
  }
}
</script>
