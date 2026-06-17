<template>
  <div class="min-h-screen text-base-content">
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-primary focus:text-primary-content"
    >
      Aller au contenu principal
    </a>

    <!-- Backend non configuré -->
    <div
      v-if="isBackendMissing"
      class="fixed inset-0 z-50 flex items-center justify-center bg-base-100 p-4"
      role="alert"
    >
      <div class="max-w-md border border-base-content p-8">
        <div class="mb-4 h-1 w-16 bg-primary"></div>
        <p class="eyebrow mb-2 text-error">Configuration requise</p>
        <h1 class="mb-4 font-display text-3xl">Backend absent</h1>
        <p class="text-base-content/75">
          Cette application nécessite un backend Supabase. Définissez
          <code class="bg-base-300 px-1 font-mono text-sm"
            >VITE_SUPABASE_URL</code
          >
          et
          <code class="bg-base-300 px-1 font-mono text-sm"
            >VITE_SUPABASE_ANON_KEY</code
          >, puis rechargez la page. Voir <strong>DEPLOYMENT.md</strong>.
        </p>
      </div>
    </div>

    <!-- Chargement -->
    <div
      v-if="!isBackendMissing && isLoading"
      class="fixed inset-0 z-50 flex items-center justify-center bg-base-100"
      role="status"
      aria-live="polite"
    >
      <div class="text-center">
        <h1 class="font-display text-4xl">L'Almanach des Douze</h1>
        <p class="eyebrow mt-3">
          Chargement<span v-if="loadingAttempt > 1">
            — Tentative {{ loadingAttempt }}/3</span
          >
        </p>
      </div>
    </div>

    <!-- Erreur -->
    <div
      v-if="error"
      class="fixed inset-0 z-50 flex items-center justify-center bg-base-100 p-4"
      role="alert"
    >
      <div class="max-w-md border border-base-content p-8">
        <div class="mb-4 h-1 w-16 bg-error"></div>
        <p class="eyebrow mb-2 text-error">Erreur de chargement</p>
        <p class="mb-6 text-base-content/75">{{ error }}</p>
        <div class="flex gap-3">
          <button class="btn btn-ghost btn-sm" @click="resetAndReload">
            Réinitialiser
          </button>
          <button class="btn btn-neutral btn-sm" @click="retryLoading">
            Réessayer
          </button>
        </div>
      </div>
    </div>

    <!-- Masthead -->
    <header
      v-show="!isLoading && !error && !isBackendMissing"
      class="sticky top-0 z-40 bg-base-100"
    >
      <div class="h-1 w-full bg-base-content"></div>
      <div
        class="container mx-auto flex flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-6"
      >
        <!-- Cartouche -->
        <router-link to="/" class="flex flex-col leading-none">
          <span
            class="font-mono text-lg font-bold uppercase"
            style="letter-spacing: 0.22em"
            >Grimoire</span
          >
          <span class="font-display text-[11px] italic text-base-content/55"
            >L'Almanach des Douze</span
          >
        </router-link>

        <!-- Navigation : liens texte, soulignement cinabre actif -->
        <nav class="flex items-center gap-6" aria-label="Navigation principale">
          <router-link
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="border-b-2 pb-0.5 font-display text-[17px] transition-colors"
            :class="
              isActive(item)
                ? 'border-primary text-base-content'
                : 'border-transparent text-base-content/55 hover:text-base-content'
            "
            :aria-current="isActive(item) ? 'page' : undefined"
          >
            {{ item.label }}
          </router-link>
        </nav>

        <!-- Contrôles à droite : groupés et poussés à droite (repli propre) -->
        <div class="ml-auto flex items-center gap-3">
          <!-- Ledger : état de synchro -->
          <div
            class="hidden items-center gap-2 font-mono text-[10px] uppercase text-base-content/55 md:flex"
            style="letter-spacing: 0.12em"
            role="status"
            aria-live="polite"
          >
            <span class="h-2 w-2" :class="syncSquareClass"></span>
            {{ syncLabel }}
          </div>

          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
      <div class="h-px w-full bg-base-content/80"></div>
    </header>

    <!-- Contenu -->
    <main
      id="main-content"
      v-if="!isLoading && !error && !isBackendMissing"
      class="container mx-auto px-4 py-8 sm:px-6 sm:py-10"
    >
      <router-view />
    </main>

    <ToastContainer />
    <PWAInstallPrompt />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRoute } from "vue-router";
import ToastContainer from "./components/ui/ToastContainer.vue";
import PWAInstallPrompt from "./components/ui/PWAInstallPrompt.vue";
import ThemeToggle from "./components/common/ThemeToggle.vue";
import UserMenu from "./components/auth/UserMenu.vue";
import { useTheme } from "./composables/useTheme";
import { useCardStore } from "./stores/cardStore";
import { useDeckStore } from "./stores/deckStore";
import { useAuthStore } from "./stores/authStore";
import { useToast } from "./composables/useToast";
import { isSupabaseConfigured } from "./services/supabase";

const { initTheme } = useTheme();
const route = useRoute();
const cardStore = useCardStore();
const deckStore = useDeckStore();
const authStore = useAuthStore();
const toast = useToast();

const loadingAttempt = ref(1);
const isLoading = computed(() => cardStore.loading);
const error = computed(() => cardStore.error);
const isSyncing = computed(() => cardStore.isSyncing);
const isBackendMissing = computed(() => !isSupabaseConfigured());

const syncState = computed(() =>
  cardStore.syncState === "error" || deckStore.syncState === "error"
    ? "error"
    : "ok",
);
const syncLabel = computed(() => {
  if (isSyncing.value) return "Sauvegarde…";
  if (authStore.isAuthenticated && syncState.value === "error")
    return "Non synchronisé";
  return authStore.isAuthenticated ? "Synchronisé" : "Hors-ligne";
});
const syncSquareClass = computed(() => {
  if (isSyncing.value) return "bg-primary";
  if (authStore.isAuthenticated && syncState.value === "error")
    return "bg-error";
  return authStore.isAuthenticated ? "bg-base-content" : "bg-base-content/30";
});

const navItems = [
  { to: "/", label: "Accueil", match: ["/"] },
  { to: "/collection", label: "Collection", match: ["/collection"] },
  { to: "/decks", label: "Decks", match: ["/decks", "/deck"] },
  { to: "/play", label: "Partie", match: ["/play"] },
  { to: "/regles", label: "Règles", match: ["/regles"] },
];
function isActive(item: (typeof navItems)[number]): boolean {
  if (item.to === "/") return route.path === "/";
  return item.match.some((m) => route.path.startsWith(m));
}

async function initializeApp() {
  try {
    await cardStore.initialize();
    // Les decks officiels NE sont PLUS auto-injectés dans « Mes decks » : ils se
    // parcourent sur /decks/official et s'importent à la demande (sinon la liste
    // de l'utilisateur se remplit toute seule + push cloud non sollicité).
    loadingAttempt.value = 1;
  } catch (err) {
    console.error("Erreur d'initialisation:", err);
    loadingAttempt.value++;
    if (loadingAttempt.value <= 3) setTimeout(initializeApp, 2000);
    else toast.error("Erreur lors du chargement des cartes");
  }
}

function resetAndReload() {
  cardStore.reset();
  loadingAttempt.value = 1;
  window.location.reload();
}
function retryLoading() {
  cardStore.reset();
  loadingAttempt.value = 1;
  initializeApp();
}

onMounted(async () => {
  initTheme();
  if (isBackendMissing.value) return;
  await authStore.initialize();
  await initializeApp();
});
</script>
