<template>
  <div class="mx-auto max-w-5xl space-y-8 p-4 md:p-6">
    <!-- ── EN-TÊTE ── -->
    <header class="min-w-0">
      <router-link
        to="/decks"
        class="eyebrow inline-flex items-center gap-1 text-base-content/55 hover:text-base-content"
      >
        <span aria-hidden="true">‹</span> Mes decks
      </router-link>
      <h1 class="mt-3 truncate font-display text-4xl sm:text-5xl">
        {{ decodedData?.name || "Deck partagé" }}
      </h1>
      <div class="mt-2 flex items-center gap-3">
        <span class="eyebrow text-primary">Partagé avec vous</span>
        <span
          v-if="decodedData"
          class="h-3 w-px bg-base-content/25"
          aria-hidden="true"
        ></span>
        <span
          v-if="decodedData"
          class="font-mono text-[11px] uppercase tracking-wider text-base-content/55"
        >
          Prévisualisation · importez pour ajouter à vos decks
        </span>
      </div>
    </header>

    <div class="h-px w-full bg-base-content/80"></div>

    <!-- ── CHARGEMENT ── -->
    <div v-if="loading" class="flex justify-center py-20">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- ── ERREUR ── -->
    <div
      v-else-if="errorMessage"
      class="border border-base-content/15 p-8 text-center"
    >
      <p class="eyebrow text-error">Impossible de charger le deck</p>
      <p class="mt-3 text-sm text-base-content/70">{{ errorMessage }}</p>
      <router-link to="/decks" class="btn btn-ghost btn-sm mt-5 gap-2">
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
            d="M19 12H5m0 0 6-6m-6 6 6 6"
          />
        </svg>
        Retourner à mes decks
      </router-link>
    </div>

    <!-- ── APERÇU DU DECK ── -->
    <template v-else-if="decodedData">
      <!-- Barre d'action : effectif + import -->
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
            {{ totalCardCount }}<span class="text-base-content/40">/48</span>
          </p>
          <p class="eyebrow text-base-content/50">Cartes consignées</p>
        </div>

        <button
          class="btn btn-primary gap-2"
          :disabled="importing"
          @click="importSharedDeck"
        >
          <svg
            v-if="!importing"
            viewBox="0 0 24 24"
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"
            />
          </svg>
          <span
            v-else
            class="loading loading-spinner loading-sm"
            aria-hidden="true"
          ></span>
          {{ importing ? "Importation…" : "Importer ce deck" }}
        </button>
      </div>

      <!-- ── SPREAD DEUX PAGES ── -->
      <div class="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,18rem)_1fr]">
        <!-- ════ PAGE GAUCHE : planches + répartition ════ -->
        <div class="space-y-8 lg:border-r lg:border-base-content/15 lg:pr-10">
          <!-- Héros / Havre-sac -->
          <section>
            <p class="section-rule eyebrow">Pilier du deck</p>
            <div class="mt-4 grid grid-cols-2 gap-4">
              <!-- Héros -->
              <figure v-if="resolvedHero" class="group">
                <button
                  type="button"
                  class="block w-full text-left"
                  @click="openZoom(resolvedHero)"
                >
                  <div class="plate-frame" :style="{ '--spine': heroColor }">
                    <img
                      :src="
                        resolvedHero.imageUrl ||
                        `/images/cards/${resolvedHero.id}_recto.png`
                      "
                      :alt="resolvedHero.name"
                      class="aspect-[7/10] object-cover object-[50%_18%]"
                      loading="lazy"
                      @error="onImageError"
                    />
                  </div>
                </button>
                <figcaption>
                  <p class="eyebrow mt-2 text-base-content/45">Héros</p>
                  <p class="font-display text-base leading-tight">
                    {{ resolvedHero.name }}
                  </p>
                  <p class="plate-caption mt-0.5">{{ resolvedHero.rarity }}</p>
                </figcaption>
              </figure>
              <div
                v-else
                class="grid aspect-[7/10] place-items-center border border-dashed border-base-content/25 px-2 text-center font-mono text-[11px] uppercase text-base-content/40"
              >
                {{ decodedData.heroId ? "Héros introuvable" : "Pas de héros" }}
              </div>

              <!-- Havre-Sac -->
              <figure v-if="resolvedHavreSac" class="group">
                <button
                  type="button"
                  class="block w-full text-left"
                  @click="openZoom(resolvedHavreSac)"
                >
                  <div class="plate-frame" :style="{ '--spine': '#98A1AF' }">
                    <img
                      :src="
                        resolvedHavreSac.imageUrl ||
                        `/images/cards/${resolvedHavreSac.id}.png`
                      "
                      :alt="resolvedHavreSac.name"
                      class="aspect-[7/10] object-cover object-[50%_18%]"
                      loading="lazy"
                      @error="onImageError"
                    />
                  </div>
                </button>
                <figcaption>
                  <p class="eyebrow mt-2 text-base-content/45">Havre-Sac</p>
                  <p class="font-display text-base leading-tight">
                    {{ resolvedHavreSac.name }}
                  </p>
                  <p class="plate-caption mt-0.5">
                    {{ resolvedHavreSac.rarity }}
                  </p>
                </figcaption>
              </figure>
              <div
                v-else
                class="grid aspect-[7/10] place-items-center border border-dashed border-base-content/25 px-2 text-center font-mono text-[11px] uppercase text-base-content/40"
              >
                {{
                  decodedData.havreSacId
                    ? "Havre-Sac introuvable"
                    : "Pas de havre-sac"
                }}
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

          <!-- Synthèse -->
          <section>
            <p class="section-rule eyebrow">Synthèse</p>
            <dl class="mt-3 space-y-1.5">
              <div class="flex items-baseline">
                <span class="font-mono text-[12px] uppercase tracking-wide"
                  >Cartes uniques</span
                >
                <span class="leader"></span>
                <span class="font-mono text-[12px] tabular">{{
                  resolvedCards.length
                }}</span>
              </div>
              <div class="flex items-baseline">
                <span class="font-mono text-[12px] uppercase tracking-wide"
                  >Total</span
                >
                <span class="leader"></span>
                <span class="font-mono text-[12px] tabular"
                  >{{ totalCardCount }} / 48</span
                >
              </div>
            </dl>
          </section>
        </div>

        <!-- ════ PAGE DROITE : feuille d'inventaire ════ -->
        <div class="min-w-0">
          <div
            v-if="resolvedCards.length === 0"
            class="border-y border-base-content/15 py-12 text-center font-mono text-[12px] uppercase text-base-content/45"
          >
            Aucune carte dans ce deck.
          </div>

          <!-- Grouped par type -->
          <template v-else>
            <section
              v-for="group in cardsByType"
              :key="group.type"
              class="mt-7 first:mt-0"
            >
              <p class="section-rule eyebrow">
                {{ group.type }} · {{ group.count }}
              </p>
              <ul class="mt-2 border-t border-base-content/15">
                <li
                  v-for="item in group.cards"
                  :key="item.card.id"
                  class="spine border-b border-base-content/15"
                  :style="{ '--spine': cardColor(item.card) }"
                >
                  <button
                    type="button"
                    class="flex w-full items-baseline gap-3 py-2 text-left hover:bg-base-200"
                    @click="openZoom(item.card)"
                  >
                    <span
                      class="w-8 shrink-0 font-mono text-sm tabular text-base-content/55"
                      >{{ item.quantity }}×</span
                    >
                    <span class="truncate font-display text-[15px]">{{
                      item.card.name
                    }}</span>
                    <span class="leader"></span>
                    <span
                      class="shrink-0 font-mono text-[11px] uppercase tracking-wide text-base-content/55"
                    >
                      {{ paLabel(item.card) }}
                    </span>
                  </button>
                </li>
              </ul>
            </section>
          </template>

          <!-- Cartes non résolues -->
          <section v-if="unresolvedCards.length > 0" class="mt-7">
            <p class="section-rule eyebrow text-base-content/45">
              Non trouvées · {{ unresolvedCards.length }}
            </p>
            <ul class="mt-2 border-t border-base-content/15">
              <li
                v-for="card in unresolvedCards"
                :key="card.cardId"
                class="flex items-baseline gap-3 border-b border-base-content/15 py-2"
              >
                <span
                  class="w-8 shrink-0 font-mono text-sm tabular text-base-content/40"
                  >{{ card.quantity }}×</span
                >
                <span
                  class="truncate font-mono text-[12px] text-base-content/50"
                  >ID {{ card.cardId }}</span
                >
              </li>
            </ul>
          </section>

          <!-- Import bas de page -->
          <div class="mt-8 flex justify-center">
            <button
              class="btn btn-primary btn-wide gap-2"
              :disabled="importing"
              @click="importSharedDeck"
            >
              <svg
                v-if="!importing"
                viewBox="0 0 24 24"
                class="h-4 w-4"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"
                />
              </svg>
              <span
                v-else
                class="loading loading-spinner loading-sm"
                aria-hidden="true"
              ></span>
              {{ importing ? "Importation…" : "Importer ce deck" }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Modal détail carte -->
    <CardZoomModal
      :card="zoomCard"
      :open="zoomOpen"
      @close="zoomOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDeckStore } from "@/stores/deckStore";
import { useCardStore } from "@/stores/cardStore";
import { useToast } from "@/composables/useToast";
import { decodeDeck } from "@/utils/deckSharing";
import CardZoomModal from "@/components/card/CardZoomModal.vue";
import type { DecodedDeckData } from "@/utils/deckSharing";
import type { Card } from "@/types/cards";

const route = useRoute();
const router = useRouter();
const deckStore = useDeckStore();
const cardStore = useCardStore();
const toast = useToast();

// Etat local
const loading = ref(true);
const importing = ref(false);
const errorMessage = ref("");
const decodedData = ref<DecodedDeckData | null>(null);

// Détail carte (zoom)
const zoomCard = ref<Card | null>(null);
const zoomOpen = ref(false);
function openZoom(card: Card) {
  zoomCard.value = card;
  zoomOpen.value = true;
}

// Encres élémentaires (épines / filets / swatches)
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
function paLabel(card: Card): string {
  const pa = card.stats?.pa;
  const el = cardElement(card);
  const elName = el.charAt(0).toUpperCase() + el.slice(1);
  if (pa === undefined) return elName;
  return `${pa} PA · ${elName}`;
}

// Resolution des cartes par ID
const resolvedHero = computed<Card | null>(() => {
  if (!decodedData.value?.heroId) return null;
  return (
    cardStore.cards.find((c) => c.id === decodedData.value!.heroId) ?? null
  );
});

const resolvedHavreSac = computed<Card | null>(() => {
  if (!decodedData.value?.havreSacId) return null;
  return (
    cardStore.cards.find((c) => c.id === decodedData.value!.havreSacId) ?? null
  );
});

interface ResolvedCard {
  card: Card;
  quantity: number;
}

const resolvedCards = computed<ResolvedCard[]>(() => {
  if (!decodedData.value) return [];
  const result: ResolvedCard[] = [];
  for (const entry of decodedData.value.cards) {
    const card = cardStore.cards.find((c) => c.id === entry.cardId);
    if (card) {
      result.push({ card, quantity: entry.quantity });
    }
  }
  return result;
});

const unresolvedCards = computed(() => {
  if (!decodedData.value) return [];
  return decodedData.value.cards.filter(
    (entry) => !cardStore.cards.find((c) => c.id === entry.cardId),
  );
});

const totalCardCount = computed(() => {
  return resolvedCards.value.reduce((acc, item) => acc + item.quantity, 0);
});

const heroColor = computed(() =>
  resolvedHero.value ? cardColor(resolvedHero.value) : elementColors.neutre,
);

// Répartition élémentaire (filet segmenté + légende)
const elementDist = computed(() => {
  const map: Record<string, number> = {};
  for (const item of resolvedCards.value) {
    const el = cardElement(item.card);
    map[el] = (map[el] || 0) + item.quantity;
  }
  return Object.entries(map)
    .map(([name, count]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      count,
      color: elementColors[name] || elementColors.neutre,
    }))
    .sort((a, b) => b.count - a.count);
});

// Grouper les cartes par type
const cardsByType = computed(() => {
  const typeMap: Record<string, { count: number; cards: ResolvedCard[] }> = {};

  for (const item of resolvedCards.value) {
    const type = item.card.mainType;
    if (!typeMap[type]) {
      typeMap[type] = { count: 0, cards: [] };
    }
    typeMap[type].cards.push(item);
    typeMap[type].count += item.quantity;
  }

  return Object.entries(typeMap)
    .map(([type, data]) => ({
      type,
      count: data.count,
      cards: data.cards.sort((a, b) => {
        const costA = a.card.stats?.pa || 0;
        const costB = b.card.stats?.pa || 0;
        if (costA !== costB) return costA - costB;
        return a.card.name.localeCompare(b.card.name);
      }),
    }))
    .sort((a, b) => a.type.localeCompare(b.type));
});

// Initialisation
onMounted(async () => {
  try {
    // S'assurer que le cardStore est initialise
    if (!cardStore.isInitialized) {
      await cardStore.initialize();
    }
    deckStore.initialize();

    // Recuperer le parametre 'deck' de l'URL
    const deckParam = route.query.deck as string | undefined;
    if (!deckParam) {
      errorMessage.value =
        'Aucun deck specifie dans le lien. Le parametre "deck" est manquant.';
      loading.value = false;
      return;
    }

    // Decoder le deck
    const decoded = decodeDeck(deckParam);
    if (!decoded) {
      errorMessage.value =
        "Le lien de partage est invalide ou corrompu. Impossible de decoder les donnees du deck.";
      loading.value = false;
      return;
    }

    decodedData.value = decoded;
  } catch (err) {
    console.error("Erreur lors du chargement du deck partage:", err);
    errorMessage.value =
      "Une erreur inattendue est survenue lors du chargement du deck.";
  } finally {
    loading.value = false;
  }
});

// Importer le deck dans le deckStore
function importSharedDeck() {
  if (!decodedData.value) return;
  importing.value = true;

  try {
    // Creer un nouveau deck
    const deckId = deckStore.createDeck(decodedData.value.name);
    deckStore.setCurrentDeck(deckId);

    // Ajouter le heros
    if (resolvedHero.value) {
      deckStore.setHero(resolvedHero.value);
    }

    // Ajouter le havre-sac
    if (resolvedHavreSac.value) {
      deckStore.setHavreSac(resolvedHavreSac.value);
    }

    // Ajouter les cartes
    for (const item of resolvedCards.value) {
      deckStore.addCard(item.card, item.quantity);
    }

    toast.success(`Deck "${decodedData.value.name}" importe avec succes !`, {
      title: "Importation reussie",
      duration: 4000,
    });

    // Rediriger vers le deck importe
    router.push(`/deck/${deckId}`);
  } catch (err) {
    console.error("Erreur lors de l'importation du deck:", err);
    toast.error("Une erreur est survenue lors de l'importation du deck.", {
      title: "Erreur",
      duration: 5000,
    });
  } finally {
    importing.value = false;
  }
}

// Utilitaires
function onImageError(event: Event) {
  const target = event.target as HTMLImageElement;
  if (target) {
    target.src = "/images/card-back.png";
  }
}
</script>
