import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import CollectionView from '@/views/CollectionView.vue'
import DeckBuilderView from '@/views/DeckBuilderView.vue'
import DecksView from '@/views/DecksView.vue'
import DeckDetailView from '@/views/DeckDetailView.vue'

// Mode local: pas d'auth ni profil

// Mode local: rien à initialiser côté session
let isSessionInitialized = true

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { guest: true },
    },
    {
      path: '/collection',
      name: 'collection',
      component: CollectionView,
      meta: { requiresAuth: false },
    },
    {
      path: '/decks',
      name: 'decks',
      component: DecksView,
      meta: { requiresAuth: false },
    },
    {
      path: '/deck/:id',
      name: 'deckDetail',
      component: DeckDetailView,
      meta: { requiresAuth: false },
    },
    {
      path: '/deck-builder',
      name: 'newDeck',
      component: DeckBuilderView,
      meta: { requiresAuth: false },
    },
    {
      path: '/deck-builder/:id',
      name: 'editDeck',
      component: DeckBuilderView,
      meta: { requiresAuth: true },
    },
    // Auth routes retirées
    // Fallback pour les routes non trouvées
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(savedPosition)
        }, 200) // Délai correspondant à la durée de la transition
      })
    }
    return { top: 0, behavior: 'smooth' }
  },
})

// Optimisation de la navigation
let isNavigating = false

router.beforeEach(async (to, from, next) => {
  // Éviter les doubles navigations
  if (isNavigating && to.path === from.path) {
    next(false)
    return
  }

  // Éviter la navigation vers la même route
  // Modification: suppression de la condition trop stricte
  // if (to.name === from.name && to.params === from.params) {
  //   next(false)
  //   return
  // }

  // Vérification de l'authentification
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)
  const isGuestRoute = to.matched.some((record) => record.meta.guest)

  // Si la session n'est pas encore initialisée, attendre qu'elle le soit
  // Mode local: pas de session
  isSessionInitialized = true

  // Si la route requiert l'authentification et l'utilisateur n'est pas connecté
  if (requiresAuth && false) {
    // Route protégée, redirection vers la page d'accueil
    next({ name: 'home', query: { redirect: to.fullPath } })
  }
  // Si l'utilisateur est déjà connecté et essaie d'accéder à une page réservée aux invités (login/register)
  else if (isGuestRoute && false) {
    // L'utilisateur est déjà connecté, redirection vers la collection
    next({ name: 'collection' })
  }
  // Sinon, permettre l'accès normalement
  else {
    isNavigating = true
    next()
  }
})

router.afterEach(() => {
  isNavigating = false
})

export default router
