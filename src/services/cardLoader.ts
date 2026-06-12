import type { Card } from "@/types/cards";

// Version du cache : à incrémenter quand la forme/normalisation des cartes
// change (sinon les anciens caches servent des données obsolètes — ex. mots-clés
// pollués, éléments en minuscules).
const CACHE_KEY = "wakfu-cards-cache-v15"; // v15 : rulings/erratas classifies (kind) + entretiens par element
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000; // 24 heures
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const EXTENSION_FILES = [
  "amakna",
  "ankama-convention-5",
  "astrub",
  "bonta-brakmar",
  "chaos-dogrest",
  "dofus-collection",
  "ile-des-wabbits",
  "incarnam",
  "otomai",
  "pandala",
  "draft",
];

interface CacheData {
  timestamp: number;
  cards: Card[];
}

function isValidCache(cache: CacheData): boolean {
  try {
    const now = Date.now();
    return now - cache.timestamp < CACHE_EXPIRATION;
  } catch {
    return false;
  }
}

async function loadFromCache(): Promise<Card[] | null> {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const cacheData: CacheData = JSON.parse(cached);
    if (!isValidCache(cacheData)) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return cacheData.cards;
  } catch (error) {
    console.error("Erreur lors du chargement du cache:", error);
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

async function saveToCache(cards: Card[]) {
  try {
    const cacheData: CacheData = {
      timestamp: Date.now(),
      cards,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.error("Erreur lors de la sauvegarde dans le cache:", error);
  }
}

function normalizeCardType(type: string): string {
  const t = (type || "").trim();
  switch (t) {
    case "Havre Sac":
    case "Havre-sac":
    case "Havre-Sac":
      return "Havre-Sac"; // unifier en 'Havre-Sac' (capital S) pour correspondre aux types définis
    case "héros":
    case "Heros":
      return "Héros";
    default:
      return t;
  }
}

function capitalizeElement(element: string): string {
  if (!element) return element;
  const lower = element.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

// Mots-clés canoniques du Wakfu TCG. Les données scrappées contiennent des
// fragments de phrases mal parsés ("Le", ",", ":", "**Résistance"…) qu'on
// filtre pour ne pas les afficher comme mots-clés.
const CANONICAL_KEYWORDS = new Set([
  "Résistance",
  "Recette",
  "Géant",
  "Fabriquer",
  "Inclinaison",
  "Portée",
  "Critique",
  "Parade",
  "Riposte",
  "Soin",
  "Tacle",
  "Esquive",
  "Initiative",
  "Invocation",
  "Unique",
  "Poison",
  "Brûlure",
  "Vol de vie",
]);

function normalizeKeywordName(name: unknown): string {
  return String(name ?? "")
    .replace(/^[^\p{L}]+/u, "") // retire les "*", ":", "," en tête
    .trim();
}

function normalizeCardElements(card: any): void {
  if (card.stats?.niveau?.element) {
    card.stats.niveau.element = capitalizeElement(card.stats.niveau.element);
  }
  if (card.stats?.force?.element) {
    card.stats.force.element = capitalizeElement(card.stats.force.element);
  }
  // Normalise la casse des éléments dans les effets et mots-clés.
  for (const eff of card.effects || []) {
    if (eff && Array.isArray(eff.elements)) {
      eff.elements = eff.elements.map(capitalizeElement);
    }
  }
  // Filtre + normalise les mots-clés (noms canoniques uniquement).
  if (Array.isArray(card.keywords)) {
    card.keywords = card.keywords
      .map((kw: any) => {
        if (!kw) return null;
        const name = normalizeKeywordName(kw.name);
        if (Array.isArray(kw.elements))
          kw.elements = kw.elements.map(capitalizeElement);
        return { ...kw, name };
      })
      .filter((kw: any) => kw && CANONICAL_KEYWORDS.has(kw.name));
  }
}

function extractElement(card: Card): string | null {
  const elements = ["Air", "Eau", "Feu", "Terre"];

  // Vérifier dans les effets pour les ressources élémentaires
  for (const effect of card.effects || []) {
    for (const element of elements) {
      if (effect.includes(`Ressource ${element}`)) {
        return element;
      }
    }
  }

  // Vérifier dans les mots-clés pour les éléments purs (sans "Résistance")
  for (const keyword of card.keywords || []) {
    for (const element of elements) {
      if (keyword === element || keyword.startsWith(`${element} :`)) {
        return element;
      }
    }
  }

  return null;
}

async function loadCardsFromFile(filePath: string): Promise<Card[]> {
  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    const cards: Card[] = await response.json();
    return cards.map((card) => {
      const normalized = {
        ...card,
        mainType: normalizeCardType(card.mainType),
        element: extractElement(card),
      };
      normalizeCardElements(normalized);
      return normalized;
    });
  } catch (error) {
    console.error(`Erreur lors du chargement de ${filePath}:`, error);
    throw error;
  }
}

async function loadFile(file: string, retryCount = 0): Promise<Card[]> {
  try {
    return await loadCardsFromFile(file);
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      return loadFile(file, retryCount + 1);
    }
    throw error;
  }
}

function fixSpecialCharacters(str: string): string {
  if (!str) return str;

  // Remplacer les caractères spéciaux mal encodés
  return str
    .replace(/Alli\?\?/g, "Allié")
    .replace(/H\?\?ros/g, "Héros")
    .replace(/\?\?quipement/g, "Équipement")
    .replace(/Sort[\s]?\?\?mentaire/g, "Sort Élémentaire")
    .replace(/r\?\?serve/g, "réserve")
    .replace(/\?\?l\?\?ment/g, "élément")
    .replace(/\?\?l\?\?mentaire/g, "élémentaire")
    .replace(/d\?\?g\?\?ts/g, "dégâts")
    .replace(/\?\?nergie/g, "énergie")
    .replace(/\?\?/g, "é"); // Dernier recours pour les 'é' non reconnus
}

async function loadExtensionCards(extension: string): Promise<Card[]> {
  try {
    const response = await fetch(`/data/${extension}.json`);
    if (!response.ok) {
      throw new Error(
        `Échec du chargement des cartes pour l'extension ${extension}: ${response.status} ${response.statusText}`,
      );
    }

    let cards;
    try {
      // On convertit d'abord en texte pour détecter les problèmes d'encodage
      const text = await response.text();

      // Si le texte ne contient aucune donnée valide
      if (!text || text.trim() === "" || text.trim() === "[]") {
        return [];
      }

      try {
        cards = JSON.parse(text);
      } catch (parseError) {
        throw parseError;
      }
    } catch (jsonError) {
      throw new Error(
        `Erreur de parsing JSON pour l'extension ${extension}: ${jsonError}`,
      );
    }

    if (!Array.isArray(cards)) {
      return [];
    }

    if (cards.length === 0) {
      return [];
    }

    // Validate and normalize each card
    const validCards = cards
      .filter((card: any) => {
        if (!card || typeof card !== "object") {
          return false;
        }
        // Vérification minimale
        if (!card.id || !card.name) {
          return false;
        }
        return true;
      })
      .map((card: any) => {
        // Normaliser la carte
        const normalizedCard = { ...card };

        // Corriger les caractères spéciaux dans des champs clés
        if (normalizedCard.name) {
          normalizedCard.name = fixSpecialCharacters(normalizedCard.name);
        }

        if (normalizedCard.mainType) {
          normalizedCard.mainType = fixSpecialCharacters(
            normalizedCard.mainType,
          );
          // Normaliser aussi le type principal
          normalizedCard.mainType = normalizeCardType(normalizedCard.mainType);
        }

        if (Array.isArray(normalizedCard.subTypes)) {
          normalizedCard.subTypes =
            normalizedCard.subTypes.map(fixSpecialCharacters);
        }

        // Normalize element casing
        normalizeCardElements(normalizedCard);

        // Ensure required properties exist
        if (!normalizedCard.id) {
          normalizedCard.id = `unknown-${Math.random().toString(36).substring(2, 10)}`;
        }

        if (!normalizedCard.name) {
          normalizedCard.name = "Carte sans nom";
        }

        if (!normalizedCard.mainType) {
          normalizedCard.mainType = "Type inconnu";
        }

        if (!Array.isArray(normalizedCard.subTypes)) {
          normalizedCard.subTypes = [];
        }

        if (!normalizedCard.rarity) {
          normalizedCard.rarity = "Commune";
        }

        // Ensure extension property is valid
        if (
          !normalizedCard.extension ||
          typeof normalizedCard.extension !== "object"
        ) {
          normalizedCard.extension = {
            name:
              extension.charAt(0).toUpperCase() +
              extension.slice(1).replace(/-/g, " "),
            id: extension,
          };
        } else if (!normalizedCard.extension.name) {
          normalizedCard.extension.name =
            extension.charAt(0).toUpperCase() +
            extension.slice(1).replace(/-/g, " ");
        }

        return normalizedCard;
      });

    return validCards;
  } catch (error) {
    console.error(
      `Erreur lors du chargement des cartes pour l'extension ${extension}:`,
      error,
    );
    return [];
  }
}

export async function loadAllCards(): Promise<Card[]> {
  try {
    // Vérifier si les cartes sont en cache
    const cachedCards = await loadFromCache();
    if (cachedCards) {
      return cachedCards;
    }

    // Charger les cartes de chaque extension en parallèle
    const results = await Promise.all(
      EXTENSION_FILES.map((extension) => loadExtensionCards(extension)),
    );
    const allCards: Card[] = [];
    for (const cards of results) {
      allCards.push(...cards);
    }

    // Mettre en cache pour les prochains chargements
    saveToCache(allCards);

    return allCards;
  } catch (error) {
    console.error("Erreur lors du chargement des cartes:", error);
    throw error;
  }
}

export async function loadCardById(
  extension: string,
  cardId: string,
): Promise<Card | null> {
  try {
    const cards = await loadExtensionCards(extension);
    return cards.find((card) => card.id === cardId) || null;
  } catch (error) {
    console.error(
      `Error loading card ${cardId} from extension ${extension}:`,
      error,
    );
    return null;
  }
}

// Fonction utilitaire pour tester le chargement d'un seul fichier JSON
export async function testJsonLoading(extension: string): Promise<any> {
  try {
    const filePath = `/data/${extension}.json`;

    const response = await fetch(filePath);

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        statusText: response.statusText,
      };
    }

    const text = await response.text();

    try {
      const data = JSON.parse(text);

      if (Array.isArray(data)) {
        return {
          success: true,
          items: data.length,
          sample: data.slice(0, 3),
        };
      } else {
        return {
          success: false,
          type: typeof data,
          data,
        };
      }
    } catch (parseError) {
      return {
        success: false,
        error: parseError.message,
        textSample: text.substring(0, 100),
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}
