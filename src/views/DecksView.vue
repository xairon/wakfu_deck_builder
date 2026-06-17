<template>
  <div class="space-y-8">
    <!-- En-tête -->
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="font-display text-4xl sm:text-5xl">Mes decks</h1>
        <p
          class="mt-2 font-mono text-[11px] uppercase tabular text-base-content/60"
          style="letter-spacing: 0.12em"
        >
          {{ decks.length }} deck{{ decks.length > 1 ? "s" : "" }} ·
          {{ validCount }} valide{{ validCount > 1 ? "s" : "" }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <router-link to="/decks/official" class="btn btn-ghost gap-2">
          <svg
            viewBox="0 0 24 24"
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M14 3v5h5"
            />
          </svg>
          Decks officiels
        </router-link>
        <router-link to="/decks/community" class="btn btn-ghost gap-2">
          <svg
            viewBox="0 0 24 24"
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M17 20h5v-2a4 4 0 0 0-3-3.87M9 20H4v-2a4 4 0 0 1 3-3.87m6-1.13a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
            />
          </svg>
          Communauté
        </router-link>
        <button @click="showImportModal = true" class="btn btn-outline gap-2">
          <svg
            viewBox="0 0 24 24"
            class="h-5 w-5"
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
          Importer
        </button>
        <router-link to="/deck-builder" class="btn btn-primary gap-2">
          <svg
            viewBox="0 0 24 24"
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.9"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 5v14m-7-7h14"
            />
          </svg>
          Nouveau deck
        </router-link>
      </div>
    </header>

    <!-- Aucun deck -->
    <div
      v-if="!decks.length"
      class="border border-base-content/15 bg-base-200 px-6 py-20 text-center"
    >
      <p class="eyebrow text-primary">Registre vide</p>
      <h2 class="mt-4 font-display text-2xl">
        Votre première création vous attend
      </h2>
      <p class="mx-auto mt-2 max-w-md text-base-content/70">
        Construisez un deck de toutes pièces ou partez d'un deck officiel.
      </p>
      <div class="mt-6 flex justify-center gap-3">
        <router-link to="/deck-builder" class="btn btn-primary"
          >Créer un deck</router-link
        >
        <router-link to="/decks/official" class="btn btn-outline"
          >Voir les officiels</router-link
        >
      </div>
    </div>

    <template v-else>
      <!-- Filtres -->
      <div class="flex flex-wrap items-center gap-3">
        <label class="relative grow sm:max-w-xs">
          <svg
            viewBox="0 0 24 24"
            class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/40"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
          >
            <circle cx="11" cy="11" r="7" />
            <path stroke-linecap="round" d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="text"
            v-model="searchQuery"
            placeholder="Rechercher un deck…"
            class="input input-bordered w-full pl-9"
            aria-label="Rechercher un deck"
            @input="filterDecks"
          />
        </label>
        <select
          v-model="filterStatus"
          @change="filterDecks"
          class="select select-bordered font-mono text-xs uppercase"
          aria-label="Filtrer par statut"
        >
          <option value="all">Tous les statuts</option>
          <option value="valid">Prêts à jouer</option>
          <option value="invalid">En cours</option>
        </select>
      </div>

      <!-- Rangées-planches d'index -->
      <div
        v-if="filteredDecks.length"
        class="border-t border-base-content/15"
        aria-live="polite"
      >
        <article
          v-for="deck in filteredDecks"
          :key="deck.id"
          class="group spine relative flex cursor-pointer items-center gap-4 border-b border-base-content/15 py-4 pr-2 transition-colors hover:bg-base-200 sm:gap-5"
          :style="{ '--spine': elementColor(deck) }"
          role="button"
          tabindex="0"
          :aria-label="`Voir le deck ${deck.name}`"
          @click="goToDeck(deck.id)"
          @keydown.enter="goToDeck(deck.id)"
        >
          <!-- Planche héros -->
          <div
            class="plate-frame w-16 shrink-0 sm:w-20"
            :style="{ '--spine': elementColor(deck) }"
          >
            <img
              v-if="deck.hero"
              :src="heroArt(deck)"
              :alt="deck.hero.name"
              class="aspect-[7/10] object-cover object-[50%_18%]"
              loading="lazy"
              @error="onHeroError"
            />
            <div v-else class="plate-art aspect-[7/10] bg-base-300"></div>
          </div>

          <!-- Identité du deck -->
          <div class="min-w-0 flex-1">
            <h3 class="truncate font-display text-xl leading-tight">
              {{ deck.name }}
            </h3>
            <p
              class="mt-1 truncate font-mono text-[11px] uppercase text-base-content/60"
              style="letter-spacing: 0.08em"
            >
              {{ getDeckClassElement(deck) }}
              <span v-if="deck.isOfficial" class="text-primary">
                · Officiel</span
              >
              · {{ formatTimeAgo(deck.updatedAt) }}
            </p>
          </div>

          <!-- Compte de cartes -->
          <div class="hidden shrink-0 text-right sm:block">
            <p
              class="font-mono text-lg tabular"
              :class="
                getCardsCount(deck) === 48
                  ? 'text-base-content'
                  : 'text-base-content/55'
              "
            >
              {{ getCardsCount(deck) }} / 48
            </p>
            <p
              class="font-mono text-[10px] uppercase text-base-content/45"
              style="letter-spacing: 0.12em"
            >
              Cartes
            </p>
          </div>

          <!-- Validité : sceau ou carré d'encre -->
          <div class="shrink-0">
            <div
              v-if="isDeckValid(deck)"
              class="seal h-9 w-9 text-[9px]"
              aria-label="Deck valide"
              title="Deck prêt à jouer"
            >
              OK
            </div>
            <div
              v-else
              class="grid h-9 w-9 place-items-center"
              aria-label="Deck en cours"
              title="Deck en cours"
            >
              <span class="h-3 w-3 bg-base-content/30"></span>
            </div>
          </div>

          <!-- Actions (révélées au survol) -->
          <div
            class="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          >
            <button
              class="btn btn-ghost btn-xs btn-square"
              @click.stop="goToBuilder(deck.id)"
              aria-label="Modifier"
              title="Modifier"
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
            </button>
            <button
              class="btn btn-ghost btn-xs btn-square"
              @click.stop="onDuplicate(deck)"
              aria-label="Dupliquer"
              title="Dupliquer"
            >
              <svg
                viewBox="0 0 24 24"
                class="h-4 w-4"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
              >
                <rect x="9" y="9" width="12" height="12" rx="2" />
                <path d="M5 15V5a2 2 0 0 1 2-2h8" />
              </svg>
            </button>
            <button
              class="btn btn-ghost btn-xs btn-square"
              @click.stop="shareDeck(deck)"
              aria-label="Partager"
              title="Partager"
            >
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
            </button>
            <button
              class="btn btn-ghost btn-xs btn-square text-error"
              @click.stop="confirmDeleteDeck(deck.id, deck.name)"
              :aria-label="`Supprimer ${deck.name}`"
              title="Supprimer"
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
                  d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m1 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7"
                />
              </svg>
            </button>
            <button
              v-if="deck.isOfficial && !isDeckCardsImported(deck.id)"
              @click.stop="importDeckCards(deck.id)"
              class="btn btn-outline btn-xs ml-1 gap-1"
              :disabled="importingDecks.has(deck.id)"
              title="Importer les cartes dans la collection"
            >
              <span
                v-if="!importingDecks.has(deck.id)"
                class="flex items-center gap-1"
              >
                <svg
                  viewBox="0 0 24 24"
                  class="h-3.5 w-3.5"
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
                Importer les cartes
              </span>
              <span v-else class="loading loading-spinner loading-xs"></span>
            </button>
          </div>
        </article>
      </div>

      <div
        v-else
        class="border border-base-content/15 bg-base-200 p-6 text-center font-mono text-xs uppercase tabular text-base-content/60"
        style="letter-spacing: 0.08em"
      >
        Aucun deck ne correspond.
        <button @click="resetFilters" class="btn btn-ghost btn-xs ml-1">
          Réinitialiser
        </button>
      </div>
    </template>

    <!-- Modal d'import -->
    <dialog
      class="modal"
      :open="showImportModal"
      @keydown.escape="showImportModal = false"
    >
      <div class="modal-box border border-base-content bg-base-100">
        <p class="eyebrow text-primary">Registre</p>
        <h3 class="mb-4 mt-1 font-display text-2xl">Importer un deck</h3>
        <textarea
          id="import-deck-textarea"
          v-model="importDeckText"
          class="textarea textarea-bordered h-48 w-full font-mono text-sm"
          :placeholder="importPlaceholder"
        ></textarea>
        <div
          v-if="importSummary"
          class="mt-3 space-y-2 border border-base-content/15 bg-base-200 p-3 text-sm"
        >
          <div class="flex items-baseline">
            <span
              class="font-mono text-[11px] uppercase text-base-content/60"
              style="letter-spacing: 0.08em"
              >Héros</span
            >
            <span class="leader"></span>
            <span class="font-mono tabular">{{
              importSummary.hero || "—"
            }}</span>
          </div>
          <div class="flex items-baseline">
            <span
              class="font-mono text-[11px] uppercase text-base-content/60"
              style="letter-spacing: 0.08em"
              >Havre-Sac</span
            >
            <span class="leader"></span>
            <span class="font-mono tabular">{{
              importSummary.havreSac || "—"
            }}</span>
          </div>
          <div class="flex items-baseline">
            <span
              class="font-mono text-[11px] uppercase text-base-content/60"
              style="letter-spacing: 0.08em"
              >Cartes</span
            >
            <span class="leader"></span>
            <span class="font-mono tabular"
              >{{ importSummary.cardCount }} / 48</span
            >
          </div>
          <div
            v-if="importSummary.errors.length"
            class="font-mono text-[11px] uppercase text-error"
            style="letter-spacing: 0.08em"
          >
            {{ importSummary.errors.length }} avertissement(s)
          </div>
        </div>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="showImportModal = false">
            Annuler
          </button>
          <button
            class="btn btn-primary"
            @click="confirmImportDeck"
            :disabled="!importDeckText.trim()"
          >
            Importer
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showImportModal = false">Fermer</button>
      </form>
    </dialog>

    <!-- Modal d'export -->
    <dialog
      class="modal"
      :open="showExportModal"
      @keydown.escape="showExportModal = false"
    >
      <div class="modal-box border border-base-content bg-base-100">
        <p class="eyebrow text-primary">Registre</p>
        <h3 class="mb-4 mt-1 font-display text-2xl">Exporter le deck</h3>
        <textarea
          v-model="exportedDeckText"
          class="textarea textarea-bordered h-64 w-full font-mono text-sm"
          readonly
        ></textarea>
        <div class="modal-action flex-wrap gap-2">
          <button class="btn btn-outline" @click="copyShareLinkFromExport">
            Copier le lien
          </button>
          <button class="btn btn-primary" @click="copyExportToClipboard">
            Copier le texte
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
import { ref, computed, onMounted, watch } from "vue";
import { matchesSearch } from "@/utils/text";
import { useDeckStore } from "@/stores/deckStore";
import { useToast } from "@/composables/useToast";
import { useRouter } from "vue-router";
import { useCardStore } from "@/stores/cardStore";
import {
  importDeckCardsToCollection,
  isDeckCardsImported as checkDeckCardsImported,
} from "@/services/starterService";
import { generateShareUrl } from "@/utils/deckSharing";
import type { Deck } from "@/types/cards";
import { validateDeck } from "@/validators/deck";

const deckStore = useDeckStore();
const cardStore = useCardStore();
const toast = useToast();
const router = useRouter();

const searchQuery = ref("");
const filterStatus = ref("all");
const showImportModal = ref(false);
const showExportModal = ref(false);
const importDeckText = ref("");
const importPlaceholder = `# Deck Feu Aggro
1 Trantmy Londami (Héros)
1 Havre-sac du Wabbit (Havre-Sac)
3 Cawotte`;
const importSummary = ref<{
  hero: string | null;
  havreSac: string | null;
  cardCount: number;
  errors: string[];
} | null>(null);
const exportedDeckText = ref("");
const currentExportDeckId = ref("");
const importingDecks = ref(new Set<string>());

const decks = computed(() => deckStore.decks);
const validCount = computed(() => decks.value.filter(isDeckValid).length);
const filteredDecks = ref<Deck[]>([]);

onMounted(() => {
  deckStore.initialize();
  filterDecks();
});

watch(decks, filterDecks, { deep: true });
watch(importDeckText, analyzeImportText);

// ── Navigation ──
function goToDeck(id: string) {
  router.push(`/deck/${id}`);
}
function goToBuilder(id: string) {
  router.push(`/deck-builder/${id}`);
}

// ── Visuels ──
const elementColors: Record<string, string> = {
  air: "#5FB22A",
  eau: "#1F9CEC",
  feu: "#F04E22",
  terre: "#F0A62B",
  neutre: "#98A1AF",
};
function deckElementName(deck: Deck): string {
  return (
    deck.hero?.stats?.niveau?.element ||
    deck.hero?.stats?.force?.element ||
    "neutre"
  ).toLowerCase();
}
function elementColor(deck: Deck): string {
  return elementColors[deckElementName(deck)] || elementColors.neutre;
}
function heroArt(deck: Deck): string {
  if (!deck.hero) return "/images/card-back.webp";
  return deck.hero.imageUrl || `/images/cards/${deck.hero.id}_recto.webp`;
}
function onHeroError(e: Event) {
  (e.target as HTMLImageElement).src = "/images/card-back.webp";
}

// ── Duplication ──
function onDuplicate(deck: Deck) {
  const id = deckStore.duplicateDeck(deck.id);
  if (id) {
    toast.success(`Deck « ${deck.name} » dupliqué`, { duration: 2500 });
    filterDecks();
  }
}

function analyzeImportText() {
  if (!importDeckText.value.trim()) {
    importSummary.value = null;
    return;
  }
  const rawText = importDeckText.value;
  const entryRegex = /^\s*(\d+)\s+(.+?)(?:\s+\((.+?)\))?\s*$/gm;
  const summary = {
    hero: null as string | null,
    havreSac: null as string | null,
    cardCount: 0,
    errors: [] as string[],
  };
  let totalCards = 0;
  for (const match of rawText.matchAll(entryRegex)) {
    const cardName = match[2];
    const cardType = match[3] || undefined;
    const quantity = parseInt(match[1]);
    const card = deckStore.findCardByName
      ? deckStore.findCardByName(cardName, cardType)
      : null;
    if (!card) {
      summary.errors.push(`Carte "${cardName}" non trouvée`);
      continue;
    }
    if (card.mainType === "Héros") summary.hero = cardName;
    else if (card.mainType === "Havre-Sac") summary.havreSac = cardName;
    else totalCards += quantity;
  }
  summary.cardCount = totalCards;
  importSummary.value = summary;
}

function filterDecks() {
  let filtered = [...decks.value];
  if (searchQuery.value) {
    const q = searchQuery.value;
    filtered = filtered.filter((d) => matchesSearch(d.name, q));
  }
  if (filterStatus.value === "valid")
    filtered = filtered.filter((d) => isDeckValid(d));
  else if (filterStatus.value === "invalid")
    filtered = filtered.filter((d) => !isDeckValid(d));
  filteredDecks.value = filtered;
}

function resetFilters() {
  searchQuery.value = "";
  filterStatus.value = "all";
  filterDecks();
}

function isDeckValid(deck: Deck): boolean {
  // Source unique de vérité : mêmes règles que l'atelier (Héros+Havre-Sac,
  // 48 cartes, copies, réserve 0/12).
  return validateDeck(deck).isValid;
}

function getCardsCount(deck: Deck): number {
  if (!Array.isArray(deck.cards)) return 0;
  return deck.cards
    .filter((c) => !c.isReserve)
    .reduce((acc, c) => acc + c.quantity, 0);
}

function getDeckClassElement(deck: Deck): string {
  if (!deck.hero) return "Sans héros";
  let result = "";
  if (deck.hero.subTypes && deck.hero.subTypes.length > 0)
    result = deck.hero.subTypes[0];
  const element =
    deck.hero.stats?.niveau?.element || deck.hero.stats?.force?.element;
  if (element) result += result ? ` · ${element}` : element;
  return result || "Héros";
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
}

function confirmDeleteDeck(deckId: string, deckName: string) {
  if (confirm(`Supprimer le deck « ${deckName} » ?`)) {
    deckStore.deleteDeck(deckId);
    toast.success(`Deck « ${deckName} » supprimé`, { duration: 2500 });
    filterDecks();
  }
}

function exportDeck(deckId: string) {
  const deck = decks.value.find((d) => d.id === deckId);
  if (!deck) return;
  exportedDeckText.value = deckStore.exportDeck(deckId);
  currentExportDeckId.value = deckId;
  showExportModal.value = true;
}

async function copyExportToClipboard() {
  try {
    await navigator.clipboard.writeText(exportedDeckText.value);
    toast.success("Copié dans le presse-papier", { duration: 2500 });
  } catch {
    toast.error("Impossible de copier");
  }
}

function confirmImportDeck() {
  if (!importDeckText.value.trim()) return;
  const result = deckStore.importDeck(importDeckText.value);
  if (result.success && result.deckId) {
    if (result.warnings.length)
      toast.warning(result.warnings.join("\n"), { duration: 5000 });
    toast.success("Deck importé !", { duration: 3000 });
    showImportModal.value = false;
    importDeckText.value = "";
    filterDecks();
    router.push(`/deck/${result.deckId}`);
  } else {
    toast.error(result.errors.join("\n") || "Import impossible", {
      duration: 6000,
    });
  }
}

async function shareDeck(deck: Deck) {
  try {
    await navigator.clipboard.writeText(generateShareUrl(deck));
    toast.success("Lien de partage copié !", { duration: 2500 });
  } catch {
    toast.error("Impossible de copier le lien");
  }
}

async function copyShareLinkFromExport() {
  const deck = decks.value.find((d) => d.id === currentExportDeckId.value);
  if (!deck) return;
  await shareDeck(deck);
}

function isDeckCardsImported(deckId: string): boolean {
  return checkDeckCardsImported(deckId);
}

async function importDeckCards(deckId: string) {
  importingDecks.value.add(deckId);
  try {
    const result = await importDeckCardsToCollection(deckId);
    if (result.errors.length === 0) {
      toast.success(`${result.cardsAdded} cartes ajoutées`, { duration: 4000 });
    } else {
      toast.warning(
        `Import terminé avec ${result.errors.length} erreurs (${result.cardsAdded} ajoutées)`,
        { duration: 6000 },
      );
    }
    filterDecks();
  } catch (err) {
    toast.error(`Erreur d'import: ${err}`);
  } finally {
    importingDecks.value.delete(deckId);
  }
}

// référence conservée pour l'analyse de l'import
void cardStore;
</script>
