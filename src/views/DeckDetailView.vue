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
          class="btn gap-2"
          :class="
            hasPendingChanges
              ? 'btn-warning'
              : isPublished
                ? 'btn-primary'
                : 'btn-ghost'
          "
          @click="openPublishModal"
        >
          <svg
            viewBox="0 0 24 24"
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
          >
            <circle cx="12" cy="12" r="9" />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18"
            />
          </svg>
          {{ publishLabel }}
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
                        `/images/cards/${deck.hero.id}_recto.webp`
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
                        `/images/cards/${deck.havreSac.id}.webp`
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
            <div
              v-if="costCurve.length && totalCardCount > 0"
              class="mt-4 flex h-28 items-end gap-1.5 pt-6"
            >
              <div
                v-for="bar in costCurve"
                :key="bar.cost"
                class="group relative flex h-full flex-1 flex-col items-center justify-end"
                tabindex="0"
              >
                <!-- Tooltip d'informations détaillées au survol / focus -->
                <div
                  class="pointer-events-none absolute bottom-full z-30 mb-2 hidden min-w-[7.5rem] flex-col items-center group-hover:flex group-focus:flex"
                >
                  <div
                    class="rounded border border-base-content/20 bg-base-300 px-2.5 py-2 text-xs shadow-xl whitespace-nowrap"
                  >
                    <div
                      class="mb-1.5 flex items-center justify-between gap-3 border-b border-base-content/15 pb-1 font-mono font-bold text-base-content"
                    >
                      <span>{{ bar.cost }} PA</span>
                      <span class="text-[11px] font-normal text-base-content/60">
                        {{ bar.count }} carte{{ bar.count > 1 ? "s" : "" }}
                      </span>
                    </div>
                    <ul
                      v-if="bar.typeBreakdown.length"
                      class="space-y-1 text-left text-[11px]"
                    >
                      <li
                        v-for="t in bar.typeBreakdown"
                        :key="t.type"
                        class="flex items-center justify-between gap-3 text-base-content/85"
                      >
                        <span>{{ pluralizeType(t.type, t.count) }}</span>
                        <span class="font-mono font-bold tabular text-primary">{{
                          t.count
                        }}</span>
                      </li>
                    </ul>
                    <p
                      v-else
                      class="py-0.5 text-[11px] italic text-base-content/40"
                    >
                      Aucune carte
                    </p>
                  </div>
                  <!-- Flèche du tooltip -->
                  <div
                    class="-mt-1 h-1.5 w-1.5 rotate-45 border-r border-b border-base-content/20 bg-base-300"
                  ></div>
                </div>

                <!-- Effectif numérique au-dessus du bâton -->
                <span
                  class="mb-1 font-mono text-[10px] font-semibold tabular transition-colors group-hover:text-primary"
                  :class="
                    bar.count > 0 ? 'text-base-content/70' : 'text-base-content/25'
                  "
                >
                  {{ bar.count }}
                </span>

                <!-- Bâton de l'histogramme -->
                <div
                  class="w-full rounded-t-sm transition-all duration-200"
                  :class="
                    bar.count > 0
                      ? 'bg-base-content/70 group-hover:bg-primary'
                      : 'bg-base-content/10'
                  "
                  :style="{
                    height:
                      bar.count > 0
                        ? Math.max(
                            6,
                            (bar.count / Math.max(1, maxCostCount)) * 100,
                          ) + '%'
                        : '2px',
                  }"
                ></div>

                <!-- Libellé du coût en PA -->
                <span
                  class="mt-1 font-mono text-[10px] font-medium tabular text-base-content/55 group-hover:text-base-content"
                >
                  {{ bar.cost }}
                </span>
              </div>
            </div>
            <div
              v-else
              class="mt-4 border border-dashed border-base-content/20 py-6 text-center font-mono text-[11px] uppercase text-base-content/40"
            >
              Aucune donnée de PA
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
            v-if="!galleryGroups.length"
            class="mt-8 border-y border-base-content/15 py-12 text-center font-mono text-[12px] uppercase text-base-content/45"
          >
            Aucune carte dans ce deck.
          </div>
          <DeckCardGrid
            v-else
            :groups="galleryGroups"
            class="mt-7"
            @select="openZoom"
          />
        </div>
      </div>

      <!-- Réserve -->
      <section v-if="reserveGroups.length">
        <DeckCardGrid :groups="reserveGroups" @select="openZoom" />
      </section>

      <!-- Simulateur de pioche (goldfishing) -->
      <DeckDrawSimulator :deck="deck" />
    </template>

    <!-- Aperçu flottant au survol -->
    <CardHoverPreview />

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

    <!-- Modal publication galerie -->
    <dialog class="modal" :open="showPublishModal">
      <div class="modal-box border border-base-content bg-base-100">
        <h3 class="mb-1 font-display text-xl">Publier dans la galerie</h3>
        <p class="mb-4 text-sm text-base-content/65">
          Ton deck apparaîtra dans « Decks de la communauté », signé de ton
          pseudo.
        </p>
        <p
          v-if="!myPseudo"
          class="mb-4 border border-warning/40 bg-warning/10 p-3 text-sm"
        >
          Définis d'abord ton pseudo public dans
          <router-link to="/profil" class="link font-medium"
            >Mon profil</router-link
          >
          — c'est lui qui signe tes decks.
        </p>
        <p v-else class="mb-4 text-sm text-base-content/65">
          Auteur : <span class="font-medium">{{ myPseudo }}</span>
        </p>
        <p
          v-if="!isDeckValid"
          class="mb-4 border border-error/40 bg-error/10 p-3 text-sm"
        >
          Deck incomplet — il faut un héros, un havre-sac et 48 cartes pour
          publier.
        </p>
        <p
          v-else-if="hasPendingChanges"
          class="mb-4 border border-warning/40 bg-warning/10 p-3 text-sm"
        >
          Des modifications de ce deck ne sont pas encore publiées. « Mettre à
          jour » remplacera la version visible dans la galerie.
        </p>
        <div class="space-y-3">
          <label class="block">
            <span class="eyebrow">Catégorie</span>
            <select
              v-model="pubSource"
              class="select select-bordered mt-1 w-full bg-base-200"
            >
              <option>Création</option>
              <option>Starter</option>
              <option>Dofus Mag</option>
              <option>Tournoi</option>
              <option>Autre</option>
            </select>
          </label>
          <label class="block">
            <span class="eyebrow">Accroche</span>
            <input
              v-model="pubTagline"
              maxlength="120"
              placeholder="En une phrase…"
              class="input input-bordered mt-1 w-full bg-base-200"
            />
          </label>
          <label class="block">
            <span class="eyebrow">Comment jouer</span>
            <textarea
              v-model="pubGuide"
              rows="5"
              placeholder="Plan de jeu, cartes clés, mulligan conseillé, forces et faiblesses…"
              class="textarea textarea-bordered mt-1 w-full"
            ></textarea>
          </label>
        </div>
        <div class="modal-action">
          <button
            v-if="isPublished"
            class="btn btn-ghost text-error"
            :disabled="publishing"
            @click="submitPublish(false)"
          >
            Retirer
          </button>
          <button
            class="btn btn-primary"
            :disabled="publishing || !myPseudo || !isDeckValid"
            @click="submitPublish(true)"
          >
            {{ publishing ? "…" : isPublished ? "Mettre à jour" : "Publier" }}
          </button>
          <button class="btn btn-ghost" @click="showPublishModal = false">
            Annuler
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showPublishModal = false">Fermer</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watchEffect, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDeckStore } from "@/stores/deckStore";
import { validateDeck } from "@/validators/deck";
import { useToast } from "@/composables/useToast";
import { generateShareUrl } from "@/utils/deckSharing";
import {
  publishDeck,
  unpublishDeck,
  getMyPublication,
  snapshotCards,
  type PublishedDeck,
} from "@/services/publicDeckService";
import { publicationSnapshotHash } from "@/utils/publicationSnapshot";
import { getMyProfile } from "@/services/profileService";
import CardZoomModal from "@/components/card/CardZoomModal.vue";
import CardHoverPreview from "@/components/card/CardHoverPreview.vue";
import DeckDrawSimulator from "@/components/deck/DeckDrawSimulator.vue";
import DeckCardGrid from "@/components/deck/DeckCardGrid.vue";
import {
  buildGalleryGroups,
  toEntry,
  type DeckGalleryGroup,
} from "@/components/deck/deckGallery";
import { cardElement, cardSpineColor, cardCost } from "@/utils/cardDisplay";
import { elementColor } from "@/config/elementColors";
import { exportDeckImage } from "@/utils/deckImage";
import type { Card, Deck } from "@/types/cards";

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
    (a, b) => cardCost(a.card) - cardCost(b.card),
  ),
);
const totalCardCount = computed(() =>
  mainCards.value.reduce((a, c) => a + c.quantity, 0),
);
const isDeckValid = computed(() =>
  deck.value ? validateDeck(deck.value).isValid : false,
);

const heroColor = computed(() =>
  deck.value?.hero ? cardSpineColor(deck.value.hero) : elementColor("neutre"),
);

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
      color: elementColor(name),
    }))
    .sort((a, b) => b.count - a.count);
});

interface CostCurveBar {
  cost: number;
  count: number;
  typeBreakdown: { type: string; count: number }[];
}

function cardTypeLabel(card: Card): string {
  if (card.subTypes?.some((s) => s.toLowerCase() === "sort")) return "Sort";
  return card.mainType;
}

function pluralizeType(type: string, count: number): string {
  if (count <= 1) return type;
  const plurals: Record<string, string> = {
    Allié: "Alliés",
    Action: "Actions",
    Sort: "Sorts",
    Équipement: "Équipements",
    Zone: "Zones",
    Salle: "Salles",
    Dofus: "Dofus",
    Protecteur: "Protecteurs",
    "Allié Élémentaire": "Alliés Élémentaires",
    "Havre-Sac": "Havres-Sacs",
    Héros: "Héros",
  };
  return plurals[type] || `${type}s`;
}

const costCurve = computed<CostCurveBar[]>(() => {
  if (!mainCards.value.length) return [];
  const map: Record<number, { count: number; byType: Record<string, number> }> =
    {};

  for (const dc of mainCards.value) {
    const pa = cardCost(dc.card);
    if (!map[pa]) {
      map[pa] = { count: 0, byType: {} };
    }
    map[pa].count += dc.quantity;
    const type = cardTypeLabel(dc.card);
    map[pa].byType[type] = (map[pa].byType[type] || 0) + dc.quantity;
  }

  const existingCosts = Object.keys(map).map(Number);
  if (existingCosts.length === 0) return [];
  const maxCost = Math.max(...existingCosts);

  const result: CostCurveBar[] = [];
  for (let cost = 0; cost <= maxCost; cost++) {
    const bucket = map[cost];
    const count = bucket ? bucket.count : 0;
    const typeBreakdown = bucket
      ? Object.entries(bucket.byType)
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count)
      : [];

    result.push({
      cost,
      count,
      typeBreakdown,
    });
  }

  return result;
});
const maxCostCount = computed(() =>
  Math.max(1, ...costCurve.value.map((c) => c.count)),
);

const galleryGroups = computed<DeckGalleryGroup[]>(() =>
  buildGalleryGroups(mainCards.value, cardSortMode.value),
);

const reserveGroups = computed<DeckGalleryGroup[]>(() => {
  if (!reserveCards.value.length) return [];
  const entries = reserveCards.value.map(toEntry);
  return [
    {
      section: "Réserve",
      total: entries.reduce((s, e) => s + e.quantity, 0),
      entries,
    },
  ];
});

onMounted(() => {
  deckStore.initialize();
  void refreshPublication();
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
  (e.target as HTMLImageElement).src = "/images/card-back.webp";
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

// ── Publication dans la galerie communautaire (snapshot découplé) ──
const publishing = ref(false);
const showPublishModal = ref(false);
const pubSource = ref("Création");
const pubTagline = ref("");
const pubGuide = ref("");
const myPseudo = ref<string | null>(null);
const myPublication = ref<PublishedDeck | null>(null);

const isPublished = computed(() => !!myPublication.value);

/** Empreinte du deck de travail (état courant). */
const workingHash = computed(() =>
  deck.value
    ? publicationSnapshotHash({
        name: deck.value.name,
        heroId: deck.value.hero?.id ?? null,
        havreSacId: deck.value.havreSac?.id ?? null,
        cards: snapshotCards(deck.value),
      })
    : "",
);
/** Empreinte du snapshot publié. */
const publishedHash = computed(() =>
  myPublication.value
    ? publicationSnapshotHash({
        name: myPublication.value.name,
        heroId: myPublication.value.hero_id,
        havreSacId: myPublication.value.havre_sac_id,
        cards: myPublication.value.cards,
      })
    : "",
);
/** Le deck de travail a divergé du snapshot publié → « modifs en attente ». */
const hasPendingChanges = computed(
  () => isPublished.value && workingHash.value !== publishedHash.value,
);

/** Libellé du bouton de publication selon l'état. */
const publishLabel = computed(() => {
  if (!isPublished.value) return "Publier";
  return hasPendingChanges.value
    ? "Mettre à jour · modifs en attente"
    : "Publié ✓ — gérer";
});

async function refreshPublication(): Promise<void> {
  myPublication.value = deckId.value
    ? await getMyPublication(deckId.value)
    : null;
}

async function openPublishModal(): Promise<void> {
  if (!deck.value) return;
  await refreshPublication();
  const p = myPublication.value;
  pubSource.value = p?.source || "Création";
  pubTagline.value = p?.tagline || deck.value.description || "";
  pubGuide.value = p?.guide || "";
  myPseudo.value = (await getMyProfile())?.username ?? null;
  showPublishModal.value = true;
}

async function submitPublish(makePublic: boolean): Promise<void> {
  if (!deck.value || publishing.value) return;

  // Garde-fou : un deck incomplet ne peut pas être publié (blocage dur).
  if (makePublic && !isDeckValid.value) {
    toast.error(
      "Deck incomplet (héros + havre-sac + 48 cartes requis) — complète-le pour publier.",
      { duration: 4000 },
    );
    return;
  }

  publishing.value = true;
  try {
    const ok = makePublic
      ? await publishDeck(deck.value, {
          source: pubSource.value.trim() || undefined,
          tagline: pubTagline.value.trim() || undefined,
          guide: pubGuide.value.trim() || undefined,
        })
      : await unpublishDeck(deck.value.id);
    if (ok) {
      await refreshPublication();
      showPublishModal.value = false;
      toast.success(
        makePublic
          ? "Deck publié — visible dans les decks de la communauté."
          : "Deck retiré de la galerie communautaire.",
        { duration: 3000 },
      );
    } else {
      toast.error("Publication impossible. Connecte-toi puis réessaie.");
    }
  } finally {
    publishing.value = false;
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
