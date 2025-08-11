import type { Card } from '@/types/cards'

const CACHE_KEY = 'wakfu-cards-cache'
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000 // 24 heures
const MAX_RETRIES = 3
const RETRY_DELAY = 1000

const EXTENSION_FILES = [
  'amakna',
  'ankama-convention-5',
  'astrub',
  'bonta-brakmar',
  'chaos-dogrest',
  'dofus-collection',
  'ile-des-wabbits',
  'incarnam',
  'otomai',
  'pandala',
]

interface CacheData {
  timestamp: number
  cards: Card[]
}

function isValidCache(cache: CacheData): boolean {
  try {
    const now = Date.now()
    return now - cache.timestamp < CACHE_EXPIRATION
  } catch {
    return false
  }
}

async function loadFromCache(): Promise<Card[] | null> {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null

    const cacheData: CacheData = JSON.parse(cached)
    if (!isValidCache(cacheData)) {
      localStorage.removeItem(CACHE_KEY)
      return null
    }

    console.log('📦 Chargement depuis le cache...')
    return cacheData.cards
  } catch (error) {
    console.error('❌ Erreur lors du chargement du cache:', error)
    localStorage.removeItem(CACHE_KEY)
    return null
  }
}

async function saveToCache(cards: Card[]) {
  try {
    const cacheData: CacheData = {
      timestamp: Date.now(),
      cards,
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))
    console.log('💾 Cartes sauvegardées dans le cache')
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde dans le cache:', error)
  }
}

function normalizeCardType(type: string): string {
  const t = (type || '').trim()
  switch (t) {
    case 'Havre Sac':
    case 'Havre-sac':
    case 'Havre-Sac':
      return 'Havre-sac' // unifier en 'Havre-sac' (minuscule sur sac) car c'est ce que montrent les données
    case 'héros':
    case 'Heros':
      return 'Héros'
    default:
      return t
  }
}

function extractElement(card: Card): string | null {
  const elements = ['Air', 'Eau', 'Feu', 'Terre']

  // Vérifier dans les effets pour les ressources élémentaires
  for (const effect of card.effects || []) {
    for (const element of elements) {
      if (effect.includes(`Ressource ${element}`)) {
        return element
      }
    }
  }

  // Vérifier dans les mots-clés pour les éléments purs (sans "Résistance")
  for (const keyword of card.keywords || []) {
    for (const element of elements) {
      if (keyword === element || keyword.startsWith(`${element} :`)) {
        return element
      }
    }
  }

  return null
}

async function loadCardsFromFile(filePath: string): Promise<Card[]> {
  try {
    const response = await fetch(filePath)
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`)
    }
    const cards: Card[] = await response.json()
    return cards.map((card) => ({
      ...card,
      mainType: normalizeCardType(card.mainType),
      element: extractElement(card),
    }))
  } catch (error) {
    console.error(`❌ Erreur lors du chargement de ${filePath}:`, error)
    throw error
  }
}

async function loadFile(file: string, retryCount = 0): Promise<Card[]> {
  try {
    console.log(`📥 Chargement de ${file}...`)
    return await loadCardsFromFile(file)
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      console.log(`🔄 Nouvelle tentative dans ${RETRY_DELAY}ms...`)
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY))
      return loadFile(file, retryCount + 1)
    }
    throw error
  }
}

function fixSpecialCharacters(str: string): string {
  if (!str) return str

  // Remplacer les caractères spéciaux mal encodés
  return str
    .replace(/Alli\?\?/g, 'Allié')
    .replace(/H\?\?ros/g, 'Héros')
    .replace(/\?\?quipement/g, 'Équipement')
    .replace(/Sort[\s]?\?\?mentaire/g, 'Sort Élémentaire')
    .replace(/r\?\?serve/g, 'réserve')
    .replace(/\?\?l\?\?ment/g, 'élément')
    .replace(/\?\?l\?\?mentaire/g, 'élémentaire')
    .replace(/d\?\?g\?\?ts/g, 'dégâts')
    .replace(/\?\?nergie/g, 'énergie')
    .replace(/\?\?/g, 'é') // Dernier recours pour les 'é' non reconnus
}

async function loadExtensionCards(extension: string): Promise<Card[]> {
  try {
    console.log(
      `🔄 Tentative de chargement des cartes pour l'extension "${extension}"...`
    )

    const response = await fetch(`/data/${extension}.json`)
    if (!response.ok) {
      console.error(
        `❌ Échec HTTP ${response.status} lors du chargement de l'extension ${extension}`
      )
      throw new Error(
        `Échec du chargement des cartes pour l'extension ${extension}: ${response.status} ${response.statusText}`
      )
    }

    let cards
    try {
      // On convertit d'abord en texte pour détecter les problèmes d'encodage
      const text = await response.text()

      // Si le texte ne contient aucune donnée valide
      if (!text || text.trim() === '' || text.trim() === '[]') {
        console.warn(`⚠️ Fichier JSON vide pour l'extension ${extension}`)
        return []
      }

      try {
        cards = JSON.parse(text)
        console.log(
          `✅ Fichier JSON chargé pour l'extension ${extension}, contient ${Array.isArray(cards) ? cards.length : 'non-array'} éléments`
        )
      } catch (parseError) {
        console.error(
          `❌ Erreur de parsing JSON pour l'extension ${extension}:`,
          parseError
        )
        console.log('Premiers caractères du JSON:', text.substring(0, 100))
        throw parseError
      }
    } catch (jsonError) {
      console.error(
        `❌ Erreur lors du traitement du JSON pour l'extension ${extension}:`,
        jsonError
      )
      throw new Error(
        `Erreur de parsing JSON pour l'extension ${extension}: ${jsonError}`
      )
    }

    if (!Array.isArray(cards)) {
      console.error(
        `❌ Format de données invalide pour l'extension ${extension}, attendu un tableau, reçu:`,
        typeof cards
      )
      return []
    }

    if (cards.length === 0) {
      console.warn(`⚠️ L'extension ${extension} ne contient aucune carte`)
      return []
    }

    // Validate and normalize each card
    const validCards = cards
      .filter((card: any) => {
        if (!card || typeof card !== 'object') {
          console.warn(`⚠️ Carte ignorée dans ${extension}: non-objet ou null`)
          return false
        }
        // Vérification minimale
        if (!card.id || !card.name) {
          console.warn(
            `⚠️ Carte ignorée dans ${extension}: id ou nom manquant`,
            card
          )
          return false
        }
        return true
      })
      .map((card: any) => {
        // Normaliser la carte
        const normalizedCard = { ...card }

        // Corriger les caractères spéciaux dans des champs clés
        if (normalizedCard.name) {
          normalizedCard.name = fixSpecialCharacters(normalizedCard.name)
        }

        if (normalizedCard.mainType) {
          normalizedCard.mainType = fixSpecialCharacters(
            normalizedCard.mainType
          )
          // Normaliser aussi le type principal
          normalizedCard.mainType = normalizeCardType(normalizedCard.mainType)
        }

        if (Array.isArray(normalizedCard.subTypes)) {
          normalizedCard.subTypes =
            normalizedCard.subTypes.map(fixSpecialCharacters)
        }

        // Ensure required properties exist
        if (!normalizedCard.id) {
          normalizedCard.id = `unknown-${Math.random().toString(36).substring(2, 10)}`
        }

        if (!normalizedCard.name) {
          normalizedCard.name = 'Carte sans nom'
        }

        if (!normalizedCard.mainType) {
          normalizedCard.mainType = 'Type inconnu'
        }

        if (!Array.isArray(normalizedCard.subTypes)) {
          normalizedCard.subTypes = []
        }

        if (!normalizedCard.rarity) {
          normalizedCard.rarity = 'Commune'
        }

        // Ensure extension property is valid
        if (
          !normalizedCard.extension ||
          typeof normalizedCard.extension !== 'object'
        ) {
          normalizedCard.extension = {
            name:
              extension.charAt(0).toUpperCase() +
              extension.slice(1).replace(/-/g, ' '),
            id: extension,
          }
        } else if (!normalizedCard.extension.name) {
          normalizedCard.extension.name =
            extension.charAt(0).toUpperCase() +
            extension.slice(1).replace(/-/g, ' ')
        }

        return normalizedCard
      })

    console.log(
      `✅ Extension ${extension}: ${validCards.length}/${cards.length} cartes valides chargées`
    )
    return validCards
  } catch (error) {
    console.error(
      `❌ Erreur lors du chargement des cartes pour l'extension ${extension}:`,
      error
    )
    return []
  }
}

export async function loadAllCards(): Promise<Card[]> {
  try {
    console.log('🚀 DEBUG cardLoader - Chargement de toutes les cartes...')

    // Vérifier si les cartes sont en cache
    const cachedCards = await loadFromCache()
    if (cachedCards) {
      console.log(
        `📦 DEBUG cardLoader - ${cachedCards.length} cartes chargées depuis le cache`
      )
      if (cachedCards.length > 0) {
        console.log(
          '📄 DEBUG cardLoader - Exemple de carte en cache:',
          JSON.stringify(cachedCards[0], null, 2)
        )
      }
      return cachedCards
    }

    // Charger les cartes de chaque extension
    const allCards: Card[] = []

    for (const extension of EXTENSION_FILES) {
      const cards = await loadExtensionCards(extension)
      allCards.push(...cards)
    }

    console.log(
      `📊 DEBUG cardLoader - ${allCards.length} cartes chargées au total`
    )

    if (allCards.length > 0) {
      console.log(
        '📄 DEBUG cardLoader - Exemple de carte chargée:',
        JSON.stringify(allCards[0], null, 2)
      )
    }

    // Mettre en cache pour les prochains chargements
    saveToCache(allCards)

    return allCards
  } catch (error) {
    console.error(
      '❌ DEBUG cardLoader - Erreur lors du chargement des cartes:',
      error
    )
    throw error
  }
}

export async function loadCardById(
  extension: string,
  cardId: string
): Promise<Card | null> {
  try {
    const cards = await loadExtensionCards(extension)
    return cards.find((card) => card.id === cardId) || null
  } catch (error) {
    console.error(
      `Error loading card ${cardId} from extension ${extension}:`,
      error
    )
    return null
  }
}

// Fonction utilitaire pour tester le chargement d'un seul fichier JSON
export async function testJsonLoading(extension: string): Promise<any> {
  try {
    console.log(`🧪 Test de chargement pour le fichier ${extension}.json...`)

    const filePath = `/data/${extension}.json`
    console.log(`📄 Chemin du fichier: ${filePath}`)

    const response = await fetch(filePath)
    console.log(
      `📡 Statut de la réponse: ${response.status} ${response.statusText}`
    )

    if (!response.ok) {
      console.error(
        `❌ Échec HTTP ${response.status} lors du chargement du fichier ${extension}`
      )
      return {
        success: false,
        status: response.status,
        statusText: response.statusText,
      }
    }

    const text = await response.text()
    console.log(`📝 Taille du texte: ${text.length} caractères`)
    console.log(`📄 Premiers caractères: "${text.substring(0, 50)}..."`)

    try {
      const data = JSON.parse(text)

      if (Array.isArray(data)) {
        console.log(`✅ Fichier JSON valide avec ${data.length} éléments`)

        if (data.length > 0) {
          console.log(`📊 Premier élément:`, data[0])
        }

        return {
          success: true,
          items: data.length,
          sample: data.slice(0, 3),
        }
      } else {
        console.warn(
          `⚠️ Le fichier JSON ne contient pas un tableau:`,
          typeof data
        )
        return {
          success: false,
          type: typeof data,
          data,
        }
      }
    } catch (parseError) {
      console.error(`❌ Erreur lors du parsing JSON:`, parseError)
      return {
        success: false,
        error: parseError.message,
        textSample: text.substring(0, 100),
      }
    }
  } catch (error) {
    console.error(`❌ Erreur lors du test de chargement:`, error)
    return {
      success: false,
      error: error.message,
    }
  }
}
