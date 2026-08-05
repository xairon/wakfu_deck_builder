<template>
  <main class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold">Errata</h1>
    <p class="mt-2 max-w-3xl opacity-80">
      Les cartes dont le texte ou les valeurs ont été officiellement corrigés.
      Une carte erratée porte aussi un repère dans la collection et l'atelier de
      deck.
    </p>

    <div class="mt-6 flex flex-wrap items-end gap-4">
      <input
        v-model="query"
        type="search"
        class="input input-bordered w-full max-w-md"
        placeholder="Rechercher une carte…"
        aria-label="Rechercher une carte erratée"
      />
      <select
        v-model="sortMode"
        class="select select-bordered"
        aria-label="Trier les errata"
      >
        <option value="extension">Grouper par extension</option>
        <option value="date">Trier par date (récent d'abord)</option>
      </select>
    </div>

    <p v-if="failed" class="mt-6 alert alert-warning">
      Errata indisponibles — vérifiez votre connexion.
    </p>
    <p v-else class="mt-4 text-sm opacity-70">
      {{ total }} carte(s) erratée(s)
    </p>

    <section v-for="group in groups" :key="group.extension" class="mt-8">
      <h2 class="text-xl font-semibold">{{ group.extension }}</h2>
      <ul class="mt-3 space-y-4">
        <li
          v-for="item in group.items"
          :key="item.cardId"
          class="flex gap-4 rounded-lg border border-base-content/20 p-4"
        >
          <img
            v-if="item.thumb"
            :src="item.thumb"
            :alt="item.name"
            class="h-24 w-auto flex-shrink-0 rounded"
            loading="lazy"
          />
          <div class="min-w-0 flex-1">
            <div class="flex items-baseline justify-between gap-3">
              <RouterLink
                :to="{ name: 'collection', query: { q: item.name } }"
                class="link font-semibold"
                >{{ item.name }}</RouterLink
              >
              <span v-if="item.dateLabel" class="text-sm opacity-70">{{
                item.dateLabel
              }}</span>
            </div>
            <p class="mt-1">{{ item.entry.summary }}</p>
            <div
              v-if="item.entry.before || item.entry.after"
              class="mt-2 text-sm"
            >
              <p v-if="item.entry.before">
                <span class="opacity-70">Avant :</span> {{ item.entry.before }}
              </p>
              <p v-if="item.entry.after">
                <span class="opacity-70">Après :</span> {{ item.entry.after }}
              </p>
            </div>
            <p v-if="item.entry.source" class="mt-2 text-xs opacity-60">
              Source : {{ item.entry.source }}
            </p>
          </div>
        </li>
      </ul>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  preloadErrata,
  getAllErrata,
  type ErrataEntry,
} from "@/services/errataService";
import { useCardStore } from "@/stores/cardStore";
import { matchesSearch } from "@/utils/text";
import { getThumbPath } from "@/utils/imagePaths";
import { formatFrenchDate } from "@/utils/date";

const cardStore = useCardStore();
const query = ref("");
const sortMode = ref<"extension" | "date">("extension");
const loaded = ref(0); // incrémenté après préchargement pour recalculer
// Distingue "chargé, zéro résultat après filtrage" (recherche sans résultat,
// normal) de "rien n'a pu être chargé" (panne) — sinon une panne ressemble à
// « 0 carte n'a jamais été errata'ée », la fausse réassurance que cette
// fonctionnalité doit justement éviter. Calculé sur l'index BRUT, avant tout
// filtrage par la recherche.
const failed = ref(false);

onMounted(async () => {
  await preloadErrata();
  failed.value = Object.keys(getAllErrata()).length === 0;
  loaded.value++;
});

interface Item {
  cardId: string;
  name: string;
  extension: string;
  thumb: string | null;
  entry: ErrataEntry;
  /** Date affichable (FR, "JJ/MM/AAAA") — `entry.date` reste l'ISO, trié tel quel. */
  dateLabel: string;
}

const items = computed<Item[]>(() => {
  void loaded.value;
  const byId = new Map(cardStore.cards.map((c) => [c.id, c]));
  const out: Item[] = [];
  for (const [cardId, list] of Object.entries(getAllErrata())) {
    const card = byId.get(cardId);
    for (const entry of list) {
      out.push({
        cardId,
        name: card?.name ?? cardId,
        // Extension RÉELLE de la carte — le suffixe d'id est trompeur.
        extension: card?.extension?.name ?? "Autre",
        thumb: card?.imageUrl ? getThumbPath(card.imageUrl) : null,
        entry,
        dateLabel: formatFrenchDate(entry.date),
      });
    }
  }
  return out;
});

const filtered = computed(() =>
  query.value
    ? items.value.filter((i) => matchesSearch(i.name, query.value))
    : items.value,
);

const total = computed(() => filtered.value.length);

const groups = computed(() => {
  // Tri par date : un seul groupe, du plus récent au plus ancien. Les dates
  // arrivent en "YYYY-MM-DD" (colonne `date` Postgres) → tri lexicographique OK.
  if (sortMode.value === "date") {
    return [
      {
        extension: "Toutes extensions, du plus récent",
        items: [...filtered.value].sort((a, b) =>
          (b.entry.date ?? "").localeCompare(a.entry.date ?? ""),
        ),
      },
    ];
  }
  const map = new Map<string, Item[]>();
  for (const i of filtered.value) {
    const list = map.get(i.extension) ?? [];
    list.push(i);
    map.set(i.extension, list);
  }
  return [...map.entries()]
    .map(([extension, list]) => ({
      extension,
      items: [...list].sort((a, b) => a.name.localeCompare(b.name, "fr")),
    }))
    .sort((a, b) => a.extension.localeCompare(b.extension, "fr"));
});
</script>
