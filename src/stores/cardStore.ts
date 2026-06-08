import { defineStore } from "pinia";
import { ref, shallowRef, computed } from "vue";
import type { Card, HeroCard } from "@/types/cards";
import { loadAllCards } from "@/services/cardLoader";
import { useLocalStorage } from "@vueuse/core";
import { localStorageService } from "@/services/localStorage";

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
  const collection = ref<Record<string, { normal: number; foil: number }>>({});
  const loading = ref(false);
  const error = ref<string | null>(null);
  const isInitializing = ref(false);
  const isInitialized = ref(false);
  const initializationAttempts = ref(0);
  const MAX_INIT_ATTEMPTS = 3;
  const selectedCard = ref<Card | null>(null);
  const searchQuery = ref("");
  const selectedExtension = ref<string | null>(null);

  // État de synchronisation
  const lastSync = useLocalStorage<string | null>("wakfu-last-sync", null);
  const isSyncing = ref(false);

  // Variable pour le délai de synchronisation
  let syncTimeout: number | null = null;

  // Fonction debounce pour éviter de synchroniser trop souvent
  function debounceSync() {
    if (syncTimeout) {
      clearTimeout(syncTimeout);
    }
    syncTimeout = window.setTimeout(async () => {
      const result = await saveToLocalStorage();

      // Silent failure for automatic sync
    }, 2000); // Délai de 2 secondes
  }

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
      } catch (loadError) {
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

  // Recharge la collection depuis le stockage du compte actif.
  // Appelé après connexion/déconnexion (changement d'espace de stockage).
  function reloadCollection() {
    collection.value = localStorageService.loadCollection();
  }

  // Vide la collection en mémoire (à la déconnexion).
  function clearCollection() {
    collection.value = {};
  }

  /**
   * En mode cloud connecté, synchronise la collection avec Supabase :
   *  - si le cloud contient des données, elles font autorité (multi-appareils) ;
   *  - sinon, on initialise le cloud à partir de la collection locale.
   * Best-effort : toute erreur (hors-ligne, etc.) est ignorée silencieusement.
   */
  async function pullCloudCollection() {
    try {
      const { isSupabaseConfigured } = await import("@/services/supabase");
      if (!isSupabaseConfigured()) return;
      const { useAuthStore } = await import("@/stores/authStore");
      if (!useAuthStore().isAuthenticated) return;

      const { loadCollectionFromCloud, saveCollectionToCloud } = await import(
        "@/services/cloudSync"
      );
      const cloud = await loadCollectionFromCloud();
      if (cloud && Object.keys(cloud).length > 0) {
        collection.value = cloud;
        localStorageService.saveCollection(cloud);
      } else {
        await saveCollectionToCloud(collection.value);
      }
    } catch {
      // best-effort : on reste sur les données locales
    }
  }

  /** Pousse la collection vers le cloud (mode cloud connecté), sans bloquer. */
  function pushCollectionToCloudIfNeeded(
    data: Record<string, { normal: number; foil: number }>,
  ) {
    void (async () => {
      try {
        const { isSupabaseConfigured } = await import("@/services/supabase");
        if (!isSupabaseConfigured()) return;
        const { saveCollectionToCloud } = await import("@/services/cloudSync");
        await saveCollectionToCloud(data);
      } catch {
        // silencieux : la sauvegarde locale reste la source de secours
      }
    })();
  }

  // Importer une collection (générique) et la sauver localement
  function importLocalCollection(
    collectionMap: Record<string, { normal: number; foil: number }>,
  ) {
    if (!collectionMap || typeof collectionMap !== "object") return;
    collection.value = { ...collectionMap };
    localStorageService.saveCollection(collection.value);
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

    // Force save to localStorage
    localStorageService.saveCollection(collection.value);

    // Sync to localStorage
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
    }

    // Force save to localStorage
    localStorageService.saveCollection(collection.value);

    // Sync to localStorage
    saveToLocalStorage().catch(() => {});
  }

  async function getCardById(id: string): Promise<Card | undefined> {
    if (!isInitialized.value) {
      await initialize();
    }
    return cards.value.find((card) => card.id === id);
  }

  async function findCardsByName(name: string): Promise<Card[]> {
    if (!isInitialized.value) {
      await initialize();
    }

    const searchName = name.toLowerCase();
    return cards.value.filter((card) =>
      card.name.toLowerCase().includes(searchName),
    );
  }

  function loadCards(newCards: Card[]) {
    cards.value = newCards;
  }

  function setCards(newCards: Card[]) {
    if (!Array.isArray(newCards)) {
      return;
    }

    cards.value = newCards;
  }

  function selectCard(card: Card | null) {
    selectedCard.value = card;
  }

  function setSearchQuery(query: string) {
    searchQuery.value = query;
  }

  function setSelectedExtension(extension: string | null) {
    selectedExtension.value = extension;
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
      const card = cards.value.find((c) => c.id === cardId);
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

      // Pousser vers le cloud si connecté (best-effort, non bloquant)
      pushCollectionToCloudIfNeeded(collection.value);

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

  // Fonction pour synchroniser automatiquement la collection (no-op: saves happen in addToCollection/removeFromCollection)
  function setupAutoSync() {
    // Intentionally empty: collection saves are handled by addToCollection and removeFromCollection
  }

  return {
    // État
    cards,
    collection,
    isInitializing,
    isInitialized,
    loading,
    error,
    reset,
    lastSync,
    isSyncing,

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
    addToCollection,
    removeFromCollection,
    getCardById,
    getCardQuantity,
    getFoilCardQuantity,
    findCardsByName,
    importCollection,
    exportCollection,
    saveToLocalStorage,
    setupAutoSync,
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
