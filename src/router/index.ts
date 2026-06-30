import { createRouter, createWebHistory } from "vue-router";

const HomeView = () => import("../views/HomeView.vue");
const CollectionView = () => import("@/views/CollectionView.vue");
const DeckBuilderView = () => import("@/views/DeckBuilderView.vue");
const DecksView = () => import("@/views/DecksView.vue");
const DeckDetailView = () => import("@/views/DeckDetailView.vue");
const SharedDeckView = () => import("@/views/SharedDeckView.vue");

let isSessionInitialized = false;

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
      // Landing pleine largeur : la HomeView gère ses propres marges/bandes
      // (hero 100vh, bandes sombres bord à bord) → on retire le conteneur.
      meta: { guest: true, fullBleed: true },
    },
    {
      path: "/auth",
      name: "auth",
      component: () => import("@/views/AuthView.vue"),
      meta: { guest: true },
    },
    {
      path: "/collection",
      name: "collection",
      component: CollectionView,
      // Public : parcours du catalogue de cartes. Le suivi de collection
      // (quantités possédées) ne s'active que pour un utilisateur connecté.
      meta: { guest: true },
    },
    {
      path: "/decks",
      name: "decks",
      component: DecksView,
      meta: { requiresAuth: true },
    },
    {
      path: "/decks/official",
      name: "officialDecks",
      component: () => import("@/views/OfficialDecksView.vue"),
      // Public : vitrine de decks starter (donne envie de s'inscrire).
      meta: { guest: true },
    },
    {
      path: "/decks/official/:id",
      name: "officialDeckDetail",
      component: () => import("@/views/OfficialDeckDetailView.vue"),
      meta: { guest: true },
    },
    {
      path: "/decks/community",
      name: "communityDecks",
      component: () => import("@/views/CommunityDecksView.vue"),
      meta: { guest: true },
    },
    {
      path: "/profil",
      name: "profile",
      component: () => import("@/views/ProfileView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/regles",
      name: "rules",
      component: () => import("@/views/RulesView.vue"),
      meta: { guest: true },
    },
    {
      path: "/regles/apprendre",
      name: "firstSteps",
      component: () => import("@/views/FirstStepsView.vue"),
      meta: { guest: true },
    },
    {
      path: "/a-propos",
      name: "about",
      component: () => import("@/views/AboutView.vue"),
      meta: { guest: true },
    },
    {
      path: "/credits",
      name: "credits",
      component: () => import("@/views/CreditsView.vue"),
      meta: { guest: true },
    },
    {
      path: "/mentions-legales",
      name: "legalNotice",
      component: () => import("@/views/LegalNoticeView.vue"),
      meta: { guest: true },
    },
    {
      path: "/cgu",
      name: "terms",
      component: () => import("@/views/TermsView.vue"),
      meta: { guest: true },
    },
    {
      // « Partie » mène directement au module de jeu (lobby/table/tutoriel).
      // L'ancien compagnon de table (compteurs PV + chronomètre) a été retiré.
      // Redirection conservée pour les anciens liens /play.
      path: "/play",
      redirect: "/play/table",
    },
    {
      path: "/play/table/:code?",
      name: "playTable",
      component: () => import("@/views/PlayTableView.vue"),
      // Public : table locale + tutoriel jouables sans compte (essai « à la
      // Cockatrice »). Le jeu EN LIGNE reste protégé côté Edge Function (auth
      // serveur) ; le lobby invitera à se connecter pour créer/rejoindre.
      meta: { guest: true },
    },
    {
      path: "/deck/share",
      name: "sharedDeck",
      component: SharedDeckView,
      meta: { guest: true },
    },
    {
      path: "/deck/:id",
      name: "deckDetail",
      component: DeckDetailView,
      meta: { requiresAuth: true },
    },
    {
      path: "/deck-builder",
      name: "newDeck",
      component: DeckBuilderView,
      meta: { requiresAuth: true },
    },
    {
      path: "/deck-builder/:id",
      name: "editDeck",
      component: DeckBuilderView,
      meta: { requiresAuth: true },
    },
    // Fallback pour les routes non trouvees
    {
      path: "/:pathMatch(.*)*",
      redirect: "/",
    },
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(savedPosition);
        }, 200);
      });
    }
    return { top: 0, behavior: "smooth" };
  },
});

// Optimisation de la navigation
let isNavigating = false;

router.beforeEach(async (to, from, next) => {
  // Eviter les doubles navigations
  if (isNavigating && to.path === from.path) {
    next(false);
    return;
  }

  // Initialiser l'auth une seule fois (restauration de session). Idempotent.
  if (!isSessionInitialized) {
    try {
      const { useAuthStore } = await import("@/stores/authStore");
      await useAuthStore().initialize();
    } catch {
      // L'échec d'init ne bloque pas la navigation ; les gardes ci-dessous gèrent.
    }
    isSessionInitialized = true;
  }

  const { useAuthStore } = await import("@/stores/authStore");
  const authStore = useAuthStore();
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);

  // Route protégée + non connecté → vers la page de connexion (avec redirect).
  if (requiresAuth && !authStore.isAuthenticated) {
    next({ name: "auth", query: { redirect: to.fullPath } });
    return;
  }

  // Déjà connecté et on ouvre /auth → vers la collection.
  if (to.name === "auth" && authStore.isAuthenticated) {
    next({ name: "collection" });
    return;
  }

  isNavigating = true;
  next();
});

router.afterEach(() => {
  isNavigating = false;
});

export default router;
