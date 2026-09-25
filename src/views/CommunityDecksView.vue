<template>
  <div class="space-y-12 sm:space-y-16">
    <!-- En-tête -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow text-primary">Bibliothèque</p>
        <h1 class="mt-3 font-display text-4xl sm:text-5xl">
          Decks de la communauté
        </h1>
        <p class="mt-3 max-w-md text-base-content/70">
          Listes de tournoi, guides Dofus Mag et créations partagées —
          importables en un clic dans vos decks.
        </p>
      </div>
      <div class="flex shrink-0 gap-2">
        <router-link to="/decks/official" class="btn btn-ghost gap-2">
          Officiels
        </router-link>
        <router-link to="/decks" class="btn btn-ghost gap-2">
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
    </div>

    <!-- Barre de recherche & Filtres -->
    <div class="flex flex-wrap items-center justify-between gap-4 border-b border-base-content/15 pb-6">
      <div class="relative flex-1 min-w-[260px] max-w-lg">
        <svg
          viewBox="0 0 24 24"
          class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/40"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path stroke-linecap="round" d="m21 21-4.35-4.35" />
        </svg>
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Rechercher un deck par nom, auteur, mot-clé…"
          class="input input-bordered input-sm w-full pl-10"
          aria-label="Rechercher un deck communautaire"
        />
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <span class="font-mono text-xs uppercase text-base-content/60">Trier par :</span>
        <select
          v-model="sortBy"
          class="select select-bordered select-sm font-mono text-xs uppercase"
          aria-label="Trier les decks communautaires"
        >
          <option value="upvotes">Upvotes (décroissant)</option>
          <option value="name">Nom alphabétique</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="border-y border-base-content/15 py-16">
      <p class="eyebrow text-center">Chargement…</p>
    </div>

    <div
      v-else-if="!groups.length"
      class="border border-base-content/15 p-10 text-center"
    >
      <p class="text-base-content/60">
        Aucun deck communautaire pour l'instant.
      </p>
    </div>

    <!-- Groupes par source -->
    <section v-for="group in groups" :key="group.source" class="space-y-5">
      <p class="section-rule eyebrow">
        {{ group.source }} · {{ group.decks.length }} deck{{
          group.decks.length > 1 ? "s" : ""
        }}
      </p>

      <div class="grid grid-cols-1 gap-px bg-base-content/15 lg:grid-cols-2">
        <article
          v-for="deck in group.decks"
          :key="deck.id"
          class="bg-base-100 p-5 group/card transition hover:border-primary/40"
        >
          <div class="flex gap-4">
            <!-- Illustration du héros -->
            <div
              class="w-24 shrink-0 sm:w-28 cursor-pointer"
              title="Cliquer pour prévisualiser le deck"
              @click="openPreview(deck)"
            >
              <div class="plate-frame" :style="{ '--spine': heroColor(deck) }">
                <img
                  :src="heroImage(deck)"
                  :alt="deck.hero || deck.name"
                  class="aspect-[7/10] object-cover object-[50%_30%] group-hover/card:scale-105 transition duration-200"
                  loading="lazy"
                  @error="onImgError($event, deck)"
                />
              </div>
            </div>

            <!-- Texte -->
            <div class="min-w-0 flex-1">
              <h3
                class="font-display text-xl leading-tight cursor-pointer hover:text-primary transition"
                title="Cliquer pour prévisualiser le deck"
                @click="openPreview(deck)"
              >
                {{ deck.name }}
              </h3>
              <p
                class="mt-1 font-mono text-[11px] uppercase tracking-wider text-base-content/55"
              >
                <span v-if="deck.rank">{{ deck.rank }} · </span>{{ deck.event }}
                <span v-if="deck.author"> · {{ deck.author }}</span>
              </p>
              <p
                v-if="deck.description"
                class="mt-2 text-sm text-base-content/70"
              >
                {{ deck.description }}
              </p>
              <details
                v-if="deck.guide"
                class="mt-2 text-sm text-base-content/70"
              >
                <summary
                  class="cursor-pointer font-medium text-base-content/80"
                >
                  Comment jouer
                </summary>
                <p class="mt-1 whitespace-pre-line">{{ deck.guide }}</p>
              </details>

              <dl class="mt-4 space-y-2 border-t border-base-content/15 pt-3">
                <div class="flex items-center gap-2 text-sm">
                  <span
                    class="inline-block h-2 w-2 shrink-0"
                    :style="{ backgroundColor: heroColor(deck) }"
                  ></span>
                  <dt class="font-medium">Héros</dt>
                  <dd class="text-base-content/75">{{ deck.hero || "—" }}</dd>
                </div>
                <div class="flex items-center gap-2 text-sm">
                  <span class="inline-block h-2 w-2 shrink-0 bg-primary"></span>
                  <dt class="font-medium">Cartes</dt>
                  <dd class="font-mono tabular text-base-content/75">
                    {{ deckCardCount(deck) }}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div
            class="mt-4 flex flex-wrap items-center gap-3 border-t border-base-content/15 pt-4"
          >
            <!-- Bouton Upvote -->
            <button
              class="btn btn-sm gap-1.5 transition-colors"
              :class="
                hasUpvoted(deck)
                  ? 'btn-primary text-primary-content'
                  : 'btn-outline border-base-content/25 hover:border-primary hover:text-primary'
              "
              :aria-label="hasUpvoted(deck) ? 'Retirer mon vote' : 'Voter pour ce deck'"
              :title="
                hasUpvoted(deck)
                  ? 'Vous avez voté pour ce deck (cliquer pour retirer)'
                  : 'Voter pour ce deck'
              "
              data-testid="upvote-deck-btn"
              @click.stop="toggleUpvote(deck)"
            >
              <svg
                viewBox="0 0 24 24"
                class="h-4 w-4"
                :fill="hasUpvoted(deck) ? 'currentColor' : 'none'"
                stroke="currentColor"
                stroke-width="1.8"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
                />
              </svg>
              <span class="font-mono text-xs tabular font-bold">
                {{ deck.upvoteCount || 0 }}
              </span>
            </button>

            <button
              class="btn btn-outline btn-sm gap-1.5"
              data-testid="preview-deck-btn"
              @click="openPreview(deck)"
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
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              Aperçu
            </button>
            <button
              class="btn btn-primary btn-sm gap-2"
              :disabled="importing.has(deck.id)"
              data-testid="import-deck-btn"
              @click="onImport(deck)"
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
                importing.has(deck.id) ? "Import…" : "Importer"
              }}
            </button>
            <a
              v-if="deck.sourceUrl"
              :href="deck.sourceUrl"
              target="_blank"
              rel="noopener"
              class="btn btn-ghost btn-sm gap-2"
            >
              Source
            </a>
            <span
              v-if="deck.format"
              class="ml-auto font-mono text-[10px] uppercase tracking-wider text-base-content/45"
              >{{ deck.format }}</span
            >
          </div>
        </article>
      </div>
    </section>

    <!-- Modal d'inspection / prévisualisation complète avant import -->
    <DeckPreviewModal
      :is-open="!!previewDeck"
      :deck="previewDeck"
      :is-imported="previewDeck ? isDeckImported(previewDeck.name) : false"
      :importing="previewDeck ? importing.has(previewDeck.id) : false"
      @close="previewDeck = null"
      @import="onImport"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDeckStore } from "@/stores/deckStore";
import { useCardStore } from "@/stores/cardStore";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/composables/useToast";
import { getIllustrationPath } from "@/utils/imagePaths";
import DeckPreviewModal from "@/components/deck/DeckPreviewModal.vue";
import {
  loadCommunityDecks,
  groupBySource,
  deckCardCount,
  type SourcedDeck,
} from "@/services/communityDeckService";
import {
  loadPublicDecks,
  toggleDeckUpvote,
  getUserUpvotedDeckIds,
  type PublishedDeck,
} from "@/services/publicDeckService";
import { getUsernames } from "@/services/profileService";
import { elementColors } from "@/config/elementColors";
import { matchesSearch } from "@/utils/text";

const route = useRoute();
const router = useRouter();
const deckStore = useDeckStore();
const cardStore = useCardStore();
const authStore = useAuthStore();
const toast = useToast();

const loading = ref(true);
const decks = ref<SourcedDeck[]>([]);
const importing = ref(new Set<string>());
const previewDeck = ref<SourcedDeck | null>(null);

const searchQuery = ref("");
const sortBy = ref<"upvotes" | "name">("upvotes");
const userUpvotedDecks = ref<Set<string>>(new Set());

const LOCAL_UPVOTES_KEY = "wakfu_deck_upvotes_local";
function loadLocalUpvotes(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_UPVOTES_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}
function saveLocalUpvotes(set: Set<string>) {
  try {
    localStorage.setItem(LOCAL_UPVOTES_KEY, JSON.stringify([...set]));
  } catch {
    /* quota */
  }
}

function hasUpvoted(deck: SourcedDeck): boolean {
  const voteId = deck.rawDeckId || deck.id;
  return userUpvotedDecks.value.has(voteId);
}

async function toggleUpvote(deck: SourcedDeck) {
  if (!authStore.isAuthenticated) {
    toast.info("Connectez-vous pour voter pour ce deck.");
    router.push({ name: "auth", query: { redirect: route.fullPath } });
    return;
  }

  const voteId = deck.rawDeckId || deck.id;
  const wasUpvoted = userUpvotedDecks.value.has(voteId);

  // Optimistic UI update
  if (wasUpvoted) {
    userUpvotedDecks.value.delete(voteId);
    deck.upvoteCount = Math.max(0, (deck.upvoteCount || 1) - 1);
  } else {
    userUpvotedDecks.value.add(voteId);
    deck.upvoteCount = (deck.upvoteCount || 0) + 1;
  }
  saveLocalUpvotes(userUpvotedDecks.value);

  const res = await toggleDeckUpvote(voteId);
  if (res) {
    deck.upvoteCount = res.upvoteCount;
    if (res.upvoted) {
      userUpvotedDecks.value.add(voteId);
      toast.success("Vote enregistré !");
    } else {
      userUpvotedDecks.value.delete(voteId);
      toast.info("Vote retiré.");
    }
    saveLocalUpvotes(userUpvotedDecks.value);
  } else {
    if (userUpvotedDecks.value.has(voteId)) {
      toast.success("Vote enregistré !");
    }
  }
}

function openPreview(deck: SourcedDeck) {
  previewDeck.value = deck;
}

function isDeckImported(name?: string): boolean {
  if (!name) return false;
  return deckStore.decks.some((d) => d.name === name);
}

const filteredDecks = computed(() => {
  let list = decks.value;
  const q = searchQuery.value.trim();
  if (q) {
    list = list.filter((d) => {
      if (matchesSearch(d.name, q)) return true;
      if (d.author && matchesSearch(d.author, q)) return true;
      if (d.description && matchesSearch(d.description, q)) return true;
      if (d.event && matchesSearch(d.event, q)) return true;
      if (d.hero && matchesSearch(d.hero, q)) return true;
      if (d.cards.some((c) => matchesSearch(c.name, q))) return true;
      return false;
    });
  }

  const sorted = [...list];
  if (sortBy.value === "upvotes") {
    sorted.sort((a, b) => (b.upvoteCount || 0) - (a.upvoteCount || 0));
  } else if (sortBy.value === "name") {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  }
  return sorted;
});

const groups = computed(() => {
  const grouped = groupBySource(filteredDecks.value);
  if (sortBy.value === "upvotes") {
    for (const g of grouped) {
      g.decks.sort((a, b) => (b.upvoteCount || 0) - (a.upvoteCount || 0));
    }
  }
  return grouped;
});

function findHero(deck: SourcedDeck) {
  if (!deck.hero) return null;
  return (
    cardStore.cards.find(
      (c) => c.name === deck.hero && c.mainType === "Héros",
    ) || cardStore.cards.find((c) => c.name === deck.hero)
  );
}
function heroColor(deck: SourcedDeck): string {
  const h = findHero(deck);
  const el = (h?.stats?.niveau?.element || h?.stats?.force?.element || "neutre")
    .toString()
    .toLowerCase();
  return elementColors[el] || elementColors.neutre;
}
function heroImage(deck: SourcedDeck): string {
  const h = findHero(deck);
  if (h) return getIllustrationPath(h.id);
  return "/images/card-back.webp";
}
function onImgError(e: Event, deck?: SourcedDeck) {
  const img = e.target as HTMLImageElement;
  const h = deck ? findHero(deck) : null;
  // repli : recto de la carte puis dos
  if (h && !img.src.includes("_recto") && !img.src.includes("card-back")) {
    img.src = `/images/cards/${h.id}_recto.webp`;
  } else {
    img.src = "/images/card-back.webp";
  }
}

async function onImport(deck: SourcedDeck) {
  if (!authStore.isAuthenticated) {
    toast.info("Connectez-vous pour importer ce deck dans vos decks.");
    router.push({ name: "auth", query: { redirect: route.fullPath } });
    return;
  }

  if (!cardStore.cards.length) {
    try {
      await cardStore.initialize();
    } catch (e) {
      console.warn("Échec d'initialisation du catalogue:", e);
    }
  }

  if (!cardStore.cards.length) {
    toast.error("Catalogue de cartes indisponible. Vérifiez votre connexion.", {
      duration: 5000,
    });
    return;
  }

  importing.value.add(deck.id);
  try {
    // Decks publiés ou curatés : import fidèle et unifié via importPublishedDeck
    const result = deck.published
      ? deckStore.importPublishedDeck({
          name: deck.name,
          description: deck.description,
          author: deck.author,
          source: deck.source,
          event: deck.event,
          guide: deck.guide,
          heroId: deck.published.heroId,
          havreSacId: deck.published.havreSacId,
          heroName: deck.hero,
          havreSacName: deck.havreSac,
          cards: deck.published.cards,
        })
      : deckStore.importPublishedDeck({
          name: deck.name,
          description: deck.description,
          author: deck.author,
          source: deck.source,
          event: deck.event,
          guide: deck.guide,
          heroName: deck.hero,
          havreSacName: deck.havreSac,
          cards: deck.cards,
        });

    if (result.success && result.deckId) {
      if (!deck.published) {
        const created = deckStore.decks.find((d) => d.id === result.deckId);
        if (created) {
          if (!created.description && (deck.description || deck.author)) {
            created.description =
              deck.description ||
              (deck.author ? `Auteur : ${deck.author}` : undefined);
          }
          if (
            !created.publication &&
            (deck.guide || deck.event || deck.sourceUrl)
          ) {
            created.publication = {
              source: deck.event || deck.sourceUrl || deck.source,
              tagline: deck.description,
              guide: deck.guide,
            };
          }
          deckStore.saveDecks();
        }
      }
      previewDeck.value = null;
      if (result.warnings?.length)
        toast.warning(result.warnings.slice(0, 3).join("\n"), {
          duration: 5000,
        });
      toast.success(`« ${deck.name} » importé dans vos decks`, {
        duration: 3000,
      });
      router.push(`/deck/${result.deckId}`);
    } else {
      toast.error(result.errors?.join("\n") || "Import impossible", {
        duration: 6000,
      });
    }
  } finally {
    importing.value.delete(deck.id);
  }
}

/** Convertit un deck publié (snapshot, ids de cartes) en SourcedDeck pour la galerie. */
function publicToSourced(
  pub: PublishedDeck,
  names: Record<string, string>,
): SourcedDeck {
  const resolveCard = (id: string | null | undefined) => {
    if (!id) return undefined;
    const direct =
      cardStore.getCardByIdSync(id) ?? cardStore.cards.find((c) => c.id === id);
    if (direct) return direct;
    const cleanId = id.replace(/_(recto|verso)$/, "");
    return (
      cardStore.getCardByIdSync(cleanId) ??
      cardStore.cards.find((c) => c.id === cleanId)
    );
  };
  const nameOf = (id: string | null | undefined) => resolveCard(id)?.name ?? "";

  const heroId = pub.hero_id ?? (pub as any).heroId ?? null;
  const havreSacId = pub.havre_sac_id ?? (pub as any).havreSacId ?? null;

  return {
    id: `pub-${pub.deck_id}-${pub.user_id.slice(0, 8)}`,
    rawDeckId: pub.deck_id,
    upvoteCount: pub.upvote_count ?? 0,
    name: pub.name,
    source: "Communauté",
    author: names[pub.user_id] || undefined,
    event: pub.source || undefined,
    description: pub.tagline || undefined,
    guide: pub.guide || undefined,
    hero: nameOf(heroId) || undefined,
    havreSac: nameOf(havreSacId) || undefined,
    // Affichage : nom + réserve conservée (décomptée à part par deckCardCount).
    cards: (pub.cards ?? [])
      .map((c: any) => {
        const rawId = c.cardId ?? c.card_id ?? c.id ?? c.card?.id;
        const resolved = resolveCard(rawId);
        const name = resolved?.name ?? c.name ?? c.card?.name ?? rawId ?? "Carte inconnue";
        return {
          name,
          quantity: Number(c.quantity ?? c.count ?? 1) || 1,
          ...(c.isReserve || c.is_reserve ? { isReserve: true } : {}),
        };
      })
      .filter((c) => c.name),
    // Snapshot enrichi pour un import fidèle par IDs (avec fallback nom + réserve).
    published: {
      heroId,
      havreSacId,
      cards: (pub.cards ?? []).map((c: any) => {
        const rawId = c.cardId ?? c.card_id ?? c.id ?? c.card?.id;
        const resolved = resolveCard(rawId);
        const name = resolved?.name ?? c.name ?? c.card?.name ?? rawId ?? "Carte inconnue";
        return {
          cardId: rawId,
          name,
          quantity: Number(c.quantity ?? c.count ?? 1) || 1,
          ...(c.isReserve || c.is_reserve ? { isReserve: true } : {}),
        };
      }),
    },
  };
}

onMounted(async () => {
  try {
    await cardStore.initialize();
  } catch (e) {
    console.warn("Échec d'initialisation du cardStore:", e);
  }
  deckStore.initialize();

  // Chargement des votes de l'utilisateur
  try {
    const upvoted = await getUserUpvotedDeckIds();
    userUpvotedDecks.value = new Set([...upvoted, ...loadLocalUpvotes()]);
  } catch {
    userUpvotedDecks.value = loadLocalUpvotes();
  }

  const curated = await loadCommunityDecks();
  // Decks publiés par les joueurs (galerie communautaire dynamique). Tolérant :
  // si Supabase n'est pas joignable/déployé, on garde la bibliothèque curatée.
  let published: SourcedDeck[] = [];
  try {
    const rows = await loadPublicDecks();
    const names = await getUsernames(rows.map((r) => r.user_id));
    published = rows
      .map((r) => publicToSourced(r, names))
      .filter((d) => d.cards.length > 0 || !!d.hero);
  } catch (err) {
    console.warn("Galerie publique indisponible ou erreur de parsing:", err);
  }
  decks.value = [...curated, ...published];
  loading.value = false;
});
</script>
