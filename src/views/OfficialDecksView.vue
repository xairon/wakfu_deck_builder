<template>
  <div class="official-decks-view space-y-12 sm:space-y-16">
    <!-- ── EN-TÊTE ── -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow text-primary">Decks starter</p>
        <h1 class="mt-3 font-display text-4xl sm:text-5xl">Decks officiels</h1>
        <p class="mt-3 max-w-md text-base-content/70">
          Parcourez et importez les decks starter de Wakfu TCG.
        </p>
      </div>
      <router-link to="/decks" class="btn btn-ghost gap-2 shrink-0">
        <svg
          viewBox="0 0 24 24"
          class="h-4 w-4"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15 18l-6-6 6-6"
          />
        </svg>
        Mes decks
      </router-link>
    </div>

    <!-- ── CHARGEMENT ── -->
    <div v-if="isLoading" class="border-y border-base-content/15 py-16">
      <p class="eyebrow text-center">Chargement des decks officiels…</p>
    </div>

    <!-- ── CONTENU PRINCIPAL ── -->
    <div v-else class="space-y-12 sm:space-y-16">
      <!-- Registre (tableau de bord) -->
      <section class="border-y border-base-content/80 py-5">
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div>
            <p class="eyebrow">Decks disponibles</p>
            <p class="mt-1 font-mono text-3xl tabular">
              {{ officialDecks.length }}
            </p>
          </div>
          <div>
            <p class="eyebrow">Extensions</p>
            <p class="mt-1 font-mono text-3xl tabular">
              {{ extensionGroups.length }}
            </p>
          </div>
          <div>
            <p class="eyebrow">Déjà importés</p>
            <p class="mt-1 font-mono text-3xl tabular">{{ importedCount }}</p>
          </div>
        </div>

        <!-- Action groupée : importer tous les decks manquants -->
        <div class="mt-5 flex justify-end">
          <button
            v-if="notImportedCount > 0"
            class="btn btn-primary btn-sm gap-2"
            :disabled="bulkImporting"
            data-testid="import-all-decks"
            @click="importAllDecks"
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
                d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"
              />
            </svg>
            {{
              bulkImporting
                ? "Import en cours…"
                : `Tout importer (${notImportedCount})`
            }}
          </button>
          <p
            v-else
            class="font-mono text-[11px] uppercase tracking-wider text-base-content/45"
          >
            Tous les decks sont importés
          </p>
        </div>
      </section>

      <!-- Groupes par extension -->
      <section
        v-for="group in extensionGroups"
        :key="group.extension"
        class="space-y-5"
      >
        <p class="section-rule eyebrow">
          {{ formatExtensionName(group.extension) }} ·
          {{ group.decks.length }} deck{{ group.decks.length > 1 ? "s" : "" }}
        </p>

        <!-- Grille de decks pour cette extension -->
        <div class="grid grid-cols-1 gap-px bg-base-content/15 lg:grid-cols-2">
          <article
            v-for="deck in group.decks"
            :key="deck.id"
            class="bg-base-100 p-5"
          >
            <div class="flex gap-4">
              <!-- Planche illustration du héros -->
              <div class="w-24 shrink-0 sm:w-28">
                <div
                  class="plate-frame"
                  :style="{ '--spine': getHeroColor(deck.hero) }"
                >
                  <img
                    :src="getHeroImage(deck.hero)"
                    :alt="deck.hero"
                    class="aspect-[7/10] object-cover object-[50%_18%]"
                    loading="lazy"
                    @error="onImgError"
                  />
                </div>
                <p class="plate-caption text-center">{{ deck.hero }}</p>
              </div>

              <!-- Bloc texte -->
              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-3">
                  <h3 class="font-display text-xl leading-tight">
                    {{ deck.name }}
                  </h3>
                  <span
                    v-if="isDeckImported(deck.id)"
                    class="shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider text-base-content/55"
                  >
                    Importé
                  </span>
                </div>

                <p class="mt-1.5 text-sm text-base-content/70">
                  {{ deck.description }}
                </p>

                <!-- Infos du deck -->
                <dl class="mt-4 space-y-2 border-t border-base-content/15 pt-3">
                  <div class="flex items-center gap-2 text-sm">
                    <span
                      class="inline-block h-2 w-2 shrink-0"
                      :style="{ backgroundColor: getHeroColor(deck.hero) }"
                    ></span>
                    <dt class="font-medium text-base-content">Héros</dt>
                    <dd class="text-base-content/75">{{ deck.hero }}</dd>
                  </div>
                  <div class="flex items-center gap-2 text-sm">
                    <span
                      class="inline-block h-2 w-2 shrink-0 bg-base-content/50"
                    ></span>
                    <dt class="font-medium text-base-content">Havre-Sac</dt>
                    <dd class="text-base-content/75">{{ deck.havreSac }}</dd>
                  </div>
                  <div class="flex items-center gap-2 text-sm">
                    <span
                      class="inline-block h-2 w-2 shrink-0 bg-primary"
                    ></span>
                    <dt class="font-medium text-base-content">Cartes</dt>
                    <dd class="font-mono tabular text-base-content/75">
                      {{ getCardCount(deck) }}
                    </dd>
                  </div>
                </dl>

                <!-- Bande statistiques par type -->
                <div
                  class="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-base-content/60"
                >
                  <span
                    v-for="(count, type) in getCardTypeBreakdown(deck)"
                    :key="type"
                  >
                    {{ type }}
                    <span class="tabular text-base-content">{{ count }}</span>
                  </span>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div
              class="mt-4 flex flex-wrap gap-2 border-t border-base-content/15 pt-4"
            >
              <button
                v-if="!isDeckImported(deck.id)"
                class="btn btn-primary btn-sm gap-2"
                :disabled="importingDeckIds.has(deck.id)"
                @click="importOfficialDeck(deck)"
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
                    d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"
                  />
                </svg>
                {{
                  importingDeckIds.has(deck.id)
                    ? "Import en cours…"
                    : "Importer"
                }}
              </button>
              <button
                v-else
                class="btn btn-outline btn-sm gap-2"
                :disabled="importingDeckIds.has(deck.id)"
                @click="importOfficialDeck(deck)"
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
                    d="M4 9a8 8 0 0 1 14-3l2 2M20 15a8 8 0 0 1-14 3l-2-2"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M20 4v4h-4M4 20v-4h4"
                  />
                </svg>
                {{
                  importingDeckIds.has(deck.id)
                    ? "Import en cours…"
                    : "Réimporter"
                }}
              </button>

              <button
                class="btn btn-ghost btn-sm gap-2"
                @click="toggleDeckDetails(deck.id)"
              >
                <svg
                  viewBox="0 0 24 24"
                  class="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    :d="
                      expandedDeckId === deck.id
                        ? 'M18 15l-6-6-6 6'
                        : 'M6 9l6 6 6-6'
                    "
                  />
                </svg>
                Détails
              </button>
            </div>

            <!-- Détails expandables -->
            <div
              v-if="expandedDeckId === deck.id"
              class="mt-4 border-t border-base-content/15 pt-4"
            >
              <DeckMagMeta :deck="deck" class="mb-4" />
              <p class="eyebrow mb-2">Liste des cartes</p>
              <ul class="max-h-64 space-y-1 overflow-y-auto">
                <li
                  v-for="card in deck.cards"
                  :key="card.name"
                  class="flex items-baseline text-sm"
                >
                  <span class="text-base-content/80">{{ card.name }}</span>
                  <span class="leader"></span>
                  <span class="font-mono tabular text-base-content/70"
                    >×{{ card.quantity }}</span
                  >
                </li>
              </ul>
            </div>
          </article>
        </div>
      </section>

      <!-- Message si aucun deck -->
      <div
        v-if="officialDecks.length === 0"
        class="border border-base-content/15 p-12 text-center"
      >
        <h2 class="font-display text-2xl">Aucun deck officiel disponible</h2>
        <p class="mt-2 text-base-content/70">
          Les decks officiels n'ont pas pu être chargés.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useMemoize } from "@vueuse/core";
import { OFFICIAL_DECKS, type OfficialDeck } from "@/data/officialDecks";
import { DOFUS_MAG_DECKS } from "@/data/dofusMagDecks";
import DeckMagMeta from "@/components/deck/DeckMagMeta.vue";
import { useDeckStore } from "@/stores/deckStore";
import { useCardStore } from "@/stores/cardStore";
import { useToast } from "@/composables/useToast";
import type { Card } from "@/types/cards";

// Stores et services
const deckStore = useDeckStore();
const cardStore = useCardStore();
const toast = useToast();

// Etat local
const isLoading = ref(true);
const importingDeckIds = ref(new Set<string>());
const expandedDeckId = ref<string | null>(null);
const importedDeckOfficialIds = ref(new Set<string>());
const bulkImporting = ref(false);

// Donnees
const officialDecks = computed(() => [...OFFICIAL_DECKS, ...DOFUS_MAG_DECKS]);

// Slug d'extension (données officielles) → nom d'extension tel qu'en base de
// cartes. Indispensable pour résoudre les cartes vers la BONNE extension : de
// nombreuses cartes (ex. « Bwork », « Repos », « Prospection »…) sont
// réimprimées sous le même nom dans plusieurs extensions ; sans ce pin, on
// importe la première chargée, souvent la mauvaise. La comparaison est
// insensible aux accents (cf. normalizeText), donc « Bonta & Brâkmar » suffit.
const EXTENSION_NAME_BY_SLUG: Record<string, string> = {
  incarnam: "Incarnam",
  "bonta-brakmar": "Bonta & Brâkmar",
};

// Couleurs des éléments (encres du jeu)
const ELEMENT_COLORS: Record<string, string> = {
  air: "#5FB22A",
  eau: "#1F9CEC",
  feu: "#F04E22",
  terre: "#F0A62B",
  neutre: "#98A1AF",
};

// Groupes par extension
interface ExtensionGroup {
  extension: string;
  decks: OfficialDeck[];
}

const extensionGroups = computed<ExtensionGroup[]>(() => {
  const groups: Record<string, OfficialDeck[]> = {};

  officialDecks.value.forEach((deck) => {
    if (!groups[deck.extension]) {
      groups[deck.extension] = [];
    }
    groups[deck.extension].push(deck);
  });

  // Ordre des extensions
  const extensionOrder = ["incarnam", "bonta-brakmar", "dofus-mag"];

  return Object.entries(groups)
    .sort(([a], [b]) => {
      const indexA = extensionOrder.indexOf(a);
      const indexB = extensionOrder.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    })
    .map(([extension, decks]) => ({
      extension,
      decks,
    }));
});

// Nombre de decks importes
const importedCount = computed(() => {
  return officialDecks.value.filter((deck) => isDeckImported(deck.id)).length;
});

// Nombre de decks restant à importer (pour le bouton « Tout importer »)
const notImportedCount = computed(
  () => officialDecks.value.length - importedCount.value,
);

// Initialisation
onMounted(async () => {
  try {
    // S'assurer que les stores sont initialises
    if (!cardStore.isInitialized) {
      await cardStore.initialize();
    }
    deckStore.initialize();

    // Determiner quels decks sont deja importes
    refreshImportedStatus();
  } catch (err) {
    console.error("Erreur lors du chargement:", err);
  } finally {
    isLoading.value = false;
  }
});

/**
 * Résout la carte héros d'un deck officiel par son nom.
 */
function findHeroCard(heroName: string): Card | undefined {
  return cardStore.cards.find(
    (c) =>
      c.name === heroName || (c.mainType === "Héros" && c.name === heroName),
  );
}

/**
 * Résout l'URL d'illustration recto du héros d'un deck.
 */
function getHeroImage(heroName: string): string {
  const card = findHeroCard(heroName);
  if (!card) return "/images/card-back.webp";
  if (card.imageUrl) return card.imageUrl;
  return `/images/cards/${card.id}_recto.webp`;
}

/**
 * Résout la couleur élémentaire du héros (épine de planche).
 */
function getHeroColor(heroName: string): string {
  const card = findHeroCard(heroName);
  const stats =
    card && card.mainType === "Héros" ? card.recto?.stats : card?.stats;
  const el = (stats?.niveau?.element || stats?.force?.element || "neutre")
    .toString()
    .toLowerCase();
  return ELEMENT_COLORS[el] || ELEMENT_COLORS.neutre;
}

/**
 * Fallback d'image (dos de carte).
 */
function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = "/images/card-back.webp";
}

/**
 * Rafraichit le statut d'import de tous les decks
 */
function refreshImportedStatus() {
  const imported = new Set<string>();
  officialDecks.value.forEach((officialDeck) => {
    // Verifier si un deck avec ce nom existe deja dans les decks de l'utilisateur
    const exists = deckStore.decks.some(
      (d) =>
        d.name === officialDeck.name ||
        (d.isOfficial && d.id?.includes(officialDeck.id)),
    );
    if (exists) {
      imported.add(officialDeck.id);
    }
  });
  importedDeckOfficialIds.value = imported;
}

/**
 * Verifie si un deck officiel est deja importe
 */
function isDeckImported(officialDeckId: string): boolean {
  return importedDeckOfficialIds.value.has(officialDeckId);
}

/**
 * Formate le nom d'une extension pour l'affichage
 */
function formatExtensionName(extension: string): string {
  const names: Record<string, string> = {
    incarnam: "Incarnam",
    "bonta-brakmar": "Bonta & Brakmar",
    "dofus-mag": "Dofus Mag",
    "bonta-brakmar-2": "Bonta & Brakmar 2",
    otomai: "Otomai",
    "otomai-2": "Otomai 2",
  };
  return (
    names[extension] || extension.charAt(0).toUpperCase() + extension.slice(1)
  );
}

/**
 * Calcule le nombre total de cartes dans un deck officiel
 */
function getCardCount(deck: OfficialDeck): number {
  return deck.cards.reduce((acc, card) => acc + card.quantity, 0);
}

/**
 * Calcule la répartition par type de carte. Mémoïsé par `deck.id` : les decks
 * officiels et la base de cartes sont statiques après initialisation
 * (cardStore.initialize dans onMounted), donc le résultat est déterministe et
 * peut être mis en cache — évite un scan O(cartes) à chaque rendu du v-for
 * imbriqué (extension → deck → type).
 */
const getCardTypeBreakdown = useMemoize(
  (deck: OfficialDeck): Record<string, number> => {
    const breakdown: Record<string, number> = {};
    const ext = EXTENSION_NAME_BY_SLUG[deck.extension];

    deck.cards.forEach((card) => {
      // Tenter de deviner le type de carte à partir du nom (extension pinnée)
      const foundCard = deckStore.findCardByName(card.name, undefined, ext);
      const type = foundCard?.mainType || "Carte";
      breakdown[type] = (breakdown[type] || 0) + card.quantity;
    });

    return breakdown;
  },
  { getKey: (deck) => deck.id },
);

/**
 * Affiche/masque les details d'un deck
 */
function toggleDeckDetails(deckId: string) {
  if (expandedDeckId.value === deckId) {
    expandedDeckId.value = null;
  } else {
    expandedDeckId.value = deckId;
  }
}

/**
 * Résultat d'une tentative de construction/ajout d'un deck officiel.
 */
interface BuildResult {
  /** Le deck existait déjà (rien créé). */
  skipped: boolean;
  /** Nombre de cartes résolues dans la base. */
  cardsFound: number;
  /** Noms de cartes introuvables. */
  missing: string[];
  /** Le héros n'a pas été trouvé. */
  heroMissing: boolean;
  /** Le Havre-Sac n'a pas été trouvé. */
  havreMissing: boolean;
}

/**
 * Cœur partagé : construit le deck à partir des données officielles, le pousse
 * dans le store (sans sauvegarder ni afficher de toast) et marque l'import.
 * Réutilisé par l'import unitaire et l'import groupé. La sauvegarde
 * (`deckStore.saveDecks()`) est laissée à l'appelant pour n'écrire qu'une fois
 * lors d'un import groupé.
 */
function buildAndAddDeck(officialDeck: OfficialDeck): BuildResult {
  // Garde anti-doublon : un deck officiel déjà importé n'est pas recréé en N copies.
  const existing = deckStore.decks.find(
    (d) => d.isOfficial && d.name === officialDeck.name,
  );
  if (existing) {
    importedDeckOfficialIds.value.add(officialDeck.id);
    return {
      skipped: true,
      cardsFound: 0,
      missing: [],
      heroMissing: false,
      havreMissing: false,
    };
  }

  // Résoudre chaque carte DANS l'extension du deck (cartes réimprimées).
  const ext = EXTENSION_NAME_BY_SLUG[officialDeck.extension];
  const heroCard = deckStore.findCardByName(officialDeck.hero, undefined, ext);
  const havreSacCard = deckStore.findCardByName(
    officialDeck.havreSac,
    undefined,
    ext,
  );

  const deckCards: { card: any; quantity: number }[] = [];
  const missing: string[] = [];
  for (const cardEntry of officialDeck.cards) {
    const card = deckStore.findCardByName(cardEntry.name, undefined, ext);
    if (card) deckCards.push({ card, quantity: cardEntry.quantity });
    else missing.push(cardEntry.name);
  }

  const newDeck = {
    id: `official-${officialDeck.id}-${Date.now()}`,
    name: officialDeck.name,
    description: officialDeck.description,
    hero: heroCard || null,
    havreSac: havreSacCard || null,
    cards: deckCards,
    reserve: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isOfficial: true,
    extension: officialDeck.extension,
    _officialData: {
      name: officialDeck.name,
      hero: officialDeck.hero,
      havreSac: officialDeck.havreSac,
      cards: officialDeck.cards.map((c) => ({
        name: c.name,
        quantity: c.quantity,
        type: c.type,
      })),
    },
  };

  deckStore.decks.push(newDeck as any);
  importedDeckOfficialIds.value.add(officialDeck.id);

  return {
    skipped: false,
    cardsFound: deckCards.length,
    missing,
    heroMissing: !heroCard,
    havreMissing: !havreSacCard,
  };
}

/**
 * Importe un deck officiel dans les decks de l'utilisateur (avec toasts).
 */
async function importOfficialDeck(officialDeck: OfficialDeck) {
  if (importingDeckIds.value.has(officialDeck.id)) return;
  importingDeckIds.value.add(officialDeck.id);

  try {
    // « Réimporter » : on remplace la/les version(s) officielle(s) du même nom
    // pour récupérer les corrections (ex. cartes résolues vers la bonne
    // extension). buildAndAddDeck reconstruit ensuite à neuf.
    const existing = deckStore.decks.filter(
      (d) => d.isOfficial && d.name === officialDeck.name,
    );
    const isReimport = existing.length > 0;
    for (const d of existing) if (d.id) deckStore.deleteDeck(d.id);

    toast.info(
      `${isReimport ? "Réimport" : "Import"} du deck "${officialDeck.name}" en cours...`,
      { duration: 2000 },
    );

    const result = buildAndAddDeck(officialDeck);
    deckStore.saveDecks();

    // Afficher le resultat
    if (result.missing.length === 0) {
      toast.success(
        `Deck "${officialDeck.name}" importe avec succes ! ${result.cardsFound} cartes trouvees.`,
        { title: "Import reussi", duration: 5000 },
      );
    } else {
      toast.warning(
        `Deck "${officialDeck.name}" importe avec ${result.missing.length} carte(s) manquante(s) : ${result.missing.slice(0, 5).join(", ")}${result.missing.length > 5 ? "..." : ""}`,
        { title: "Import partiel", duration: 7000 },
      );
    }

    if (result.heroMissing) {
      toast.warning(
        `Heros "${officialDeck.hero}" non trouve dans la base de cartes.`,
        { duration: 5000 },
      );
    }
    if (result.havreMissing) {
      toast.warning(
        `Havre-Sac "${officialDeck.havreSac}" non trouve dans la base de cartes.`,
        { duration: 5000 },
      );
    }
  } catch (err) {
    console.error("Erreur lors de l'import:", err);
    toast.error(
      `Erreur lors de l'import du deck "${officialDeck.name}" : ${err}`,
      {
        title: "Erreur d'import",
        duration: 7000,
      },
    );
  } finally {
    importingDeckIds.value.delete(officialDeck.id);
  }
}

/**
 * Importe d'un coup tous les decks officiels pas encore importés. Une seule
 * sauvegarde + un seul toast récapitulatif (au lieu d'un par deck).
 */
async function importAllDecks() {
  if (bulkImporting.value) return;
  const todo = officialDecks.value.filter((d) => !isDeckImported(d.id));
  if (todo.length === 0) {
    toast.info("Tous les decks officiels sont déjà importés.", {
      duration: 3000,
    });
    return;
  }

  bulkImporting.value = true;
  try {
    let imported = 0;
    let totalMissing = 0;
    let decksWithMissing = 0;

    for (const officialDeck of todo) {
      const result = buildAndAddDeck(officialDeck);
      if (result.skipped) continue;
      imported++;
      if (result.missing.length > 0) {
        totalMissing += result.missing.length;
        decksWithMissing++;
      }
    }

    deckStore.saveDecks();
    refreshImportedStatus();

    const s = imported > 1 ? "s" : "";
    if (totalMissing === 0) {
      toast.success(`${imported} deck${s} importé${s} !`, {
        title: "Import terminé",
        duration: 5000,
      });
    } else {
      toast.warning(
        `${imported} deck${s} importé${s} — ${totalMissing} carte(s) introuvable(s) sur ${decksWithMissing} deck(s).`,
        { title: "Import terminé", duration: 7000 },
      );
    }
  } catch (err) {
    console.error("Erreur lors de l'import groupé:", err);
    toast.error(`Erreur lors de l'import groupé : ${err}`, {
      title: "Erreur",
      duration: 7000,
    });
  } finally {
    bulkImporting.value = false;
  }
}
</script>
