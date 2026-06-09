import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { Card, Deck, DeckCard } from "@/types/cards";
import { DECK_CONSTRAINTS } from "@/config/cards";
import { isUniqueCard, maxCopiesForCard } from "@/utils/cardRules";
import { useCardStore } from "./cardStore";
import { namespacedKey } from "@/services/storageNamespace";

// Configuration
// Clé de stockage des decks, namespacée par compte actif (invité = clé de base).
function decksStorageKey(): string {
  return namespacedKey("wakfu-decks");
}
const MAX_COPIES_PER_CARD = DECK_CONSTRAINTS.MAX_COPIES;
const MIN_DECK_SIZE = DECK_CONSTRAINTS.MIN_CARDS;
const MAX_DECK_SIZE = DECK_CONSTRAINTS.MAX_CARDS;
const MAX_RESERVE = 12;

/**
 * Store pour la gestion des decks
 */
export const useDeckStore = defineStore("deck", () => {
  // État du store
  const decks = ref<Deck[]>([]);
  const currentDeckId = ref<string | null>(null);
  const loadingError = ref<string | null>(null);
  // État de la dernière synchro cloud (decks), surfacé dans l'UI.
  const syncState = ref<"idle" | "syncing" | "synced" | "error">("idle");

  // Stores externes
  const cardStore = useCardStore();

  // Getters
  const currentDeck = computed(() => {
    if (!currentDeckId.value) return null;
    return decks.value.find((d) => d.id === currentDeckId.value) || null;
  });

  const heroCount = computed(() => (currentDeck.value?.hero ? 1 : 0));
  const havreSacCount = computed(() => (currentDeck.value?.havreSac ? 1 : 0));

  // Deck principal uniquement (hors réserve).
  const cardCount = computed(() => {
    if (!currentDeck.value) return 0;
    return currentDeck.value.cards
      .filter((c) => !c.isReserve)
      .reduce((acc, card) => acc + card.quantity, 0);
  });

  // Réserve (sideboard, max 12).
  const reserveCount = computed(() => {
    if (!currentDeck.value) return 0;
    return currentDeck.value.cards
      .filter((c) => c.isReserve)
      .reduce((acc, card) => acc + card.quantity, 0);
  });

  const totalCount = computed(
    () => heroCount.value + havreSacCount.value + cardCount.value,
  );

  const isValid = computed(() => {
    // Un deck valide doit avoir:
    // - Exactement 1 héros
    // - Exactement 1 havre-sac
    // - Exactement 48 cartes (hors héros et havre-sac)
    return (
      heroCount.value === 1 &&
      havreSacCount.value === 1 &&
      cardCount.value === MIN_DECK_SIZE
    );
  });

  // Cartes du deck principal (hors réserve) — base des statistiques.
  const mainCards = computed(
    () => currentDeck.value?.cards.filter((c) => !c.isReserve) ?? [],
  );

  const uniqueCardCount = computed(
    () => new Set(mainCards.value.map((c) => c.card.id)).size,
  );

  const elementDistribution = computed(() => {
    if (!currentDeck.value) return {};

    const distribution: Record<string, number> = {};

    mainCards.value.forEach((deckCard) => {
      // Déterminer l'élément de la carte à partir de ses attributs
      const element =
        deckCard.card.stats?.niveau?.element ||
        deckCard.card.stats?.force?.element ||
        "Neutre";
      distribution[element] = (distribution[element] || 0) + deckCard.quantity;
    });

    return distribution;
  });

  const typeDistribution = computed(() => {
    if (!currentDeck.value) return {};

    const distribution: Record<string, number> = {};

    mainCards.value.forEach((deckCard) => {
      const type = deckCard.card.mainType;
      distribution[type] = (distribution[type] || 0) + deckCard.quantity;
    });

    return distribution;
  });

  const costCurve = computed(() => {
    if (!currentDeck.value) return {};

    const curve: Record<number, number> = {};

    mainCards.value.forEach((deckCard) => {
      const cost = deckCard.card.stats?.pa || 0;
      curve[cost] = (curve[cost] || 0) + deckCard.quantity;
    });

    // Formatter pour l'affichage
    return Object.entries(curve)
      .map(([cost, count]) => ({
        cost: parseInt(cost),
        count,
      }))
      .sort((a, b) => a.cost - b.cost);
  });

  /**
   * Charge les decks depuis le stockage local
   */
  function loadDecks() {
    try {
      loadingError.value = null;
      const stored = localStorage.getItem(decksStorageKey());

      if (stored) {
        const parsedDecks = JSON.parse(stored);

        // Validation basique pour s'assurer que le format est correct
        if (Array.isArray(parsedDecks)) {
          // Migration automatique du format des cartes
          const migratedDecks = parsedDecks.map((deck: any) => {
            // Si cards est un objet Record<string, number>, le convertir en DeckCard[]
            if (
              deck.cards &&
              typeof deck.cards === "object" &&
              !Array.isArray(deck.cards)
            ) {
              // Convertir l'objet en array
              const migratedCards: any[] = [];
              for (const [cardId, quantity] of Object.entries(deck.cards)) {
                if (typeof quantity === "number" && quantity > 0) {
                  // Chercher la carte dans le store
                  const card = cardStore.cards.find((c) => c.id === cardId);
                  if (card) {
                    migratedCards.push({
                      card: card,
                      quantity: quantity,
                    });
                  }
                }
              }

              return {
                ...deck,
                cards: migratedCards,
                reserve: deck.reserve || [],
              };
            }

            // Si c'est déjà un array ou si cards n'existe pas, garder tel quel
            return {
              ...deck,
              cards: deck.cards || [],
              reserve: deck.reserve || [],
            };
          });

          decks.value = migratedDecks;

          // Sauvegarder le format migré en cache LOCAL uniquement : un push
          // cloud ici (dépendant du catalogue, parfois pas encore chargé)
          // risquerait d'écraser le cloud. pullCloudDecks gère l'autorité.
          if (migratedDecks.some((deck: any) => deck.cards.length > 0)) {
            saveDecks({ skipCloud: true });
          }
        } else {
          throw new Error("Format de données invalide");
        }
      }
    } catch (error) {
      console.error("Erreur lors du chargement des decks:", error);
      loadingError.value =
        error instanceof Error ? error.message : "Erreur inconnue";
      decks.value = [];
    }
  }

  /**
   * Sauvegarde les decks dans le cache local, puis (mode connecté) pousse vers
   * le cloud de façon différée. `skipCloud` évite de re-pousser juste après un
   * pull.
   */
  function saveDecks(opts?: { skipCloud?: boolean }) {
    try {
      localStorage.setItem(decksStorageKey(), JSON.stringify(decks.value));
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des decks:", error);
      loadingError.value =
        error instanceof Error ? error.message : "Erreur inconnue";
    }
    if (!opts?.skipCloud) pushDecksToCloudDebounced();
  }

  // --- Synchronisation cloud des decks (best-effort, mode connecté) ---
  let cloudPushTimeout: ReturnType<typeof setTimeout> | null = null;

  function pushDecksToCloudDebounced() {
    if (cloudPushTimeout) clearTimeout(cloudPushTimeout);
    cloudPushTimeout = setTimeout(() => {
      void pushDecksToCloudNow();
    }, 1500);
  }

  /** Annule un push différé en attente (ex. au changement de compte). */
  function cancelCloudPush() {
    if (cloudPushTimeout) {
      clearTimeout(cloudPushTimeout);
      cloudPushTimeout = null;
    }
  }

  /**
   * Force immédiatement un push en attente (utilisé AVANT la déconnexion, tant
   * que la session est encore valide), pour ne pas perdre la dernière
   * modification si l'utilisateur se déconnecte pendant le debounce.
   */
  async function flushCloudPush() {
    if (cloudPushTimeout) {
      clearTimeout(cloudPushTimeout);
      cloudPushTimeout = null;
      await pushDecksToCloudNow();
    }
  }

  async function pushDecksToCloudNow() {
    try {
      const { isSupabaseConfigured } = await import("@/services/supabase");
      if (!isSupabaseConfigured()) return;
      const { useAuthStore } = await import("@/stores/authStore");
      const auth = useAuthStore();
      if (!auth.isAuthenticated || !auth.userId) return;
      syncState.value = "syncing";
      const { saveDecksToCloud, deckToCloud } = await import(
        "@/services/cloudSync"
      );
      const userId = auth.userId;
      const ok = await saveDecksToCloud(
        decks.value.map((d) => deckToCloud(d, userId)),
      );
      syncState.value = ok ? "synced" : "error";
    } catch {
      syncState.value = "error";
      // le cache local reste la source de secours
    }
  }

  /**
   * Récupère les decks depuis Supabase (autorité) et reconstruit les decks
   * locaux. Nécessite que le catalogue de cartes soit chargé pour résoudre les
   * cartes. Best-effort.
   */
  async function pullCloudDecks() {
    try {
      const { isSupabaseConfigured } = await import("@/services/supabase");
      if (!isSupabaseConfigured()) return;
      const { useAuthStore } = await import("@/stores/authStore");
      const auth = useAuthStore();
      if (!auth.isAuthenticated || !auth.userId) return;

      // Garde : sans catalogue chargé, cloudToDeck ne résoudrait aucune carte
      // et on écraserait les decks par des coquilles vides. On attend.
      if (cardStore.cards.length === 0) return;

      const { loadDecksFromCloud, cloudToDeck, saveDecksToCloud, deckToCloud } =
        await import("@/services/cloudSync");
      const cloud = await loadDecksFromCloud();
      // null = erreur réseau / indisponible : ne RIEN écraser.
      if (cloud === null) return;
      const resolve = (cardId: string) =>
        cardStore.cards.find((c) => c.id === cardId);

      if (cloud.length > 0) {
        decks.value = cloud.map((cd) => cloudToDeck(cd, resolve));
        saveDecks({ skipCloud: true });
      } else if (decks.value.length > 0) {
        // Cloud confirmé vide : on l'initialise depuis le cache local.
        const userId = auth.userId;
        await saveDecksToCloud(decks.value.map((d) => deckToCloud(d, userId)));
      }
    } catch {
      // offline : on garde le cache local
    }
  }

  /** Vide les decks en mémoire (à la déconnexion). */
  function clearAll() {
    // Annule un push différé du compte précédent avant de vider l'état,
    // pour éviter qu'il n'écrive dans l'espace du nouveau compte.
    cancelCloudPush();
    decks.value = [];
    currentDeckId.value = null;
  }

  /**
   * Crée un nouveau deck
   * @param name Nom du deck
   * @returns ID du nouveau deck
   */
  function createDeck(name: string) {
    const newDeck: Deck = {
      id: generateId(),
      name: name.trim() || "Nouveau deck",
      hero: null,
      havreSac: null,
      cards: [],
      reserve: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    decks.value.push(newDeck);
    currentDeckId.value = newDeck.id;
    saveDecks();

    return newDeck.id;
  }

  /**
   * Duplique un deck existant (copie profonde, nouvel id).
   * @param id ID du deck à dupliquer
   * @returns ID du nouveau deck, ou null
   */
  function duplicateDeck(id: string): string | null {
    const source = decks.value.find((d) => d.id === id);
    if (!source) return null;

    const now = new Date().toISOString();
    const clone: Deck = {
      ...JSON.parse(JSON.stringify(source)),
      id: generateId(),
      name: `${source.name} (copie)`,
      isOfficial: false,
      createdAt: now,
      updatedAt: now,
    };

    decks.value.push(clone);
    currentDeckId.value = clone.id;
    saveDecks();
    return clone.id;
  }

  /**
   * Supprime un deck
   * @param id ID du deck à supprimer
   */
  function deleteDeck(id: string) {
    const index = decks.value.findIndex((d) => d.id === id);
    if (index !== -1) {
      decks.value.splice(index, 1);

      if (currentDeckId.value === id) {
        currentDeckId.value = decks.value.length > 0 ? decks.value[0].id : null;
      }

      saveDecks();

      // Suppression côté cloud (best-effort, mode connecté)
      void (async () => {
        try {
          const { isSupabaseConfigured } = await import("@/services/supabase");
          if (!isSupabaseConfigured()) return;
          const { deleteDeckFromCloud } = await import("@/services/cloudSync");
          await deleteDeckFromCloud(id);
        } catch {
          /* best-effort */
        }
      })();
    }
  }

  /**
   * Définit le deck actif
   * @param id ID du deck à activer
   */
  function setCurrentDeck(id: string) {
    const deck = decks.value.find((d) => d.id === id);
    if (deck) {
      currentDeckId.value = id;
    }
  }

  /**
   * Renomme un deck
   * @param id ID du deck à renommer
   * @param newName Nouveau nom du deck
   */
  function renameDeck(id: string, newName: string) {
    const deck = decks.value.find((d) => d.id === id);
    if (deck) {
      deck.name = newName.trim() || deck.name;
      deck.updatedAt = new Date().toISOString();
      saveDecks();
    }
  }

  /**
   * Met à jour les notes / la description d'un deck.
   */
  function setDeckDescription(id: string, description: string) {
    const deck = decks.value.find((d) => d.id === id);
    if (deck) {
      deck.description = description;
      deck.updatedAt = new Date().toISOString();
      saveDecks();
    }
  }

  /**
   * Retourne l'URL de l'image d'une carte
   * @param card Carte
   * @returns URL de l'image
   */
  function getCardImageUrl(card: Card): string {
    if (card.imageUrl) return card.imageUrl;

    if (card.mainType === "Héros") {
      return `/images/cards/${card.id}_recto.webp`;
    }

    return `/images/cards/${card.id}.webp`;
  }

  /**
   * Crée une copie profonde d'une carte avec l'URL d'image correcte
   * @param card Carte à copier
   * @returns Copie de la carte
   */
  function prepareCardForDeck(card: Card): Card {
    const cardCopy = { ...card };
    if (!cardCopy.imageUrl) {
      cardCopy.imageUrl = getCardImageUrl(card);
    }
    return cardCopy;
  }

  /**
   * Définit le héros du deck actif
   * @param card Carte héros
   */
  function setHero(card: Card) {
    if (!currentDeck.value) return;
    if (card.mainType !== "Héros") return;

    currentDeck.value.hero = prepareCardForDeck(card);
    currentDeck.value.updatedAt = new Date().toISOString();
    saveDecks();
  }

  /**
   * Définit le havre-sac du deck actif
   * @param card Carte havre-sac
   */
  function setHavreSac(card: Card) {
    if (!currentDeck.value) return;
    if (card.mainType !== "Havre-Sac") return;

    currentDeck.value.havreSac = prepareCardForDeck(card);
    currentDeck.value.updatedAt = new Date().toISOString();
    saveDecks();
  }

  /**
   * Ajoute une carte au deck actif
   * @param card Carte à ajouter
   * @param quantity Quantité à ajouter (défaut: 1)
   */
  function addCard(
    card: Card,
    quantity: number = 1,
    isReserve: boolean = false,
  ) {
    if (!currentDeck.value) return;
    if (card.mainType === "Héros") {
      setHero(card);
      return;
    }
    if (card.mainType === "Havre-Sac") {
      setHavreSac(card);
      return;
    }

    const preparedCard = prepareCardForDeck(card);

    // Règle TCG : 1 exemplaire pour les cartes "Unique", sinon 3.
    // La limite de copies s'applique au TOTAL (deck principal + réserve).
    const maxCopies = isUniqueCard(card) ? 1 : MAX_COPIES_PER_CARD;
    const totalCopies = currentDeck.value.cards
      .filter((c) => c.card.id === card.id)
      .reduce((a, c) => a + c.quantity, 0);
    let room = maxCopies - totalCopies;
    // Capacité de zone (48 principal / 12 réserve).
    if (isReserve) room = Math.min(room, MAX_RESERVE - reserveCount.value);
    else room = Math.min(room, MAX_DECK_SIZE - cardCount.value);
    const toAdd = Math.min(quantity, room);
    if (toAdd <= 0) return;

    const existingCard = currentDeck.value.cards.find(
      (c) => c.card.id === card.id && !!c.isReserve === isReserve,
    );
    if (existingCard) {
      existingCard.quantity += toAdd;
    } else {
      const entry: DeckCard = { card: preparedCard, quantity: toAdd };
      if (isReserve) entry.isReserve = true;
      currentDeck.value.cards.push(entry);
    }

    currentDeck.value.updatedAt = new Date().toISOString();
    saveDecks();
  }

  /**
   * Retire une carte du deck actif
   * @param cardId ID de la carte à retirer
   * @param quantity Quantité à retirer (défaut: 1)
   */
  function removeCard(
    cardId: string,
    quantity: number = 1,
    isReserve: boolean = false,
  ) {
    if (!currentDeck.value) return;

    const index = currentDeck.value.cards.findIndex(
      (c) => c.card.id === cardId && !!c.isReserve === isReserve,
    );
    if (index === -1) return;

    const card = currentDeck.value.cards[index];
    card.quantity -= quantity;

    if (card.quantity <= 0) {
      currentDeck.value.cards.splice(index, 1);
    }

    currentDeck.value.updatedAt = new Date().toISOString();
    saveDecks();
  }

  /**
   * Déplace des copies d'une carte entre deck principal et réserve.
   * @param cardId carte à déplacer
   * @param toReserve true = principal→réserve, false = réserve→principal
   * @param quantity nombre de copies à déplacer (défaut 1)
   */
  function moveCardZone(
    cardId: string,
    toReserve: boolean,
    quantity: number = 1,
  ) {
    if (!currentDeck.value) return;
    const src = currentDeck.value.cards.find(
      (c) => c.card.id === cardId && !!c.isReserve === !toReserve,
    );
    if (!src) return;

    let qty = Math.min(quantity, src.quantity);
    if (toReserve) qty = Math.min(qty, MAX_RESERVE - reserveCount.value);
    else qty = Math.min(qty, MAX_DECK_SIZE - cardCount.value);
    if (qty <= 0) return;

    const movedCard = src.card;
    src.quantity -= qty;
    if (src.quantity <= 0) {
      currentDeck.value.cards.splice(currentDeck.value.cards.indexOf(src), 1);
    }

    const tgt = currentDeck.value.cards.find(
      (c) => c.card.id === cardId && !!c.isReserve === toReserve,
    );
    if (tgt) {
      tgt.quantity += qty;
    } else {
      const entry: DeckCard = { card: movedCard, quantity: qty };
      if (toReserve) entry.isReserve = true;
      currentDeck.value.cards.push(entry);
    }

    currentDeck.value.updatedAt = new Date().toISOString();
    saveDecks();
  }

  /**
   * Retire le héros du deck actif
   */
  function removeHero() {
    if (!currentDeck.value) return;

    currentDeck.value.hero = null;
    currentDeck.value.updatedAt = new Date().toISOString();
    saveDecks();
  }

  /**
   * Retire le havre-sac du deck actif
   */
  function removeHavreSac() {
    if (!currentDeck.value) return;

    currentDeck.value.havreSac = null;
    currentDeck.value.updatedAt = new Date().toISOString();
    saveDecks();
  }

  /**
   * Vide le deck actif
   */
  function clearDeck() {
    if (!currentDeck.value) return;

    currentDeck.value.hero = null;
    currentDeck.value.havreSac = null;
    currentDeck.value.cards = [];
    currentDeck.value.updatedAt = new Date().toISOString();
    saveDecks();
  }

  /**
   * Normalise un texte pour la comparaison (supprime accents, espaces, met en minuscule)
   * @param text Texte à normaliser
   * @returns Texte normalisé
   */
  function normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Supprime les accents
      .replace(/\s+/g, " ") // Normalise les espaces multiples
      .trim();
  }

  /**
   * Trouve une carte par son nom avec une recherche robuste
   * @param cardName Nom de la carte à chercher
   * @param cardType Type de carte optionnel
   * @returns Carte trouvée ou null
   */
  function findCardByName(cardName: string, cardType?: string): Card | null {
    const normalizedCardName = normalizeText(cardName);
    const normalizedCardType = cardType ? normalizeText(cardType) : null;

    // Recherche exacte d'abord
    let matchedCards = cardStore.cards.filter((c) => {
      const nameMatch = normalizeText(c.name) === normalizedCardName;
      const typeMatch =
        !normalizedCardType || normalizeText(c.mainType) === normalizedCardType;
      return nameMatch && typeMatch;
    });

    if (matchedCards.length > 0) {
      return matchedCards[0];
    }

    // Recherche par correspondance de début de nom (plus stricte)
    matchedCards = cardStore.cards.filter((c) => {
      const normalizedCardNameFromDB = normalizeText(c.name);
      const nameMatch =
        normalizedCardNameFromDB.startsWith(normalizedCardName) ||
        normalizedCardName.startsWith(normalizedCardNameFromDB);
      const typeMatch =
        !normalizedCardType || normalizeText(c.mainType) === normalizedCardType;
      return nameMatch && typeMatch;
    });

    if (matchedCards.length === 1) {
      return matchedCards[0];
    }

    // Si plusieurs correspondances, essayer de trouver la plus proche
    if (matchedCards.length > 1) {
      // Priorité aux cartes dont le nom commence exactement par la recherche
      const startsWithMatch = matchedCards.find((c) =>
        normalizeText(c.name).startsWith(normalizedCardName),
      );
      if (startsWithMatch) {
        return startsWithMatch;
      }

      // Sinon, priorité aux cartes avec le nom le plus long (plus spécifique)
      const mostSpecificMatch = matchedCards.reduce((best, current) => {
        return normalizeText(current.name).length >
          normalizeText(best.name).length
          ? current
          : best;
      });

      return mostSpecificMatch;
    }

    return null;
  }

  /**
   * Interface pour les résultats d'import
   */
  interface ImportResult {
    success: boolean;
    deckId?: string;
    errors: string[];
    warnings: string[];
    stats: {
      totalLines: number;
      processedLines: number;
      cardsAdded: number;
      heroSet: boolean;
      havreSacSet: boolean;
    };
  }

  /**
   * Importe un deck depuis un format texte avec gestion d'erreurs détaillée
   * @param deckData Données du deck au format texte
   * @returns Résultat détaillé de l'import
   */
  function importDeck(deckData: string): ImportResult {
    const result: ImportResult = {
      success: false,
      errors: [],
      warnings: [],
      stats: {
        totalLines: 0,
        processedLines: 0,
        cardsAdded: 0,
        heroSet: false,
        havreSacSet: false,
      },
    };

    try {
      // Format attendu: liste de cartes avec nom et quantité
      const lines = deckData.trim().split("\n");
      result.stats.totalLines = lines.length;

      if (lines.length === 0) {
        result.errors.push("Aucune ligne à traiter");
        return result;
      }

      // Créer un nouveau deck avec le nom de la première ligne
      const deckName = lines[0].startsWith("#")
        ? lines[0].substring(1).trim()
        : "Deck importé";
      const deckId = createDeck(deckName);

      // Deck créé, on va le remplir
      const deck = decks.value.find((d) => d.id === deckId);
      if (!deck) {
        result.errors.push("Impossible de créer le deck");
        return result;
      }

      result.deckId = deckId;

      // Parcourir les lignes pour ajouter les cartes
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        result.stats.processedLines++;

        // Format attendu: "Quantité Nom de la carte (Type optionnel)"
        const quantityMatch = line.match(/^(\d+)\s+(.+?)(?:\s+\((.+?)\))?$/);
        if (!quantityMatch) {
          result.errors.push(`Ligne ${i + 1}: Format invalide - "${line}"`);
          continue;
        }

        const [, quantityStr, cardName, cardType] = quantityMatch;
        const quantity = parseInt(quantityStr);

        // Chercher la carte correspondante avec la nouvelle fonction robuste
        const card = findCardByName(cardName, cardType);

        if (card) {
          if (card.mainType === "Héros") {
            if (result.stats.heroSet) {
              result.warnings.push(
                `Ligne ${i + 1}: Héros déjà défini, remplacé par "${card.name}"`,
              );
            }
            deck.hero = prepareCardForDeck(card);
            result.stats.heroSet = true;
          } else if (card.mainType === "Havre-Sac") {
            if (result.stats.havreSacSet) {
              result.warnings.push(
                `Ligne ${i + 1}: Havre-Sac déjà défini, remplacé par "${card.name}"`,
              );
            }
            deck.havreSac = prepareCardForDeck(card);
            result.stats.havreSacSet = true;
          } else {
            // Plafond par carte (1 si Unique, sinon 3) ET plafond de deck (48).
            const cap = maxCopiesForCard(card, MAX_COPIES_PER_CARD);
            const mainTotal = deck.cards.reduce((a, c) => a + c.quantity, 0);
            const roomDeck = MAX_DECK_SIZE - mainTotal;
            const existingCard = deck.cards.find((c) => c.card.id === card.id);
            const already = existingCard ? existingCard.quantity : 0;
            const allowed = Math.min(quantity, cap - already, roomDeck);

            if (allowed <= 0) {
              if (roomDeck <= 0) {
                result.warnings.push(
                  `Ligne ${i + 1}: deck principal plein (${MAX_DECK_SIZE}), "${card.name}" ignorée`,
                );
              } else {
                result.warnings.push(
                  `Ligne ${i + 1}: "${card.name}" limitée à ${cap} exemplaire(s)`,
                );
              }
            } else {
              if (existingCard) existingCard.quantity += allowed;
              else
                deck.cards.push({
                  card: prepareCardForDeck(card),
                  quantity: allowed,
                });
              if (allowed < quantity) {
                result.warnings.push(
                  `Ligne ${i + 1}: quantité réduite pour "${card.name}" (max ${cap} / 48 au total)`,
                );
              }
              result.stats.cardsAdded += allowed;
            }
          }
        } else {
          // Carte non trouvée - essayer de donner des suggestions
          const suggestions = cardStore.cards
            .filter((c) => {
              const normalizedName = normalizeText(c.name);
              const normalizedSearch = normalizeText(cardName);
              return (
                normalizedName.includes(normalizedSearch) ||
                normalizedSearch.includes(normalizedName)
              );
            })
            .slice(0, 3)
            .map((c) => c.name);

          let errorMsg = `Ligne ${i + 1}: Carte non trouvée - "${cardName}"`;
          if (suggestions.length > 0) {
            errorMsg += ` (Suggestions: ${suggestions.join(", ")})`;
          }
          result.errors.push(errorMsg);
        }
      }

      // Vérifications finales
      if (!result.stats.heroSet) {
        result.warnings.push("Aucun héros défini");
      }
      if (!result.stats.havreSacSet) {
        result.warnings.push("Aucun havre-sac défini");
      }

      deck.updatedAt = new Date().toISOString();
      saveDecks();

      result.success = true;
      return result;
    } catch (error) {
      console.error("Erreur lors de l'import du deck:", error);
      result.errors.push(
        `Erreur système: ${error instanceof Error ? error.message : "Erreur inconnue"}`,
      );
      return result;
    }
  }

  /**
   * Exporte un deck au format texte
   * @param id ID du deck à exporter
   * @returns Texte représentant le deck
   */
  function exportDeck(id: string): string {
    const deck = decks.value.find((d) => d.id === id);
    if (!deck) return "";

    let result = `# ${deck.name}\n`;

    if (deck.hero) {
      result += `1 ${deck.hero.name} (Héros)\n`;
    }

    if (deck.havreSac) {
      result += `1 ${deck.havreSac.name} (Havre-Sac)\n`;
    }

    // Trier les cartes par type puis par nom
    const sortedCards = [...deck.cards].sort((a, b) => {
      if (a.card.mainType !== b.card.mainType) {
        return a.card.mainType.localeCompare(b.card.mainType);
      }
      return a.card.name.localeCompare(b.card.name);
    });

    for (const deckCard of sortedCards) {
      result += `${deckCard.quantity} ${deckCard.card.name}\n`;
    }

    return result;
  }

  /**
   * Génère un identifiant unique pour un deck.
   * UUID cryptographique (les ids base36 d'anciens decks restent valides : la
   * colonne `decks.id` est de type text).
   */
  function generateId(): string {
    if (typeof globalThis.crypto?.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
    // Fallback (environnements sans WebCrypto)
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  /**
   * Initialise le store
   */
  function initialize() {
    loadDecks();
  }

  return {
    decks,
    currentDeckId,
    currentDeck,
    heroCount,
    havreSacCount,
    cardCount,
    reserveCount,
    totalCount,
    isValid,
    uniqueCardCount,
    elementDistribution,
    typeDistribution,
    costCurve,
    loadingError,
    syncState,
    initialize,
    loadDecks,
    saveDecks,
    pullCloudDecks,
    flushCloudPush,
    clearAll,
    createDeck,
    duplicateDeck,
    deleteDeck,
    setCurrentDeck,
    renameDeck,
    setDeckDescription,
    setHero,
    setHavreSac,
    addCard,
    removeCard,
    moveCardZone,
    removeHero,
    removeHavreSac,
    clearDeck,
    importDeck,
    exportDeck,
    findCardByName,
    normalizeText,
  };
});
