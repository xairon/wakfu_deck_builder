import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import CollectionView from '@/views/CollectionView.vue'
import { useSupabaseStore } from '@/stores/supabaseStore'

// Import des nouvelles vues d'authentification
import AuthView from '@/views/AuthView.vue' 
import ProfileView from '@/views/ProfileView.vue'

// Variable pour suivre si l'initialisation de la session est terminée
let isSessionInitialized = false

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { guest: true }
    },
    {
      path: '/collection',
      name: 'collection',
      component: CollectionView,
      meta: { requiresAuth: true }
    },
    {
      path: '/profile',
      name: 'profile',
      component: ProfileView,
      meta: { requiresAuth: true }
    },
    {
      path: '/login',
      name: 'login',
      component: AuthView,
      meta: { guest: true }
    },
    {
      path: '/register',
      name: 'register',
      component: AuthView,
      meta: { guest: true }
    },
    // Fallback pour les routes non trouvées
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
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
  }
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
  const supabaseStore = useSupabaseStore()
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const isGuestRoute = to.matched.some(record => record.meta.guest)
  
  // Si la session n'est pas encore initialisée, attendre qu'elle le soit
  if (!isSessionInitialized) {
    try {
      // Vérifier si nous avons déjà une session active
      const { user } = await supabaseStore.initializeSession()
      isSessionInitialized = true
      console.log('Session initialisée dans le routeur', { user: user?.email || 'Aucun utilisateur connecté' })
    } catch (error) {
      console.error('Erreur lors de l\'initialisation de la session dans le routeur', error)
      isSessionInitialized = true // Marquer comme initialisé même en cas d'erreur pour éviter les boucles
    }
  }
  
  // Si la route requiert l'authentification et l'utilisateur n'est pas connecté
  if (requiresAuth && !supabaseStore.isAuthenticated) {
    // Route protégée, redirection vers la page d'accueil
    next({ name: 'home', query: { redirect: to.fullPath } })
  } 
  // Si l'utilisateur est déjà connecté et essaie d'accéder à une page réservée aux invités (login/register)
  else if (isGuestRoute && supabaseStore.isAuthenticated) {
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