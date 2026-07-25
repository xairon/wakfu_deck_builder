<template>
  <main class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold">Règles officielles</h1>
    <p class="mt-2 max-w-3xl opacity-80">
      Texte intégral des règles officielles du Wakfu TCG (édition Return).
      Chaque règle est adressable par son numéro : partagez un lien du type
      <code>/regles/officielles#418.5b</code>.
    </p>
    <p class="mt-2 text-sm opacity-70">
      Source :
      <a
        class="link"
        href="https://www.wtcg-return.fr/regles/completes"
        target="_blank"
        rel="noopener"
        >wtcg-return.fr/regles/completes</a
      >
    </p>

    <input
      v-model="query"
      type="search"
      class="input input-bordered mt-6 w-full max-w-md"
      placeholder="Rechercher dans les règles…"
      aria-label="Rechercher dans les règles"
    />

    <p v-if="failed" class="mt-6 alert alert-warning">
      Règles indisponibles — vérifiez votre connexion.
    </p>

    <!-- Sommaire : 8 chapitres, ancres internes. Masqué pendant une recherche
         (le sommaire n'aurait plus de rapport avec la liste filtrée). -->
    <nav v-if="!query && chapters.length" class="mt-6" aria-label="Sommaire">
      <h2 class="text-lg font-semibold">Sommaire</h2>
      <ol class="mt-2 space-y-1">
        <li v-for="c in chapters" :key="c.number">
          <a :href="`#${c.number}`" class="link"
            >{{ c.number }}. {{ c.title }}</a
          >
        </li>
      </ol>
    </nav>

    <div
      v-for="row in visible"
      :key="row.number"
      :id="row.number"
      class="mt-4 scroll-mt-24"
    >
      <h2 v-if="row.kind === 'chapter'" class="mt-8 text-2xl font-bold">
        {{ row.number }}. {{ row.title }}
      </h2>
      <h3 v-else-if="row.kind === 'section'" class="mt-6 text-xl font-semibold">
        {{ row.number }}. {{ row.title }}
      </h3>
      <p v-else class="leading-relaxed">
        <span class="font-mono text-sm opacity-70">{{ row.number }}</span>
        {{ row.body }}
      </p>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { loadRules, getRules } from "@/services/rulesService";
import { matchesSearch } from "@/utils/text";
import type { RuleEffectiveRow } from "@/schema";

const query = ref("");
const rows = ref<RuleEffectiveRow[]>(getRules());
const failed = ref(false);

onMounted(async () => {
  rows.value = await loadRules();
  failed.value = rows.value.length === 0;
  // Deep-link : le contenu arrive après le montage, on re-scrolle vers l'ancre.
  const hash = decodeURIComponent(window.location.hash.slice(1));
  if (hash) {
    await new Promise((r) => setTimeout(r, 0));
    document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
  }
});

const visible = computed(() =>
  query.value
    ? rows.value.filter((r) =>
        matchesSearch(
          `${r.number} ${r.title ?? ""} ${r.body ?? ""}`,
          query.value,
        ),
      )
    : rows.value,
);

/** Les 8 chapitres, pour le sommaire. */
const chapters = computed(() => rows.value.filter((r) => r.kind === "chapter"));
</script>
