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

    <div class="grid gap-6 lg:grid-cols-[1fr_390px]">
      <!-- ─────────── Vivier de cartes ─────────── -->
      <section class="min-w-0">
        <div class="mb-4 flex flex-wrap items-center gap-3">
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
              v-model="search"
              type="text"
              placeholder="Rechercher une carte…"
              class="input input-bordered input-sm w-full pl-9"
              aria-label="Rechercher une carte"
            />
          </label>
          <select
            v-model="typeFilter"
            class="select select-bordered select-sm"
            aria-label="Filtrer par type"
          >
            <option value="">Tous les types</option>
            <option v-for="t in types" :key="t" :value="t">{{ t }}</option>
          </select>
          <select
            v-model="elementFilter"
            class="select select-bordered select-sm"
            aria-label="Filtrer par élément"
          >
            <option value="">Tous éléments</option>
            <option v-for="e in elementOptions" :key="e" :value="e">
              {{ e }}
            </option>
          </select>
          <select
            v-model="rarityFilter"
            class="select select-bordered select-sm"
            aria-label="Filtrer par rareté"
          >
            <option value="">Toutes raretés</option>
            <option v-for="r in rarityOptions" :key="r" :value="r">
              {{ r }}
            </option>
          </select>
          <label class="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              v-model="ownedOnly"
              class="checkbox checkbox-sm checkbox-primary"
            />
            Possédées
          </label>
          <span class="ml-auto font-mono text-xs tabular text-base-content/55"
            >{{ pool.length }} carte{{ pool.length > 1 ? "s" : "" }}</span
          >
        </div>

        <div
          class="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6"
        >
          <button
            v-for="card in visiblePool"
            :key="card.id"
            class="group relative block text-left"
            :title="`Ajouter ${card.name}`"
            @click="addToDeck(card)"
          >
            <div class="plate-frame" :style="{ '--spine': elementColor(card) }">
              <img
                :src="cardImg(card)"
                :alt="card.name"
                loading="lazy"
                class="aspect-[7/10] object-cover"
                :class="{ 'opacity-40': ownedQty(card.id) === 0 }"
                @error="onImgError"
              />
              <!-- Quantité dans le deck : étiquette braise carrée -->
              <span
                v-if="inDeckQty(card.id) > 0"
                class="absolute left-[5px] top-[5px] z-10 bg-primary px-1.5 py-0.5 font-mono text-[11px] font-bold tabular text-primary-content"
                >{{ inDeckQty(card.id) }}</span
              >
              <!-- Quantité possédée : mono tabulaire -->
              <span
                class="absolute right-[5px] top-[5px] z-10 bg-base-100/90 px-1 py-0.5 font-mono text-[10px] font-bold tabular"
                :class="
                  ownedQty(card.id) > 0
                    ? 'text-success'
                    : 'text-base-content/40'
                "
                >{{ ownedQty(card.id) }}</span
              >
              <!-- Bandeau d'ajout : encre plate au survol -->
              <span
                class="absolute inset-x-[5px] bottom-[5px] z-10 grid place-items-center bg-base-content py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-base-100 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
              >
                + Ajouter
              </span>
            </div>
          </button>
        </div>

        <div v-if="pool.length > visiblePool.length" class="mt-6 text-center">
          <button class="btn btn-outline btn-sm" @click="poolLimit += 60">
            Afficher plus ({{ pool.length - visiblePool.length }} restantes)
          </button>
        </div>
      </section>

      <!-- ─────────── Panneau du deck ─────────── -->
      <aside
        class="lg:sticky lg:top-20 lg:self-start border border-base-content/15 bg-base-100"
      >
        <!-- Nom + validité -->
        <div class="p-4">
          <input
            :value="currentDeck?.name"
            @change="renameCurrent(($event.target as HTMLInputElement).value)"
            class="w-full border-b border-transparent bg-transparent font-display text-2xl leading-tight focus:border-base-content focus:outline-none"
            aria-label="Nom du deck"
            placeholder="Nom du deck"
          />
          <div class="mt-4 flex items-center justify-between gap-3">
            <span
              class="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-wider"
              :class="
                validation.isValid ? 'text-primary' : 'text-base-content/55'
              "
            >
              <span
                class="h-2 w-2"
                :class="
                  validation.isValid ? 'bg-primary' : 'bg-base-content/40'
                "
              ></span>
              {{ validation.isValid ? "Prêt à jouer" : "En cours" }}
            </span>
            <!-- Compteur : devient le sceau à 48 -->
            <span
              v-if="cardCount === 48"
              class="seal shrink-0"
              aria-label="48 cartes sur 48"
              >48/48</span
            >
            <span
              v-else
              class="font-mono text-2xl font-bold tabular leading-none"
              >{{ cardCount
              }}<span class="text-base-content/35">/48</span></span
            >
          </div>
          <!-- Jauge : filet d'encre carré, remplissage braise→encre -->
          <div class="mt-3 h-px w-full bg-base-content/15">
            <div
              class="h-px transition-all duration-200"
              :class="cardCount === 48 ? 'bg-base-content' : 'bg-primary'"
              :style="{ width: Math.min(100, (cardCount / 48) * 100) + '%' }"
            ></div>
          </div>
          <ul
            v-if="!validation.isValid && validation.errors.length"
            class="mt-4 space-y-1.5 text-xs text-base-content/60"
          >
            <li
              v-for="(err, i) in validation.errors.slice(0, 4)"
              :key="i"
              class="flex items-start gap-2"
            >
              <span class="mt-1.5 h-1 w-1 shrink-0 bg-primary"></span>
              {{ err }}
            </li>
          </ul>
        </div>
        <div class="h-px w-full bg-base-content/15"></div>

        <!-- Slots héros / havre-sac : puits papier, filet d'encre -->
        <div class="grid grid-cols-2 gap-px bg-base-content/15">
          <div
            class="relative bg-base-100 p-3"
            :class="
              currentDeck?.hero
                ? ''
                : 'border border-dashed border-base-content/30'
            "
          >
            <span class="eyebrow text-base-content/50">Héros</span>
            <div
              v-if="currentDeck?.hero"
              class="mt-2 flex items-center gap-2.5"
            >
              <div
                class="plate-frame w-10 shrink-0"
                :style="{ '--spine': elementColor(currentDeck.hero) }"
              >
                <img
                  :src="cardImg(currentDeck.hero)"
                  :alt="currentDeck.hero.name"
                  class="aspect-[7/10] object-cover"
                  @error="onImgError"
                />
              </div>
              <div class="min-w-0">
                <p class="truncate font-display text-sm leading-tight">
                  {{ currentDeck.hero.name }}
                </p>
                <button
                  class="mt-1 font-mono text-[10px] font-bold uppercase tracking-wider text-error hover:underline"
                  @click="deckStore.removeHero()"
                >
                  Retirer
                </button>
              </div>
            </div>
            <p v-else class="mt-2 text-xs text-base-content/40">
              Cliquez un héros
            </p>
          </div>

          <div
            class="relative bg-base-100 p-3"
            :class="
              currentDeck?.havreSac
                ? ''
                : 'border border-dashed border-base-content/30'
            "
          >
            <span class="eyebrow text-base-content/50">Havre-Sac</span>
            <div
              v-if="currentDeck?.havreSac"
              class="mt-2 flex items-center gap-2.5"
            >
              <div
                class="plate-frame w-10 shrink-0"
                :style="{ '--spine': elementColor(currentDeck.havreSac) }"
              >
                <img
                  :src="cardImg(currentDeck.havreSac)"
                  :alt="currentDeck.havreSac.name"
                  class="aspect-[7/10] object-cover"
                  @error="onImgError"
                />
              </div>
              <div class="min-w-0">
                <p class="truncate font-display text-sm leading-tight">
                  {{ currentDeck.havreSac.name }}
                </p>
                <button
                  class="mt-1 font-mono text-[10px] font-bold uppercase tracking-wider text-error hover:underline"
                  @click="deckStore.removeHavreSac()"
                >
                  Retirer
                </button>
              </div>
            </div>
            <p v-else class="mt-2 text-xs text-base-content/40">
              Cliquez un havre-sac
            </p>
          </div>
        </div>
        <div class="h-px w-full bg-base-content/15"></div>

        <!-- Distribution élémentaire : filet segmenté + légende mono -->
        <div v-if="cardCount > 0" class="p-4">
          <p class="section-rule eyebrow mb-3">Éléments</p>
          <div class="flex h-px w-full">
            <div
              v-for="el in elementDist"
              :key="el.name"
              :style="{
                width: (el.count / Math.max(1, cardCount)) * 100 + '%',
                backgroundColor: el.color,
              }"
              :title="`${el.name}: ${el.count}`"
            ></div>
          </div>
          <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            <span
              v-for="el in elementDist"
              :key="el.name"
              class="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-base-content/65"
            >
              <span
                class="h-2.5 w-2.5"
                :style="{ backgroundColor: el.color }"
              ></span>
              {{ el.name }}
              <span class="tabular text-base-content">{{ el.count }}</span>
            </span>
          </div>
          <!-- Répartition par type -->
          <div
            class="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-base-content/10 pt-3"
          >
            <span
              v-for="t in typeBreakdown"
              :key="t.type"
              class="font-mono text-[11px] uppercase tracking-wider text-base-content/65"
            >
              {{ t.type }}
              <span class="tabular text-base-content">{{ t.count }}</span>
            </span>
          </div>
        </div>
        <div v-if="cardCount > 0" class="h-px w-full bg-base-content/15"></div>

        <!-- Liste des cartes : grand-livre à conduite de points -->
        <div class="p-4">
          <div class="mb-3 flex items-center justify-between gap-3">
            <p class="section-rule eyebrow grow">Cartes du deck</p>
            <button
              v-if="cardCount > 0"
              class="shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider text-base-content/50 hover:text-error"
              @click="confirmClear"
            >
              Tout vider
            </button>
          </div>
          <div
            v-if="!currentDeck?.cards.length"
            class="py-8 text-center text-sm text-base-content/40"
          >
            Cliquez des cartes à gauche pour les ajouter.
          </div>
          <ul v-else class="max-h-[34vh] overflow-y-auto">
            <li
              v-for="dc in mainDeckCards"
              :key="dc.card.id"
              class="spine flex items-center gap-2 border-b border-base-content/10 py-1.5"
              :style="{ '--spine': elementColor(dc.card) }"
            >
              <span
                class="w-5 shrink-0 font-mono text-sm font-bold tabular text-base-content/70"
                >{{ dc.quantity }}</span
              >
              <span class="truncate font-display text-sm leading-tight">{{
                dc.card.name
              }}</span>
              <span class="leader"></span>
              <span
                class="shrink-0 whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-base-content/45"
              >
                {{ dc.card.mainType
                }}<span v-if="dc.card.stats?.pa">
                  · {{ dc.card.stats.pa }} PA</span
                >
              </span>
              <span class="ml-1 flex shrink-0 items-center gap-1.5">
                <button
                  class="font-mono text-[10px] font-bold uppercase tracking-wider text-base-content/40 hover:text-primary"
                  @click="moveToReserve(dc.card.id)"
                  title="Déplacer en réserve"
                  aria-label="Déplacer en réserve"
                >
                  R→
                </button>
                <button
                  class="font-mono text-base font-bold leading-none text-base-content/50 hover:text-base-content"
                  @click="deckStore.removeCard(dc.card.id, 1)"
                  aria-label="Retirer une copie"
                >
                  −
                </button>
                <button
                  class="font-mono text-base font-bold leading-none text-base-content/50 hover:text-base-content"
                  @click="addToDeck(dc.card)"
                  aria-label="Ajouter une copie"
                >
                  +
                </button>
              </span>
            </li>
          </ul>
        </div>

        <!-- Réserve (sideboard, max 12) -->
        <div class="h-px w-full bg-base-content/15"></div>
        <div class="p-4">
          <div class="mb-3 flex items-center justify-between gap-3">
            <p class="section-rule eyebrow grow">Réserve</p>
            <span
              class="shrink-0 font-mono text-xs font-bold tabular"
              :class="
                reserveCount === 12 ? 'text-primary' : 'text-base-content/55'
              "
              >{{ reserveCount }} / 12</span
            >
          </div>
          <ul
            v-if="reserveDeckCards.length"
            class="max-h-[22vh] overflow-y-auto"
          >
            <li
              v-for="dc in reserveDeckCards"
              :key="'r-' + dc.card.id"
              class="spine flex items-center gap-2 border-b border-base-content/10 py-1.5"
              :style="{ '--spine': elementColor(dc.card) }"
            >
              <span
                class="w-5 shrink-0 font-mono text-sm font-bold tabular text-base-content/70"
                >{{ dc.quantity }}</span
              >
              <span class="truncate font-display text-sm leading-tight">{{
                dc.card.name
              }}</span>
              <span class="leader"></span>
              <span class="ml-1 flex shrink-0 items-center gap-1.5">
                <button
                  class="font-mono text-[10px] font-bold uppercase tracking-wider text-base-content/40 hover:text-primary"
                  @click="moveToMain(dc.card.id)"
                  title="Renvoyer au deck principal"
                  aria-label="Renvoyer au deck principal"
                >
                  →D
                </button>
                <button
                  class="font-mono text-base font-bold leading-none text-base-content/50 hover:text-error"
                  @click="deckStore.removeCard(dc.card.id, 1, true)"
                  aria-label="Retirer de la réserve"
                >
                  ×
                </button>
              </span>
            </li>
          </ul>
          <p v-else class="py-3 text-xs text-base-content/40">
            Réserve vide — déplacez des cartes du deck avec « R→ ».
          </p>
        </div>
        <div class="h-px w-full bg-base-content/15"></div>

        <!-- Cartes manquantes pour jouer cette liste (connecté) -->
        <div v-if="isAuthenticated && missingTotal > 0" class="p-4">
          <p class="section-rule eyebrow mb-3 text-primary">
            À acquérir · {{ missingTotal }}
          </p>
          <ul class="max-h-[20vh] space-y-1 overflow-y-auto">
            <li
              v-for="m in missingCards"
              :key="'miss-' + m.card.id"
              class="flex items-baseline gap-2 text-xs"
            >
              <span class="font-mono tabular text-primary"
                >+{{ m.missing }}</span
              >
              <span class="truncate font-display">{{ m.card.name }}</span>
              <span class="leader"></span>
              <span
                class="shrink-0 font-mono text-[10px] tabular text-base-content/45"
                >{{ m.have }}/{{ m.need }}</span
              >
            </li>
          </ul>
        </div>
        <div
          v-if="isAuthenticated && missingTotal > 0"
          class="h-px w-full bg-base-content/15"
        ></div>

        <!-- Notes du deck -->
        <div class="p-4">
          <p class="eyebrow mb-2 text-base-content/50">Notes</p>
          <textarea
            :value="currentDeck?.description || ''"
            @change="updateNotes(($event.target as HTMLTextAreaElement).value)"
            rows="2"
            placeholder="Archétype, plan de jeu, choix de réserve…"
            class="textarea textarea-bordered w-full text-sm"
          ></textarea>
        </div>
        <div class="h-px w-full bg-base-content/15"></div>

        <!-- Actions -->
        <div class="flex flex-wrap items-center gap-2 p-4">
          <router-link
            v-if="currentDeck"
            :to="`/deck/${currentDeck.id}`"
            class="btn btn-ghost btn-sm gap-1.5"
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
                d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
              />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Aperçu
          </router-link>
          <button class="btn btn-ghost btn-sm gap-1.5" @click="shareDeck">
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
          <div class="flex-1"></div>
          <button
            class="btn btn-ghost btn-sm text-error"
            @click="confirmDelete"
          >
            Supprimer
          </button>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDeckStore } from "@/stores/deckStore";
import { useCardStore } from "@/stores/cardStore";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/composables/useToast";
import { validateDeck } from "@/validators/deck";
import { generateShareUrl } from "@/utils/deckSharing";
import type { Card, Deck } from "@/types/cards";

const route = useRoute();
const router = useRouter();
const deckStore = useDeckStore();
const cardStore = useCardStore();
const authStore = useAuthStore();
const toast = useToast();

const search = ref("");
const typeFilter = ref("");
const elementFilter = ref("");
const rarityFilter = ref("");
const ownedOnly = ref(false);
const poolLimit = ref(60);

const elementOptions = ["Air", "Eau", "Feu", "Terre", "Neutre"];
const rarityOptions = [
  "Commune",
  "Peu Commune",
  "Rare",
  "Mythique",
  "Légendaire",
];
function cardElementName(card: Card): string {
  return (card.stats?.niveau?.element || card.stats?.force?.element || "")
    .toString()
    .toLowerCase();
}

const decks = computed(() => deckStore.decks);
const currentDeck = computed(() => deckStore.currentDeck as Deck | null);
const cardCount = computed(() => deckStore.cardCount);

const validation = computed(() =>
  currentDeck.value
    ? validateDeck(currentDeck.value)
    : { isValid: false, errors: [] },
);

const types = computed(() => {
  const set = new Set(cardStore.cards.map((c) => c.mainType));
  return Array.from(set).sort();
});

const pool = computed(() => {
  const q = search.value.trim().toLowerCase();
  const el = elementFilter.value.toLowerCase();
  return cardStore.cards.filter((c) => {
    if (typeFilter.value && c.mainType !== typeFilter.value) return false;
    if (el && cardElementName(c) !== el) return false;
    if (rarityFilter.value && c.rarity !== rarityFilter.value) return false;
    if (ownedOnly.value && ownedQty(c.id) === 0) return false;
    if (q && !c.name.toLowerCase().includes(q)) return false;
    return true;
  });
});

// Cartes manquantes pour jouer cette liste en réel (croisé à la collection).
const missingCards = computed(() => {
  const map = new Map<string, { card: Card; need: number; have: number }>();
  for (const dc of currentDeck.value?.cards ?? []) {
    const entry = map.get(dc.card.id) ?? {
      card: dc.card,
      need: 0,
      have: ownedQty(dc.card.id),
    };
    entry.need += dc.quantity;
    map.set(dc.card.id, entry);
  }
  return [...map.values()]
    .map((e) => ({ ...e, missing: Math.max(0, e.need - e.have) }))
    .filter((e) => e.missing > 0)
    .sort((a, b) => b.missing - a.missing);
});
const missingTotal = computed(() =>
  missingCards.value.reduce((a, e) => a + e.missing, 0),
);
const isAuthenticated = computed(() => authStore.isAuthenticated);

function updateNotes(value: string) {
  if (currentDeck.value)
    deckStore.setDeckDescription(currentDeck.value.id, value);
}
const visiblePool = computed(() => pool.value.slice(0, poolLimit.value));

const elementColors: Record<string, string> = {
  air: "#5FB22A",
  eau: "#1F9CEC",
  feu: "#F04E22",
  terre: "#F0A62B",
  neutre: "#98A1AF",
};
function elementColor(card: Card): string {
  const el = (
    card.stats?.niveau?.element ||
    card.stats?.force?.element ||
    "neutre"
  )
    .toString()
    .toLowerCase();
  return elementColors[el] || elementColors.neutre;
}
const elementDist = computed(() => {
  const map: Record<string, number> = {};
  for (const dc of currentDeck.value?.cards ?? []) {
    if (dc.isReserve) continue;
    const el = (
      dc.card.stats?.niveau?.element ||
      dc.card.stats?.force?.element ||
      "Neutre"
    ).toLowerCase();
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

const reserveCount = computed(() => deckStore.reserveCount);
const mainDeckCards = computed(() =>
  [...(currentDeck.value?.cards ?? [])]
    .filter((c) => !c.isReserve)
    .sort((a, b) => {
      if (a.card.mainType !== b.card.mainType)
        return a.card.mainType.localeCompare(b.card.mainType);
      return (a.card.stats?.pa || 0) - (b.card.stats?.pa || 0);
    }),
);
const reserveDeckCards = computed(() =>
  [...(currentDeck.value?.cards ?? [])]
    .filter((c) => c.isReserve)
    .sort((a, b) => (a.card.stats?.pa || 0) - (b.card.stats?.pa || 0)),
);
function moveToReserve(id: string) {
  if (reserveCount.value >= 12) {
    toast.warning("La réserve est pleine (12 cartes max)", { duration: 2000 });
    return;
  }
  deckStore.moveCardZone(id, true, 1);
}
function moveToMain(id: string) {
  if (cardCount.value >= 48) {
    toast.warning("Le deck principal est plein (48 cartes)", {
      duration: 2000,
    });
    return;
  }
  deckStore.moveCardZone(id, false, 1);
}

// Répartition par type (deck principal) — exposée pour le joueur.
const typeBreakdown = computed(() => {
  const map: Record<string, number> = {};
  for (const dc of currentDeck.value?.cards ?? []) {
    if (dc.isReserve) continue;
    map[dc.card.mainType] = (map[dc.card.mainType] || 0) + dc.quantity;
  }
  return Object.entries(map)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
});

function cardImg(card: Card): string {
  if (card.imageUrl) return card.imageUrl;
  if (card.mainType === "Héros") return `/images/cards/${card.id}_recto.png`;
  return `/images/cards/${card.id}.png`;
}
function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = "/images/card-back.png";
}

function ownedQty(id: string): number {
  return cardStore.getCardQuantity(id) + cardStore.getFoilCardQuantity(id);
}
function inDeckQty(id: string): number {
  return (currentDeck.value?.cards ?? [])
    .filter((c) => c.card.id === id)
    .reduce((a, c) => a + c.quantity, 0);
}

function addToDeck(card: Card) {
  if (!currentDeck.value) return;
  if (card.mainType === "Héros") {
    deckStore.setHero(card);
    toast.success(`Héros : ${card.name}`, { duration: 1500 });
    return;
  }
  if (card.mainType === "Havre-Sac" || card.mainType === "Havre-sac") {
    deckStore.setHavreSac(card);
    toast.success(`Havre-sac : ${card.name}`, { duration: 1500 });
    return;
  }
  const isUnique = card.keywords?.some((k) => k.name === "Unique");
  const max = isUnique ? 1 : 3;
  if (inDeckQty(card.id) >= max) {
    toast.warning(
      isUnique
        ? `${card.name} est unique (1 exemplaire max)`
        : `Maximum 3 exemplaires de ${card.name}`,
      { duration: 2000 },
    );
    return;
  }
  if (cardCount.value >= 48) {
    toast.warning("Le deck contient déjà 48 cartes", { duration: 2000 });
    return;
  }
  deckStore.addCard(card, 1);
}

function renameCurrent(name: string) {
  if (currentDeck.value) deckStore.renameDeck(currentDeck.value.id, name);
}

function switchDeck(id: string) {
  deckStore.setCurrentDeck(id);
  router.replace(`/deck-builder/${id}`);
}

function confirmClear() {
  if (confirm("Vider toutes les cartes de ce deck ?")) deckStore.clearDeck();
}

function confirmDelete() {
  if (!currentDeck.value) return;
  if (confirm(`Supprimer le deck « ${currentDeck.value.name} » ?`)) {
    deckStore.deleteDeck(currentDeck.value.id);
    toast.success("Deck supprimé", { duration: 2000 });
    router.push("/decks");
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

onMounted(async () => {
  await cardStore.initialize();
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
});
</script>
