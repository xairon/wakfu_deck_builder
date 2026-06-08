import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { getAuthProvider } from "@/services/auth";
import type { AuthSession, AuthUser } from "@/services/auth";
import { setActiveUser } from "@/services/storageNamespace";

/**
 * Store d'authentification — application web cloud-only (Supabase).
 *
 * Gère l'état d'authentification et, à chaque connexion/déconnexion, bascule
 * l'espace de cache local (clé = id utilisateur) puis synchronise la collection
 * et les decks avec Supabase (source de vérité).
 */
export const useAuthStore = defineStore("auth", () => {
  const user = ref<AuthUser | null>(null);
  const session = ref<AuthSession | null>(null);
  const loading = ref(true);
  const error = ref<string | null>(null);

  let unsubscribe: (() => void) | null = null;
  let initPromise: Promise<void> | null = null;
  let currentUserId: string | null = null;

  const isAuthenticated = computed(() => !!user.value);
  const userEmail = computed(() => user.value?.email ?? null);
  const userId = computed(() => user.value?.id ?? null);

  function setSession(next: AuthSession | null) {
    session.value = next;
    user.value = next?.user ?? null;
  }

  function messageFrom(err: unknown, fallback: string): string {
    return err instanceof Error ? err.message : fallback;
  }

  /**
   * Bascule le cache local sur l'utilisateur (ou aucun) et synchronise les
   * données. Best-effort : une erreur réseau n'empêche pas la connexion.
   */
  async function hydrateForUser(id: string | null) {
    if (id === currentUserId) return;
    currentUserId = id;
    setActiveUser(id);

    const { useCardStore } = await import("@/stores/cardStore");
    const { useDeckStore } = await import("@/stores/deckStore");
    const cardStore = useCardStore();
    const deckStore = useDeckStore();

    if (id) {
      // 1) Charger le catalogue AVANT de charger les decks : loadDecks migre les
      //    anciens formats en résolvant les cartes via le catalogue ; sans lui,
      //    les cartes seraient perdues.
      try {
        await cardStore.initialize();
      } catch {
        /* le catalogue se chargera via App.vue */
      }
      // 2) Affichage immédiat depuis le cache du compte (offline-friendly)
      cardStore.reloadCollection();
      deckStore.loadDecks();
      // 3) Rafraîchissement depuis le cloud (source de vérité)
      try {
        await cardStore.pullCloudCollection();
      } catch {
        /* offline : on garde le cache */
      }
      try {
        await deckStore.pullCloudDecks();
      } catch {
        /* offline : on garde le cache */
      }
    } else {
      // Déconnexion : on vide les données en mémoire
      cardStore.clearCollection();
      deckStore.clearAll();
    }
  }

  async function initialize() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      try {
        const provider = getAuthProvider();
        const existing = await provider.getSession();
        setSession(existing);
        if (existing?.user) {
          await hydrateForUser(existing.user.id);
        }
        unsubscribe = provider.onAuthStateChange((next) => {
          setSession(next);
          // Suit les changements (connexion via lien e-mail, refresh, logout…)
          void hydrateForUser(next?.user?.id ?? null);
        });
      } catch (err) {
        error.value = messageFrom(err, "Erreur d'initialisation");
      } finally {
        loading.value = false;
      }
    })();
    return initPromise;
  }

  async function signUp(email: string, password: string) {
    error.value = null;
    loading.value = true;
    try {
      const result = await getAuthProvider().signUp(email, password);
      // Session immédiate uniquement si la confirmation e-mail est désactivée.
      if (result.session) {
        setSession(result.session);
        await hydrateForUser(result.session.user.id);
      }
      return result;
    } catch (err) {
      error.value = messageFrom(err, "Erreur d'inscription");
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function signIn(email: string, password: string) {
    error.value = null;
    loading.value = true;
    try {
      const next = await getAuthProvider().signIn(email, password);
      setSession(next);
      await hydrateForUser(next.user.id);
      return next;
    } catch (err) {
      error.value = messageFrom(err, "Erreur de connexion");
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function signOut() {
    error.value = null;
    try {
      await getAuthProvider().signOut();
      setSession(null);
      await hydrateForUser(null);
    } catch (err) {
      error.value = messageFrom(err, "Erreur de déconnexion");
    }
  }

  async function resetPassword(email: string) {
    error.value = null;
    try {
      await getAuthProvider().resetPassword(email);
    } catch (err) {
      error.value = messageFrom(err, "Erreur de réinitialisation");
      throw err;
    }
  }

  function dispose() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  return {
    user,
    session,
    loading,
    error,
    isAuthenticated,
    userEmail,
    userId,
    initialize,
    signUp,
    signIn,
    signOut,
    resetPassword,
    dispose,
  };
});
