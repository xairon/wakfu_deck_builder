<template>
  <div class="space-y-6">
    <!-- En-tête -->
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <router-link
          to="/decks"
          class="eyebrow inline-flex items-center gap-1.5 text-base-content/55 transition-colors hover:text-base-content"
        >
          <svg
            viewBox="0 0 24 24"
            class="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15 18l-6-6 6-6"
            />
          </svg>
          Mes decks
        </router-link>
        <h1 class="mt-2 font-display text-3xl leading-none sm:text-4xl">
          Atelier de deck
        </h1>
      </div>

      <!-- Sélecteur de deck -->
      <select
        v-if="decks.length > 1"
        class="select select-bordered select-sm max-w-[14rem]"
        :value="currentDeck?.id"
        @change="switchDeck(($event.target as HTMLSelectElement).value)"
        aria-label="Changer de deck"
      >
        <option v-for="d in decks" :key="d.id" :value="d.id">
          {{ d.name }}
        </option>
      </select>
    </header>

    <!-- Onglets mobile — masqués sur xl (deux volets côte à côte) -->
    <div
      class="flex xl:hidden"
      role="tablist"
      aria-label="Vues du constructeur"
    >
      <button
        role="tab"
        :aria-pressed="mobileTab === 'pool'"
        :class="[
          'flex-1 border-b-2 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-colors',
          mobileTab === 'pool'
            ? 'border-base-content text-base-content'
            : 'border-base-content/20 text-base-content/45 hover:text-base-content/70',
        ]"
        data-testid="mobile-tab-pool"
        @click="mobileTab = 'pool'"
      >
        Bestiaire
      </button>
      <button
        role="tab"
        :aria-pressed="mobileTab === 'deck'"
        :class="[
          'flex-1 border-b-2 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-colors',
          mobileTab === 'deck'
            ? 'border-base-content text-base-content'
            : 'border-base-content/20 text-base-content/45 hover:text-base-content/70',
        ]"
        data-testid="mobile-tab-deck"
        @click="mobileTab = 'deck'"
      >
        Deck
        <span class="ml-1 tabular">{{ cardCount }}/48</span>
      </button>
    </div>

    <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_370px]">
      <!-- ─────────── Vivier de cartes ─────────── -->
      <section
        class="min-w-0"
        :class="mobileTab === 'pool' ? 'block' : 'hidden xl:block'"
        data-testid="pool-section"
      >
        <CardPool
          :load-error="loadError"
          @open-zoom="openZoom"
          @add="addToDeck"
          @retry-load="retryLoad"
        />
      </section>

      <!-- ─────────── Panneau du deck ─────────── -->
      <aside
        class="border border-base-content/15 bg-base-100 xl:sticky xl:top-20 xl:self-start xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto"
        :class="mobileTab === 'deck' ? 'block' : 'hidden xl:block'"
        data-testid="deck-aside"
      >
        <!-- Panneau de lecture épinglé — visible uniquement sur xl et plus -->
        <div class="hidden xl:block">
          <CardZoomModal
            variant="panel"
            :card="zoomCard"
            :open="true"
            data-testid="card-zoom-panel"
            @close="zoomCard = null"
          >
            <template #actions>
              <div class="flex flex-wrap gap-2">
                <button
                  class="btn btn-sm font-mono uppercase tracking-wider"
                  :disabled="zoomCard ? !canAddCard(zoomCard) : true"
                  :title="
                    zoomCard && !canAddCard(zoomCard)
                      ? addBlockReason(zoomCard)
                      : ''
                  "
                  @click="zoomCard && addToDeck(zoomCard)"
                >
                  + Ajouter
                </button>
                <button
                  v-if="!zoomIsLeader"
                  class="btn btn-sm font-mono uppercase tracking-wider"
                  :disabled="zoomCard ? !canAddCard(zoomCard) : true"
                  :title="
                    zoomCard && !canAddCard(zoomCard)
                      ? addBlockReason(zoomCard)
                      : ''
                  "
                  @click="zoomCard && addToDeckQty(zoomCard, 3)"
                >
                  + ×3
                </button>
                <button
                  v-if="!zoomIsLeader"
                  class="btn btn-sm font-mono uppercase tracking-wider"
                  :disabled="zoomCard ? !canAddCard(zoomCard, true) : true"
                  :title="
                    zoomCard && !canAddCard(zoomCard, true)
                      ? addBlockReason(zoomCard, true)
                      : ''
                  "
                  @click="zoomCard && addToReserve(zoomCard)"
                >
                  + Réserve
                </button>
              </div>
            </template>
          </CardZoomModal>
          <div class="h-px w-full bg-base-content/15"></div>
        </div>
        <DeckPanel
          @confirm-clear="confirmClear"
          @confirm-delete="confirmDelete"
          @add-to-deck="addToDeck"
          @share="shareDeck"
        />
      </aside>
    </div>
  </div>

  <!-- ─────────── Zoom avant ajout (modal — <xl uniquement) ─────────── -->
  <div class="xl:hidden">
    <CardZoomModal
      :card="zoomCard"
      :open="zoomOpen"
      data-testid="card-zoom"
      @close="closeModalZoom"
    >
      <template #actions>
        <div class="flex flex-wrap gap-2">
          <!-- Ajouter 1 copie -->
          <button
            class="btn btn-sm font-mono uppercase tracking-wider"
            :disabled="zoomCard ? !canAddCard(zoomCard) : true"
            :title="
              zoomCard && !canAddCard(zoomCard) ? addBlockReason(zoomCard) : ''
            "
            @click="zoomCard && addToDeck(zoomCard)"
          >
            + Ajouter
          </button>
          <!-- Ajouter ×3 — masqué pour Héros / Havre-Sac -->
          <button
            v-if="!zoomIsLeader"
            class="btn btn-sm font-mono uppercase tracking-wider"
            :disabled="zoomCard ? !canAddCard(zoomCard) : true"
            :title="
              zoomCard && !canAddCard(zoomCard) ? addBlockReason(zoomCard) : ''
            "
            @click="zoomCard && addToDeckQty(zoomCard, 3)"
          >
            + ×3
          </button>
          <!-- Ajouter en Réserve — masqué pour Héros / Havre-Sac -->
          <button
            v-if="!zoomIsLeader"
            class="btn btn-sm font-mono uppercase tracking-wider"
            :disabled="zoomCard ? !canAddCard(zoomCard, true) : true"
            :title="
              zoomCard && !canAddCard(zoomCard, true)
                ? addBlockReason(zoomCard, true)
                : ''
            "
            @click="zoomCard && addToReserve(zoomCard)"
          >
            + Réserve
          </button>
        </div>
      </template>
    </CardZoomModal>
  </div>

  <!-- Confirmation stylée (vider / supprimer le deck, remplacer héros/havre-sac) -->
  <ConfirmDialog
    :open="confirmState.open"
    :title="confirmState.title"
    :message="confirmState.message"
    :danger="confirmState.danger"
    @confirm="onConfirmOk"
    @cancel="onConfirmCancel"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDeckStore } from "@/stores/deckStore";
import { useCardStore } from "@/stores/cardStore";
import { useToast } from "@/composables/useToast";
import { generateShareUrl } from "@/utils/deckSharing";
import CardZoomModal from "@/components/card/CardZoomModal.vue";
import ConfirmDialog from "@/components/common/ConfirmDialog.vue";
import DeckPanel from "@/components/deck/DeckPanel.vue";
import CardPool from "@/components/deck/CardPool.vue";
import type { Card, Deck } from "@/types/cards";

const route = useRoute();
const router = useRouter();
const deckStore = useDeckStore();
const cardStore = useCardStore();
const toast = useToast();

// ── Onglets mobile (Bestiaire / Deck) ─────────────────────────────────────────
/** Onglet actif sous xl. Sur xl les deux volets sont toujours visibles. */
const mobileTab = ref<"pool" | "deck">("pool");

// Vrai si l'initialisation du catalogue a échoué (réseau/hors-ligne).
const loadError = ref(false);

// ── Zoom avant ajout ──────────────────────────────────────────────────────────
const zoomCard = ref<Card | null>(null);
const zoomOpen = ref(false);

/** Vrai si la carte zoomée est un leader (Héros ou Havre-Sac) — masque ×3 et Réserve. */
const zoomIsLeader = computed(
  () =>
    zoomCard.value?.mainType === "Héros" ||
    zoomCard.value?.mainType === "Havre-Sac",
);

function openZoom(card: Card) {
  zoomCard.value = card;
  zoomOpen.value = true;
}

/**
 * Fermeture de la MODALE (sous xl) : on efface aussi `zoomCard` pour qu'aucun
 * raccourci clavier (a/e/r) ne reste actif sur une carte invisible. Le panneau
 * épinglé (xl) gère sa propre fermeture (@close="zoomCard = null").
 */
function closeModalZoom() {
  zoomOpen.value = false;
  zoomCard.value = null;
}

// Fermeture clavier (Échap) quand le zoom est ouvert.
function onKeydown(e: KeyboardEvent) {
  const hasFocus = zoomOpen.value || zoomCard.value !== null;
  if (!hasFocus) return;
  if (e.key === "Escape") {
    zoomOpen.value = false;
    zoomCard.value = null;
    return;
  }
  // Ne pas déclencher les raccourcis d'ajout (a/e/r) si l'utilisateur tape dans un champ.
  const tag = (document.activeElement as HTMLElement | null)?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  const card = zoomCard.value;
  if (!card) return;
  if (e.key === "a") addToDeck(card);
  else if (e.key === "e" && !zoomIsLeader.value) addToDeckQty(card, 3);
  else if (e.key === "r" && !zoomIsLeader.value) addToReserve(card);
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));

// ── Données deck ──────────────────────────────────────────────────────────────
const decks = computed(() => deckStore.decks);
const currentDeck = computed(() => deckStore.currentDeck as Deck | null);
const cardCount = computed(() => deckStore.cardCount);

// ── Guard d'ajout ────────────────────────────────────────────────────────────

function inDeckQty(id: string): number {
  return (currentDeck.value?.cards ?? [])
    .filter((c) => c.card.id === id)
    .reduce((a, c) => a + c.quantity, 0);
}

/**
 * Renvoie true si on peut encore ajouter une copie de `card` au deck principal
 * (ou à la réserve si `reserve=true`).
 */
function canAddCard(card: Card, reserve = false): boolean {
  if (!currentDeck.value) return false;
  if (card.mainType === "Héros" || card.mainType === "Havre-Sac") return true;
  const isUnique = card.keywords?.some((k) => k.name === "Unique");
  const max = isUnique ? 1 : 3;
  if (inDeckQty(card.id) >= max) return false;
  if (reserve) return deckStore.reserveCount < 12;
  return cardCount.value < 48;
}

/** Raison lisible quand canAddCard retourne false (pour le `title` du bouton). */
function addBlockReason(card: Card, reserve = false): string {
  if (!currentDeck.value) return "Aucun deck actif";
  if (card.mainType === "Héros" || card.mainType === "Havre-Sac") return "";
  const isUnique = card.keywords?.some((k) => k.name === "Unique");
  const max = isUnique ? 1 : 3;
  if (inDeckQty(card.id) >= max)
    return isUnique
      ? `${card.name} est unique (1 exemplaire max)`
      : `Maximum ${max} exemplaires de ${card.name}`;
  if (reserve) return "La réserve est pleine (12 cartes max)";
  return "Le deck contient déjà 48 cartes";
}

/** Ajoute 1 copie au deck principal (chemin normal + guard + toast). */
function addToDeck(card: Card) {
  if (!currentDeck.value) return;
  if (card.mainType === "Héros") {
    requestSetHero(card);
    return;
  }
  if (card.mainType === "Havre-Sac") {
    requestSetHavreSac(card);
    return;
  }
  if (!canAddCard(card)) {
    toast.warning(addBlockReason(card), { duration: 2000 });
    return;
  }
  deckStore.addCard(card, 1);
}

/** Ajoute jusqu'à `qty` copies au deck principal (bouton ×3 de la zoom). */
function addToDeckQty(card: Card, qty: number) {
  if (!currentDeck.value) return;
  if (card.mainType === "Héros") {
    requestSetHero(card);
    return;
  }
  if (card.mainType === "Havre-Sac") {
    requestSetHavreSac(card);
    return;
  }
  if (!canAddCard(card)) {
    toast.warning(addBlockReason(card), { duration: 2000 });
    return;
  }
  deckStore.addCard(card, qty);
}

/** Ajoute 1 copie à la réserve (bouton « + Réserve » de la zoom). */
function addToReserve(card: Card) {
  if (!currentDeck.value) return;
  if (!canAddCard(card, true)) {
    toast.warning(addBlockReason(card, true), { duration: 2000 });
    return;
  }
  deckStore.addCard(card, 1, true);
}

function switchDeck(id: string) {
  deckStore.setCurrentDeck(id);
  router.replace(`/deck-builder/${id}`);
}

// ── ConfirmDialog state ───────────────────────────────────────────────────────
interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  danger: boolean;
  onConfirm: () => void;
}
const confirmState = ref<ConfirmState>({
  open: false,
  title: "",
  message: "",
  danger: false,
  onConfirm: () => {},
});

function openConfirm(opts: Omit<ConfirmState, "open">) {
  confirmState.value = { open: true, ...opts };
}

function onConfirmOk() {
  confirmState.value.onConfirm();
  confirmState.value = { ...confirmState.value, open: false };
}

function onConfirmCancel() {
  confirmState.value = { ...confirmState.value, open: false };
}

function confirmClear() {
  openConfirm({
    title: "Vider toutes les cartes",
    message:
      "Cette action supprimera toutes les cartes du deck (y compris le héros et le havre-sac). Continuer ?",
    danger: true,
    onConfirm: () => deckStore.clearDeck(),
  });
}

function confirmDelete() {
  if (!currentDeck.value) return;
  const deckName = currentDeck.value.name;
  const deckId = currentDeck.value.id;
  openConfirm({
    title: `Supprimer « ${deckName} »`,
    message:
      "Ce deck sera définitivement supprimé. Cette action est irréversible.",
    danger: true,
    onConfirm: () => {
      deckStore.deleteDeck(deckId);
      toast.success("Deck supprimé", { duration: 2000 });
      router.push("/decks");
    },
  });
}

// ── Remplacement héros / havre-sac avec confirmation ────────────────────────

function requestSetHero(card: Card) {
  const existing = currentDeck.value?.hero;
  if (existing && existing.id !== card.id) {
    openConfirm({
      title: "Remplacer le héros",
      message: `Remplacer « ${existing.name} » par « ${card.name} » ?`,
      danger: false,
      onConfirm: () => {
        deckStore.setHero(card);
        toast.success(`Héros : ${card.name}`, { duration: 1500 });
      },
    });
  } else {
    deckStore.setHero(card);
    toast.success(`Héros : ${card.name}`, { duration: 1500 });
  }
}

function requestSetHavreSac(card: Card) {
  const existing = currentDeck.value?.havreSac;
  if (existing && existing.id !== card.id) {
    openConfirm({
      title: "Remplacer le havre-sac",
      message: `Remplacer « ${existing.name} » par « ${card.name} » ?`,
      danger: false,
      onConfirm: () => {
        deckStore.setHavreSac(card);
        toast.success(`Havre-sac : ${card.name}`, { duration: 1500 });
      },
    });
  } else {
    deckStore.setHavreSac(card);
    toast.success(`Havre-sac : ${card.name}`, { duration: 1500 });
  }
}

async function shareDeck() {
  if (!currentDeck.value) return;
  try {
    await navigator.clipboard.writeText(generateShareUrl(currentDeck.value));
    toast.success("Lien de partage copié !", { duration: 2500 });
  } catch {
    toast.error("Impossible de copier le lien");
  }
}

async function setupDeck() {
  loadError.value = false;
  try {
    await cardStore.initialize();
  } catch (e) {
    console.error("Erreur de chargement des cartes (deck builder):", e);
    loadError.value = true;
    return;
  }

  deckStore.initialize();

  const id = route.params.id as string | undefined;
  if (id) {
    deckStore.setCurrentDeck(id);
    if (!deckStore.currentDeck) {
      toast.error("Deck introuvable");
      router.replace("/decks");
    }
  } else {
    const newId = deckStore.createDeck("Nouveau deck");
    router.replace(`/deck-builder/${newId}`);
  }
}

function retryLoad() {
  cardStore.reset();
  setupDeck();
}

onMounted(setupDeck);
</script>
