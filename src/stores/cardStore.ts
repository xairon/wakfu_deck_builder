import { defineStore } from "pinia";
import { matchesSearch } from "@/utils/text";
import { ref, shallowRef, computed } from "vue";
import type { Card } from "@/types/cards";
import { loadAllCards } from "@/services/cardLoader";
import { useLocalStorage } from "@vueuse/core";
import { localStorageService } from "@/services/localStorage";
import { canonicalKey } from "@/utils/cardIdentity";
import { namespacedKey } from "@/services/storageNamespace";
// Imports STATIQUES (pas de cycle : authStore n'importe cardStore que
// dynamiquement) : le flush du push sur pagehide ne peut pas se permettre
// d'attendre des imports dynamiques pendant le déchargement de la page.
import { isSupabaseConfigured } from "@/services/supabase";
import { useAuthStore } from "@/stores/authStore";
import {
  loadCollectionFromCloud,
  saveCollectionToCloud,
  deleteCollectionEntryFromCloud,
} from "@/services/cloudSync";

function isValidCollection(
  payload: unknown,
): payload is Record<string, { normal: number; foil: number }> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return false;
  return Object.values(payload as Record<string, unknown>).every(
    (v) =>
      v &&
      typeof v === "object" &&
      "normal" in v &&
      "foil" in v &&
      typeof (v as any).normal === "number" &&
      typeof (v as any).foil === "number",
  );
}

export interface CollectionCard {
  card: Card;
  quantity: number;
  foilQuantity: number;
}

export const useCardStore = defineStore("cards", () => {
  // État
  const cards = shallowRef<Card[]>([]);
  // Index id→Card mémoïsé : évite des Array.find O(n) sur ~1585 cartes dans les
  // chemins chauds (getCardById, exportCollection, résolution de decks). Recalculé
  // seulement quand `cards` est réassigné (shallowRef).
  const cardIndex = computed(() => {
    const map = new Map<string, Card>();
    for (const card of cards.value) map.set(card.id, card);
    return map;
  });
  // Index clé-canonique → impressions, mémoïsé (évite un filtre O(n) par ligne
  // de deck affichée). Recalculé seulement quand `cards` est réassigné.
  const printingsIndex = computed(() => {
    const map = new Map<string, Card[]>();
    for (const card of cards.value) {
      const key = canonicalKey(card);
      const list = map.get(key);
      if (list) list.push(card);
      else map.set(key, [card]);
    }
    return map;
  });

  /** Toutes les impressions chargées partageant la clé canonique de `card`. */
  function printingsOf(card: Card): Card[] {
    return printingsIndex.value.get(canonicalKey(card)) ?? [card];
  }
  const collection = ref<Record<string, { normal: number; foil: number }>>({});
  const loading = ref(false);
  const error = ref<string | null>(null);
  const isInitializing = ref(false);
  const isInitialized = ref(false);
  const initializationAttempts = ref(0);

  // État de synchronisation
  const lastSync = useLocalStorage<string | null>("wakfu-last-sync", null);
  const isSyncing = ref(false);
  // État de la dernière synchro cloud (collection) : surfacé dans l'UI pour ne
  // pas avaler silencieusement les échecs d'écriture.
  const syncState = ref<"idle" | "syncing" | "synced" | "error">("idle");

  // Getters
  const totalCards = computed(() => cards.value.length);
  const totalCollection = computed(() => {
    // Vérifier si la collection est initialisée
    if (!collection.value) {
      return 0;
    }

    return Object.values(collection.value).reduce(
      (acc, { normal, foil }) => acc + normal + foil,
      0,
    );
  });
  const collectionProgress = computed(() => {
    // Vérifier si les cartes sont chargées
    if (cards.value.length === 0) {
      return 0;
    }

    // Vérifier si la collection est initialisée
    if (!collection.value) {
      return 0;
    }

    const uniqueCardsInCollection = Object.keys(collection.value).length;
    return Math.round((uniqueCardsInCollection / cards.value.length) * 100);
  });

  function getCardQuantity(cardId: string): number {
    if (!collection.value) {
      return 0;
    }

    if (!cardId || !collection.value[cardId]) {
      return 0;
    }

    // Retourner la quantité normale de la carte
    return collection.value[cardId].normal || 0;
  }

  function getFoilCardQuantity(cardId: string): number {
    if (!collection.value) {
      return 0;
    }

    if (!cardId || !collection.value[cardId]) {
      return 0;
    }

    // Retourner la quantité foil de la carte
    return collection.value[cardId].foil || 0;
  }

  const extensions = computed(() => {
    const uniqueExtensions = new Set(
      cards.value.map((card) => card.extension.name),
    );
    return Array.from(uniqueExtensions).sort();
  });

  const collectionStats = computed(() => {
    // Vérifier si la collection est initialisée
    if (!collection.value) {
      return {
        totalCards: 0,
        totalQuantity: 0,
        normalCards: 0,
        foilCards: 0,
      };
    }

    const totalCards = Object.keys(collection.value).length;
    const totalQuantity = Object.values(collection.value).reduce(
      (acc, { normal, foil }) => acc + normal + foil,
      0,
    );

    return {
      totalCards,
      totalQuantity,
      normalCards: Object.values(collection.value).reduce(
        (acc, { normal }) => acc + normal,
        0,
      ),
      foilCards: Object.values(collection.value).reduce(
        (acc, { foil }) => acc + foil,
        0,
      ),
    };
  });

  // Formater la date de dernière synchronisation
  const formatLastSync = computed(() => {
    if (!lastSync.value) return "Jamais";

    const syncDate = new Date(lastSync.value);
    const now = new Date();
    const diffMs = now.getTime() - syncDate.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffHour < 24) return `Il y a ${diffHour} h`;
    if (diffDay < 7) return `Il y a ${diffDay} j`;

    // Format date pour plus de 7 jours
    return syncDate.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  });

  // Actions
  async function initialize() {
    try {
      isInitializing.value = true;

      // Vérifier si les données sont déjà chargées
      if (isInitialized.value && cards.value.length > 0) {
        return;
      }

      try {
        // Charger les cartes en utilisant le service cardLoader
        const loadedCards = await loadAllCards();

        if (!Array.isArray(loadedCards) || loadedCards.length === 0) {
          throw new Error("Aucune carte n'a pu être chargée");
        }

        setCards(loadedCards);
      } catch {
        // Fallback: essayer de charger depuis l'API
        const response = await fetch("/api/collection/initial");

        if (!response.ok) {
          throw new Error(
            `Erreur lors du chargement des cartes: ${response.status}`,
          );
        }

        const data = await response.json();

        if (data && data.cards && Array.isArray(data.cards)) {
          setCards(data.cards);
        } else {
          setCards([]);
        }
      }

      // S'assurer que la collection est initialisée comme un objet vide si elle ne l'est pas déjà
      if (!collection.value) {
        collection.value = {};
      }

      // Charger depuis le stockage local (espace du compte actif)
      collection.value = localStorageService.loadCollection();

      // Marquer comme initialisé
      isInitialized.value = true;

      // La synchronisation cloud (collection + decks) est orchestrée par le
      // authStore (hydrateForUser), une fois le catalogue chargé.
    } catch (error) {
      throw error;
    } finally {
      isInitializing.value = false;
    }
  }

  // --- Suivi des modifications locales non poussées (anti-perte) ------------
  // Ids de cartes modifiés localement depuis le dernier push réussi. PERSISTÉ
  // (par compte) : la perte se joue précisément au rechargement de page, quand
  // un pull écraserait des modifications dont le push n'est jamais parti.
  function dirtyStorageKey(): string {
    return namespacedKey("wakfu-collection-dirty");
  }

  function loadDirtyIds(): Set<string> {
    try {
      const raw = localStorage.getItem(dirtyStorageKey());
      const parsed = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  }

  let dirtyIds = loadDirtyIds();

  function saveDirtyIds() {
    try {
      localStorage.setItem(dirtyStorageKey(), JSON.stringify([...dirtyIds]));
    } catch {
      /* quota : le suivi reste en mémoire */
    }
  }

  function markDirty(cardId: string) {
    dirtyIds.add(cardId);
    saveDirtyIds();
  }

  // Recharge la collection depuis le stockage du compte actif.
  // Appelé après connexion/déconnexion (changement d'espace de stockage).
  function reloadCollection() {
    collection.value = localStorageService.loadCollection();
    dirtyIds = loadDirtyIds();
  }

  // Vide la collection en mémoire (à la déconnexion).
  function clearCollection() {
    collection.value = {};
    // Le suivi « non poussé » du compte reste persisté (repris à la prochaine
    // connexion) ; on vide seulement l'état en mémoire.
    dirtyIds = new Set();
    // Horodatage de synchro propre au compte : on le réinitialise au logout
    // pour ne pas afficher le « dernier sync » d'un autre utilisateur.
    lastSync.value = null;
    syncState.value = "idle";
  }

  /**
   * En mode cloud connecté, synchronise la collection avec Supabase en
   * FUSIONNANT : le cloud fait autorité (multi-appareils) SAUF pour les cartes
   * modifiées localement et pas encore poussées (suivi `dirtyIds`, persisté) —
   * sinon un push perdu suivi d'un refresh écraserait le travail local.
   * Cloud vide : on l'initialise depuis le local.
   * Best-effort : toute erreur (hors-ligne, etc.) est ignorée silencieusement.
   */
  async function pullCloudCollection() {
    try {
      if (!isSupabaseConfigured()) return;
      if (!useAuthStore().isAuthenticated) return;

      const cloud = await loadCollectionFromCloud();
      // null = erreur réseau / indisponible : ne RIEN écraser côté cloud.
      if (cloud === null) return;
      if (Object.keys(cloud).length === 0) {
        // Cloud confirmé vide : on l'initialise depuis le local.
        await saveCollectionToCloud(collection.value);
        return;
      }

      const merged = { ...cloud };
      let keptLocal = false;
      for (const id of dirtyIds) {
        const local = collection.value[id];
        if (local) {
          merged[id] = local;
        } else {
          // Suppression locale jamais poussée : ne pas ressusciter la carte.
          delete merged[id];
          deleteCollectionEntryFromCloudIfNeeded(id);
        }
        keptLocal = true;
      }
      collection.value = merged;
      localStorageService.saveCollection(merged);
      // Des valeurs locales ont prévalu → le cloud est périmé, on le répare.
      if (keptLocal) pushCollectionToCloudDebounced();
    } catch {
      // best-effort : on reste sur les données locales
    }
  }

  /** Supprime une carte du cloud quand elle quitte la collection (non bloquant). */
  function deleteCollectionEntryFromCloudIfNeeded(cardId: string) {
    void (async () => {
      try {
        if (!isSupabaseConfigured()) return;
        if (!useAuthStore().isAuthenticated) return;
        await deleteCollectionEntryFromCloud(cardId);
      } catch {
        // silencieux : best-effort
      }
    })();
  }

  // --- Push cloud de la collection : débouncé, avec retries (anti-perte) ----
  let cloudPushTimeout: ReturnType<typeof setTimeout> | null = null;
  let cloudPushRetries = 0;
  const MAX_PUSH_RETRIES = 2;
  const PUSH_RETRY_DELAY = 5000;

  function pushCollectionToCloudDebounced() {
    cloudPushRetries = 0;
    if (cloudPushTimeout) clearTimeout(cloudPushTimeout);
    cloudPushTimeout = setTimeout(() => {
      cloudPushTimeout = null;
      void pushCollectionToCloudNow();
    }, 1500);
  }

  /**
   * Force immédiatement un push en attente (pagehide, déconnexion) : sans lui,
   * un rechargement pendant le debounce perd la dernière modification.
   */
  async function flushCollectionPush() {
    if (cloudPushTimeout) {
      clearTimeout(cloudPushTimeout);
      cloudPushTimeout = null;
      await pushCollectionToCloudNow();
    }
  }

  /** Programme une nouvelle tentative après un push en échec (borné). */
  function schedulePushRetry() {
    if (cloudPushRetries < MAX_PUSH_RETRIES) {
      cloudPushRetries++;
      if (cloudPushTimeout) clearTimeout(cloudPushTimeout);
      cloudPushTimeout = setTimeout(() => {
        cloudPushTimeout = null;
        void pushCollectionToCloudNow();
      }, PUSH_RETRY_DELAY);
    } else {
      syncState.value = "error";
    }
  }

  async function pushCollectionToCloudNow() {
    try {
      if (!isSupabaseConfigured()) return;
      if (!useAuthStore().isAuthenticated) {
        // Supabase configuré mais session absente/expirée : la modification
        // n'est PAS persistée — l'UI doit le refléter, pas laisser « synced ».
        syncState.value = "error";
        return;
      }
      syncState.value = "syncing";
      // Instantané des ids couverts par CE push : les modifications arrivées
      // pendant l'envoi restent marquées non poussées.
      const pushedIds = [...dirtyIds];
      const ok = await saveCollectionToCloud(collection.value);
      if (ok) {
        syncState.value = "synced";
        cloudPushRetries = 0;
        for (const id of pushedIds) dirtyIds.delete(id);
        saveDirtyIds();
      } else {
        // false = échec d'écriture (réseau/RLS) : on re-tente puis on signale.
        schedulePushRetry();
      }
    } catch {
      // la sauvegarde locale reste la source de secours
      schedulePushRetry();
    }
  }

  // Un rechargement/fermeture d'onglet pendant le debounce perdait le dernier
  // push (puis le pull suivant écrasait le local avec le cloud périmé). On
  // force donc le push en attente dès que la page se cache ou se décharge.
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => {
      void flushCollectionPush();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void flushCollectionPush();
    });
  }

  async function addToCollection(card: Card, quantity = 1, isFoil = false) {
    if (!isInitialized.value) {
      await initialize();
    }

    // Create the card entry if it doesn't exist
    if (!collection.value[card.id]) {
      collection.value[card.id] = { normal: 0, foil: 0 };
    }

    // Increment the appropriate counter
    if (isFoil) {
      collection.value[card.id].foil += quantity;
    } else {
      collection.value[card.id].normal += quantity;
    }

    // Marquée « non poussée » jusqu'au prochain push réussi (anti-perte).
    markDirty(card.id);

    // saveToLocalStorage() écrit déjà le cache local puis pousse vers le cloud
    // (best-effort, non bloquant) — une seule écriture, pas de double write.
    saveToLocalStorage().catch(() => {});
  }

  async function removeFromCollection(
    card: Card,
    quantity = 1,
    isFoil = false,
  ) {
    if (!isInitialized.value) {
      await initialize();
    }

    // If the card doesn't exist in the collection, nothing to do
    if (!collection.value[card.id]) return;

    // Decrement the appropriate counter
    if (isFoil) {
      collection.value[card.id].foil = Math.max(
        0,
        collection.value[card.id].foil - quantity,
      );
    } else {
      collection.value[card.id].normal = Math.max(
        0,
        collection.value[card.id].normal - quantity,
      );
    }

    // Remove the card entry if both normal and foil counts are zero
    if (
      collection.value[card.id].normal === 0 &&
      collection.value[card.id].foil === 0
    ) {
      delete collection.value[card.id];
      // Propager la suppression au cloud (sinon la carte réapparaît au pull).
      deleteCollectionEntryFromCloudIfNeeded(card.id);
    }

    // Marquée « non poussée » (le pull ne doit ni écraser ni ressusciter).
    markDirty(card.id);

    // saveToLocalStorage() écrit déjà le cache local puis pousse vers le cloud
    // (best-effort, non bloquant) — une seule écriture, pas de double write.
    saveToLocalStorage().catch(() => {});
  }

  async function getCardById(id: string): Promise<Card | undefined> {
    if (!isInitialized.value) {
      await initialize();
    }
    return cardIndex.value.get(id);
  }

  /** Lookup synchrone via l'index (suppose le catalogue déjà chargé). */
  function getCardByIdSync(id: string): Card | undefined {
    return cardIndex.value.get(id);
  }

  async function findCardsByName(name: string): Promise<Card[]> {
    if (!isInitialized.value) {
      await initialize();
    }

    return cards.value.filter((card) => matchesSearch(card.name, name));
  }

  function setCards(newCards: Card[]) {
    if (!Array.isArray(newCards)) {
      return;
    }

    cards.value = newCards;
  }

  // Fonction de réinitialisation du store
  function reset() {
    cards.value = [];
    isInitialized.value = false;
    initializationAttempts.value = 0;
    error.value = null;
    loading.value = false;
  }

  async function importCollection(data: CollectionCard[]) {
    if (!isInitialized.value) {
      await initialize();
    }

    // Convert the old array format to the new Record format
    const newCollection: Record<string, { normal: number; foil: number }> = {};

    data.forEach((item) => {
      newCollection[item.card.id] = {
        normal: item.quantity,
        foil: item.foilQuantity,
      };
    });

    collection.value = newCollection;
  }

  function exportCollection(): CollectionCard[] {
    // Vérifier si la collection est initialisée
    if (!collection.value) {
      return [];
    }

    // Convertir le format Record en format tableau pour l'export
    const exportData: CollectionCard[] = [];

    for (const [cardId, quantities] of Object.entries(collection.value)) {
      const card = cardIndex.value.get(cardId);
      if (card) {
        exportData.push({
          card,
          quantity: quantities.normal,
          foilQuantity: quantities.foil,
        });
      }
    }

    return exportData;
  }

  function isCardOwned(card: Card): boolean {
    // Vérifier si la collection est initialisée
    if (!collection.value) {
      return false;
    }

    // Vérifier si la carte existe et a une quantité positive
    return Boolean(
      card &&
        card.id &&
        collection.value[card.id] &&
        (collection.value[card.id].normal > 0 ||
          collection.value[card.id].foil > 0),
    );
  }

  function getTotalCardQuantity(cardId: string): number {
    // Vérifier si la collection est initialisée
    if (!collection.value) {
      return 0;
    }

    // Utiliser les fonctions existantes pour obtenir les quantités
    return getCardQuantity(cardId) + getFoilCardQuantity(cardId);
  }

  async function saveToLocalStorage() {
    // Écrit le cache local, puis pousse vers le cloud si connecté
    try {
      isSyncing.value = true;
      localStorageService.saveCollection(collection.value);
      lastSync.value = new Date().toISOString();

      // Pousser vers le cloud si connecté (différé + retries, non bloquant)
      pushCollectionToCloudDebounced();

      return { success: true, timestamp: lastSync.value };
    } catch (error) {
      console.error("❌ Erreur lors de la sauvegarde locale:", error);
      return {
        success: false,
        reason: "save_failed",
        error: error as Error,
      };
    } finally {
      isSyncing.value = false;
    }
  }

  return {
    // État
    cards,
    cardIndex,
    printingsIndex,
    printingsOf,
    collection,
    isInitializing,
    isInitialized,
    loading,
    error,
    reset,
    lastSync,
    isSyncing,
    syncState,

    // Getters
    totalCards,
    totalCollection,
    collectionProgress,
    collectionStats,
    formatLastSync,
    extensions,

    // Actions
    initialize,
    reloadCollection,
    clearCollection,
    pullCloudCollection,
    flushCollectionPush,
    addToCollection,
    removeFromCollection,
    getCardById,
    getCardByIdSync,
    getCardQuantity,
    getFoilCardQuantity,
    findCardsByName,
    importCollection,
    exportCollection,
    saveToLocalStorage,
    isCardOwned,
    getTotalCardQuantity,
    // Exposés utilitaires
    setCards,
    updateCollection: (payload: unknown) => {
      if (!isValidCollection(payload)) return;
      collection.value = payload;
      localStorageService.saveCollection(collection.value);
    },
  };
});
