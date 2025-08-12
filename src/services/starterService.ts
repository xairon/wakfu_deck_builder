/**
 * Service pour l'initialisation automatique avec les decks officiels
 */

import { OFFICIAL_DECKS, getCardQuantitiesForAllDecks, type OfficialDeck } from '@/data/officialDecks'
import { useCardStore } from '@/stores/cardStore'
import { useDeckStore } from '@/stores/deckStore'
import type { Deck } from '@/types/cards'

export interface InitializationResult {
  success: boolean
  cardsAdded: number
  decksCreated: number
  errors: string[]
  warnings: string[]
}

/**
 * Vérifie si l'utilisateur a déjà initialisé son compte
 */
export function isFirstTimeUser(): boolean {
  const hasCollection = localStorage.getItem('wakfu-collection') !== null
  const hasDecks = localStorage.getItem('wakfu-decks') !== null
  
  // Si pas de collection ET pas de decks, c'est un nouveau utilisateur
  return !hasCollection && !hasDecks
}

/**
 * Vérifie si l'utilisateur a déjà les decks officiels
 */
export function hasOfficialDecks(): boolean {
  const deckStore = useDeckStore()
  
  // Vérifier si au moins un deck officiel existe
  return OFFICIAL_DECKS.some(officialDeck => 
    deckStore.decks.some(userDeck => 
      userDeck.name === officialDeck.name || 
      userDeck.id === officialDeck.id ||
      userDeck.isOfficial === true
    )
  )
}

/**
 * Initialise les decks officiels dans la liste (sans les cartes)
 */
export async function initializeOfficialDecksList(): Promise<{
  decksAdded: number
  errors: string[]
}> {
  const deckStore = useDeckStore()
  const cardStore = useCardStore()
  const errors: string[] = []
  let decksAdded = 0

  console.log('🎯 Initialisation de la liste des decks officiels...')
  console.log(`📊 Decks actuels dans le store: ${deckStore.decks.length}`)
  deckStore.decks.forEach(deck => {
    console.log(`  - "${deck.name}" (extension: ${deck.extension}, isOfficial: ${deck.isOfficial})`)
  })

  // SOLUTION TEMPORAIRE: supprimer tous les decks officiels pour recréer avec le nouveau format
  const officialDeckCount = deckStore.decks.filter(d => d.isOfficial).length
  if (officialDeckCount > 0) {
    console.log(`🧹 Suppression des ${officialDeckCount} decks officiels pour recréer avec cartes complètes`)
    deckStore.decks.splice(0, deckStore.decks.length, ...deckStore.decks.filter(d => !d.isOfficial))
    deckStore.saveDecks()
  }

  for (const officialDeck of OFFICIAL_DECKS) {
    try {
      // Vérifier si le deck existe déjà (vérification stricte par nom uniquement)
      const existingDeck = deckStore.decks.find(deck => 
        deck.name === officialDeck.name
      )
      
      if (existingDeck) {
        console.log(`ℹ️ Deck déjà existant: ${officialDeck.name}`)
        continue
      }
      
      console.log(`➕ Création du deck: ${officialDeck.name}`)

      // Créer un deck complet avec toutes ses cartes
      console.log(`🔨 Construction du deck complet: ${officialDeck.name}`)
      
      // Trouver le héros et havre-sac
      const heroCard = findCardWithMapping(officialDeck.hero, 'hero', cardStore)
      const havreSacCard = findCardWithMapping(officialDeck.havreSac, 'havre-sac', cardStore)
      
      if (!heroCard) {
        console.warn(`⚠️ Héros non trouvé pour ${officialDeck.name}: ${officialDeck.hero}`)
      }
      if (!havreSacCard) {
        console.warn(`⚠️ Havre-sac non trouvé pour ${officialDeck.name}: ${officialDeck.havreSac}`)
      }
      
      // Construire la liste des cartes du deck
      const deckCards: any[] = []
      for (const cardEntry of officialDeck.cards) {
        const card = findCardWithMapping(cardEntry.name, 'card', cardStore)
        if (card) {
          deckCards.push({
            card: card,
            quantity: cardEntry.quantity
          })
          console.log(`✅ Carte ajoutée au deck: ${card.name} x${cardEntry.quantity}`)
        } else {
          console.warn(`⚠️ Carte non trouvée pour le deck: ${cardEntry.name}`)
        }
      }

      const newDeck = {
        id: `official-${officialDeck.id}-${Date.now()}`,
        name: officialDeck.name,
        description: `${officialDeck.description} (Cartes à importer)`,
        hero: heroCard,
        havreSac: havreSacCard,
        cards: deckCards, // Deck complet avec toutes les cartes
        reserve: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isOfficial: true,
        extension: officialDeck.extension,
        // Stocker les données pour l'import ultérieur
        _officialData: officialDeck
      }
      
      console.log(`🃏 Deck créé avec ${deckCards.length} cartes + héros + havre-sac`)
      
      deckStore.decks.push(newDeck)
      decksAdded++
      console.log(`✅ Deck template créé: ${officialDeck.name}`)
      
    } catch (error) {
      const errorMsg = `❌ Erreur lors de la création du deck template "${officialDeck.name}": ${error}`
      errors.push(errorMsg)
      console.error(errorMsg)
    }
  }

  // Sauvegarder les decks
  try {
    deckStore.saveDecks()
    console.log('💾 Templates de decks sauvegardés')
  } catch (error) {
    const errorMsg = `❌ Erreur lors de la sauvegarde des templates: ${error}`
    errors.push(errorMsg)
    console.error(errorMsg)
  }

  return { decksAdded, errors }
}

/**
 * Ajoute automatiquement les cartes des decks officiels à la collection
 */
export async function initializeCollectionWithOfficialCards(): Promise<{
  cardsAdded: number
  errors: string[]
  warnings: string[]
}> {
  const cardStore = useCardStore()
  const deckStore = useDeckStore()
  const cardQuantities = getCardQuantitiesForAllDecks()
  const errors: string[] = []
  const warnings: string[] = []
  let cardsAdded = 0

  console.log('🎯 Initialisation de la collection avec les cartes officielles...')
  console.log(`📊 ${Object.keys(cardQuantities).length} cartes uniques à ajouter`)

  for (const [cardName, quantity] of Object.entries(cardQuantities)) {
    try {
      // Chercher la carte dans la base de données
      const card = deckStore.findCardByName(cardName)
      
      if (!card) {
        const error = `❌ Carte non trouvée: "${cardName}"`
        errors.push(error)
        console.warn(error)
        continue
      }

      // Ajouter à la collection
      const currentQuantity = cardStore.collection[card.id]?.normalQuantity || 0
      const neededQuantity = Math.max(0, quantity - currentQuantity)
      
      if (neededQuantity > 0) {
        cardStore.updateCardQuantity(card.id, currentQuantity + neededQuantity, false)
        cardsAdded++
        console.log(`✅ Ajouté: ${card.name} x${neededQuantity} (total: ${currentQuantity + neededQuantity})`)
      } else {
        console.log(`ℹ️ Déjà possédé: ${card.name} x${currentQuantity}`)
      }
      
    } catch (error) {
      const errorMsg = `❌ Erreur lors de l'ajout de "${cardName}": ${error}`
      errors.push(errorMsg)
      console.error(errorMsg)
    }
  }

  // Sauvegarder la collection
  try {
    await cardStore.saveToLocalStorage()
    console.log('💾 Collection sauvegardée')
  } catch (error) {
    const errorMsg = `❌ Erreur lors de la sauvegarde: ${error}`
    errors.push(errorMsg)
    console.error(errorMsg)
  }

  return { cardsAdded, errors, warnings }
}

/**
 * Importe les cartes d'un deck officiel spécifique dans la collection
 */
export async function importDeckCardsToCollection(deckId: string): Promise<{
  cardsAdded: number
  cardsUpdated: number
  errors: string[]
  deckName: string
}> {
  const cardStore = useCardStore()
  const deckStore = useDeckStore()
  const errors: string[] = []
  let cardsAdded = 0
  let cardsUpdated = 0

  // Trouver le deck
  const deck = deckStore.decks.find(d => d.id === deckId)
  if (!deck || !deck._officialData) {
    throw new Error('Deck non trouvé ou pas de données officielles')
  }

  const officialData = deck._officialData
  console.log(`🎯 Import des cartes du deck: ${deck.name}`)

  // Liste des cartes à importer (héros + havre-sac + cartes)
  const cardsToImport = [
    { name: officialData.hero, quantity: 1, type: 'hero' },
    { name: officialData.havreSac, quantity: 1, type: 'havre-sac' },
    ...officialData.cards
  ]

  console.log(`📦 Import des cartes du deck "${deck.name}" dans la collection uniquement`)
  console.log(`📋 ${cardsToImport.length} cartes à ajouter à la collection:`)
  cardsToImport.forEach((card, index) => {
    console.log(`  ${index + 1}. ${card.name} x${card.quantity} (${card.type})`)
  })

  for (const cardEntry of cardsToImport) {
    try {
      console.log(`🔍 Recherche de la carte: "${cardEntry.name}"`)
      
      // Recherche intelligente avec mapping
      const card = findCardWithMapping(cardEntry.name, cardEntry.type, cardStore)
      
      if (!card) {
        const error = `❌ Carte non trouvée: "${cardEntry.name}" (type: ${cardEntry.type})`
        errors.push(error)
        console.warn(error)
        continue
      }
      
      console.log(`✅ Carte trouvée: ${card.name} (ID: ${card.id})`)

      // Ajouter TOUTES les cartes du deck à la collection (simulation cartes physiques)
      const currentQuantity = cardStore.getCardQuantity(card.id) || 0
      
      // Ajouter tous les exemplaires du deck, indépendamment de ce qu'on possède déjà
      await cardStore.addToCollection(card, cardEntry.quantity, false)
      cardsAdded++
      console.log(`✅ Ajouté à la collection: ${card.name} x${cardEntry.quantity} (total: ${currentQuantity + cardEntry.quantity})`)
      
    } catch (error) {
      const errorMsg = `❌ Erreur lors de l'ajout de "${cardEntry.name}": ${error}`
      errors.push(errorMsg)
      console.error(errorMsg)
    }
  }

  // Sauvegarder la collection
  try {
    await cardStore.saveToLocalStorage()
    console.log('💾 Collection sauvegardée')
  } catch (error) {
    const errorMsg = `❌ Erreur lors de la sauvegarde: ${error}`
    errors.push(errorMsg)
    console.error(errorMsg)
  }

  // Marquer le deck comme "importé" en mettant à jour sa description
  if (cardsAdded > 0) {
    deck.description = deck.description?.replace(' (Cartes à importer)', ' (Cartes importées)') || `${officialData.description} (Cartes importées)`
    deck.updatedAt = new Date().toISOString()
    
    // Sauvegarder le deck avec la description mise à jour
    try {
      const deckStore = useDeckStore()
      deckStore.saveDecks()
      console.log('💾 Description du deck mise à jour')
    } catch (error) {
      console.warn('Erreur lors de la sauvegarde de la description:', error)
    }
  }

  return { 
    cardsAdded, 
    cardsUpdated, 
    errors, 
    deckName: deck.name 
  }
}

/**
 * Mapping des noms de cartes des decks officiels vers les vraies cartes
 */
const CARD_NAME_MAPPING: Record<string, string> = {
  // === HÉROS ===
  'Klore Ofil': 'klore-ofil-incarnam',
  'Poum Ondacié': 'poum-ondacie-incarnam',
  'Karey Dass': 'karey-dass-incarnam', 
  'Tirlangue Portey': 'tirlangue-portey-incarnam',
  'Trantmy Londami': 'trantmy-londami-incarnam',
  'Hynd Yanajone': 'hynd-yanajone-incarnam',
  'Bruss Ouilis': 'bruss-ouilis-incarnam',
  'Shimay Rouch': 'shimay-rouch-incarnam',
  'Aeron Zeklox': 'aeron-zeklox-incarnam',
  'Jin Kobi Loba': 'jin-kobi-loba-bonta-brakmar',
  'Oscar Nak': 'oscar-nak-bonta-brakmar',
  'Thapa Sambal': 'thapa-sambal-bonta-brakmar',
  
  // === HAVRE-SACS ===
  'Havre-Sac du Prespic': 'havre-sac-du-prespic-incarnam',
  'Havre-Sac du Tofu': 'havre-sac-du-tofu-incarnam',
  'Havre Sac du Tofu': 'havre-sac-du-tofu-incarnam', // Variante sans tiret
  'Havre-Sac du Bouftou': 'havre-sac-du-bouftou-incarnam',
  'Havre Sac du Bouftou': 'havre-sac-du-bouftou-incarnam', // Variante sans tiret
  'Havre-Sac du Wabbit': 'havre-sac-du-wabbit-incarnam',
  'Havre Sac du Prespic': 'havre-sac-du-prespic-incarnam', // Variante sans tiret
  'Havre Sac du Wabbit': 'havre-sac-du-wabbit-incarnam', // Variante sans tiret
  'Havre Sac du Craqueleur': 'havre-sac-du-craqueleur-bonta-brakmar', // Bonta & Brâkmar
  'Havre Sac du Crocodaille': 'havre-sac-du-crocodaille-bonta-brakmar', // Bonta & Brâkmar
  
  // === CARTES DE BASE INCARNAM ===
  'Bouftou': 'bouftou-incarnam',
  'Gelée Fraise': 'gelee-fraise-incarnam',
  'Gelée Bleue': 'gelee-bleue-incarnam',
  'Gelée Citron': 'gelee-citron-incarnam',
  'Gelée Menthe': 'gelee-menthe-incarnam',
  'Tofu': 'tofu-incarnam',
  'Prespic': 'prespic-incarnam',
  'Corbac': 'corbac-incarnam',
  'Larve Orange': 'larve-orange-incarnam',
  'Larve Bleue': 'larve-bleue-incarnam',
  'Larve Verte': 'larve-verte-incarnam',
  'Piou': 'piou-incarnam',
  'Piou Jaune': 'piou-jaune-incarnam',
  'Tofu Mutant': 'tofu-mutant-incarnam',
  'Tofu Céleste': 'tofu-celeste-incarnam',
  'Polter Tofu': 'polter-tofu-incarnam',
  'Smare': 'smare-incarnam',
  'Chauve-Souris Vampyre': 'chauve-souris-vampyre-incarnam',
  'Kanigrou': 'kanigrou-incarnam',
  'Moskito': 'moskito-incarnam',
  'Kristie Endor': 'kristie-endor-incarnam',
  'Akoua Flesh': 'akoua-flesh-incarnam',
  'Guma Bobeule': 'guma-bobeule-incarnam',
  'Guy Yomtella': 'guy-yomtella-incarnam',
  'Ekraz Lenoub': 'ekraz-lenoub-incarnam',
  'Merelyne Manro': 'merelyne-manro-incarnam',
  'Piou Rouge': 'piou-rouge-incarnam',
  'Piou Bleu': 'piou-bleu-incarnam',
  'Vrombyx': 'vrombyx-incarnam',
  'Dragodinde Rousse Sauvage': 'dragodinde-rousse-sauvage-incarnam',
  'Bwork': 'bwork-incarnam',
  'Bwork Mage': 'bwork-mage-incarnam',
  'Crocmaster': 'crocmaster-incarnam',
  'Deyko Nexion': 'deyko-nexion-incarnam',
  'Tolot': 'tolot-incarnam',
  'Dwanlaposh': 'dwanlaposh-incarnam',
  'Calt Aclysme': 'calt-aclysme-incarnam',
  'Zant Enograg': 'zant-enograg-incarnam',
  'Flaqueux': 'flaqueux-incarnam',
  'Coffre Malveillant': 'coffre-malveillant-incarnam',
  'Wa Wabbit': 'wa-wabbit-incarnam',
  'Boo': 'boo-incarnam',
  'Corailleur': 'corailleur-incarnam',
  'Crapaud Mufle': 'crapaud-mufle-incarnam',
  'Keyss Aouti': 'keyss-aouti-incarnam',
  'Djakky Chwan': 'djakky-chwan-incarnam',
  'Belgodass': 'belgodass-incarnam',
  'Montrakristo': 'montrakristo-incarnam',
  'Dollarawan le Banquier': 'dollarawan-le-banquier-incarnam',
  
  // === SORTS INCARNAM ===
  'Glyphe Revigorant': 'glyphe-revigorant-incarnam',
  'Protection': 'protege-incarnam', // Le vrai nom est "Protège !"
  'Stratégie de Groupe': 'strategie-de-groupe-incarnam',
  'Trêve': 'treve-incarnam',
  'Charge': 'charge-incarnam',
  'Bond': 'bond-incarnam',
  'Colère de Iop': 'colere-de-iop-incarnam',
  'Flèche Chercheuse': 'fleche-chercheuse-incarnam',
  'Flèche d\'Immolation': 'fleche-d-immolation-incarnam',
  'Flèche Blizzard': 'fleche-blizzard-incarnam',
  'Coupure Temporelle': 'coupure-temporelle-incarnam',
  'Choc Temporel': 'choc-temporel-incarnam',
  'Répulsion': 'repulsion-incarnam',
  'Brisé !': 'brise-incarnam',
  'Jeunesse d\'Ogrest': 'jeunesse-d-ogrest-incarnam',
  'Pandrista': 'pandrista-incarnam',
  'Repos': 'repos-incarnam',
  'Pain au Blé Complet': 'pain-au-ble-complet-incarnam',
  'Tacle': 'tacle-incarnam',
  'Fourberie de Djaul': 'fourberie-de-djaul-incarnam',
  'Glyphe Incandescent': 'glyphe-incandescent-incarnam',
  'Échec Critique': 'echec-critique-incarnam',
  'Exclusion': 'exclusion-incarnam',
  'Bonne Affaire !': 'bonne-affaire-incarnam',
  'Prospection': 'prospection-incarnam',
  
  // === ZONES INCARNAM ===
  'Temple Feca': 'temple-feca-incarnam',
  'Temple Feca': 'temple-feca-incarnam',
  'Temple Crâ': 'temple-cra-incarnam', 
  'Temple Iop': 'temple-iop-incarnam',
  'Temple Xélor': 'temple-xelor-incarnam',
  'Incarnam': 'incarnam-incarnam',
  'Stade de Boufball': 'stade-de-boufball-incarnam',
  'Donjon des Tofus': 'donjon-des-tofus-incarnam',
  'Donjon des Bouftous': 'donjon-des-bouftous-incarnam',
  'Donjon des Larves': 'donjon-des-larves-incarnam',
  'Champs d\'Astrub': 'champs-d-astrub-incarnam',
  'Mines d\'Astrub': 'mines-d-astrub-incarnam',
  'Temple Féca': 'temple-feca-incarnam', // Variante avec accent
  'Calanques d\'Astrub': 'calanques-d-astrub-incarnam',
  
  // === ÉQUIPEMENTS INCARNAM ===
  'Flamiche': 'flamiche-incarnam',
  'Parchemin de Force': 'parchemin-de-force-incarnam',
  'Parchemin d\'Intelligence': 'parchemin-d-intelligence-incarnam',
  'Parchemin d\'Agilité': 'parchemin-d-agilite-incarnam',
  'Parchemin de Chance': 'parchemin-de-chance-incarnam',
  'Pantoufles du Tofu': 'pantoufles-du-tofu-incarnam',
  'Nomoon': 'nomoon-incarnam',
  'Baguette du Tofu': 'baguette-du-tofu-incarnam',
  'Amulette du Tofu': 'amulette-du-tofu-incarnam',
  'Tiwabbit': 'tiwabbit-incarnam',
  'Dora': 'dora-incarnam',
  'Cape du Prespic': 'cape-du-prespic-incarnam',
  'Ceinture du Prespic': 'ceinture-du-prespic-incarnam',
  'Anneau du Prespic': 'anneau-du-prespic-incarnam',
  'Chacha Noir': 'chacha-noir-incarnam',
  'Ceinture Akwadala': 'ceinture-akwadala-incarnam',
  'Pelle Mechba': 'pelle-mechba-incarnam',
  'Arès': 'ares-incarnam',
  'Amulette Akwadala': 'amulette-akwadala-incarnam',
  'Bébé Panda': 'bebe-panda-incarnam',
  'Gobelinet': 'gobelinet-incarnam',
  'Chevaucheur Gobelin': 'chevaucheur-gobelin-incarnam',
  'Léopardo': 'leopardo-incarnam',
  'Shiffer Van Brushing': 'shiffer-van-brushing-incarnam',
  'Amal Odoua': 'amal-odoua-incarnam',
  'Fofy Fafié': 'fofy-fafie-incarnam',
  'Demi Finame': 'demi-finame-incarnam',
  'Amar Casto': 'amar-casto-incarnam',
  'Fécaline la Sage': 'fecaline-la-sage-incarnam',
  'Parchemin Blanc': 'parchemin-blanc-incarnam',
  'Défi': 'defi-incarnam',
  'Piou Vert': 'piou-vert-incarnam',
  'Boufton Blanc': 'boufton-blanc-incarnam',
  'Chef de Guerre Bouftou': 'chef-de-guerre-bouftou-incarnam',
  'Bouftou Royal': 'bouftou-royal-incarnam',
  'Craqueleur': 'craqueleur-incarnam',
  'Maître Bolet': 'maitre-bolet-incarnam',
  'Berger Porkass': 'berger-porkass-incarnam',
  'Arakne': 'arakne-incarnam',
  'Demi Moon': 'demi-moon-incarnam',
  'Tomla Klass': 'tomla-klass-incarnam',
  'Jicé Aouaire': 'jice-aouaire-incarnam',
  'Katsou Mee': 'katsou-mee-incarnam',
  'Coup Critique': 'coup-critique-incarnam',
  'Boon Attitude': 'boon-attitude-incarnam',
  'Agression': 'agression-incarnam',
  'Forêts d\'Astrub': 'forets-d-astrub-incarnam',
  'Coiffe du Bouftou': 'coiffe-du-bouftou-incarnam',
  'Scaranneau Blanc': 'scaranneau-blanc-incarnam',
  'Marcassin': 'marcassin-incarnam',
  
  // === CARTES BONTA & BRÂKMAR ===
  'Téléportation': 'teleportation-bonta-brakmar',
  'Invisibilté': 'invisibilte-bonta-brakmar',
  'Bonta, Cité des Bourgeois': 'bonta-cite-des-bourgeois-bonta-brakmar',
  'Brâkmar, Cité des Ténèbres': 'brakmar-cite-des-tenebres-bonta-brakmar',
  
  // Alliés Bonta & Brâkmar
  'Bébé Dragodinde': 'bebe-dragodinde-bonta-brakmar',
  'Danathor': 'danathor-bonta-brakmar', 
  'Champa Vert': 'champa-vert-bonta-brakmar',
  'Dureden Taille-l\'air': 'dureden-taille-l-air-bonta-brakmar',
  'Relidium Metrens': 'relidium-metrens-bonta-brakmar',
  'Boufcoul': 'boufcoul-bonta-brakmar',
  'Lee Lou': 'lee-lou-bonta-brakmar',
  'Scarafeuille Vert': 'scarafeuille-vert-bonta-brakmar',
  'Champa Rouge': 'champa-rouge-bonta-brakmar',
  'Grine Piz': 'grine-piz-bonta-brakmar',
  'Wapins': 'wapins-bonta-brakmar',
  'Citwouille': 'citwouille-bonta-brakmar',
  'Chouquette': 'chouquette-bonta-brakmar',
  'Eksa Soth': 'eksa-soth-bonta-brakmar',
  'Epron Krashva': 'epron-krashva-bonta-brakmar',
  'Scarafeuille Rouge': 'scarafeuille-rouge-bonta-brakmar',
  'Franchiche Laliane': 'franchiche-laliane-bonta-brakmar',
  'Grand Shushu Craquelé': 'grand-shushu-craquele-bonta-brakmar',
  'Dopeul Sadida': 'dopeul-sadida-bonta-brakmar',
  'Dathura': 'dathura-bonta-brakmar',
  
  // Actions Bonta & Brâkmar  
  'Droiture d\'Amayiro': 'droiture-d-amayiro-bonta-brakmar',
  'Au Champ d\'Honneur': 'au-champ-d-honneur-bonta-brakmar',
  'Fée d\'Artifice': 'fee-d-artifice-bonta-brakmar', 
  'Attaque Bontarienne': 'attaque-bontarienne-bonta-brakmar',
  'Un Ange passe': 'un-ange-passe-bonta-brakmar',
  'Feu de Brousse': 'feu-de-brousse-bonta-brakmar',
  'Malédiction Voudoule': 'malediction-voudoule-bonta-brakmar',
  'Arbre de Vie': 'arbre-de-vie-bonta-brakmar',
  
  // Zones Bonta & Brâkmar
  'Forêt des Abraknydes': 'foret-des-abraknydes-bonta-brakmar',
  'Bonta, Cité de Lumière': 'bonta-cite-de-lumiere-bonta-brakmar',
  
  // Équipements Bonta & Brâkmar
  'Cape du Koalak': 'cape-du-koalak-bonta-brakmar',
  'Arc du Koalak': 'arc-du-koalak-bonta-brakmar', 
  'Bâton Bah\'Pik\'': 'baton-bah-pik-bonta-brakmar',
  'Petit Anneau de Force': 'petit-anneau-de-force-bonta-brakmar',
  'Petit Anneau d\'Intelligence': 'petit-anneau-d-intelligence-bonta-brakmar',
  'Amulette du Koalak': 'amulette-du-koalak-bonta-brakmar',
  
  // Cartes spécifiques Sram
  'Alysse': 'alysse-bonta-brakmar',
  'Morbidon': 'morbidon-bonta-brakmar',
  'Champa Marron': 'champa-marron-bonta-brakmar',
  'Brik Enbroc': 'brik-enbroc-bonta-brakmar',
  'Sellor Noob': 'sellor-noob-bonta-brakmar',
  'Many': 'many-bonta-brakmar',
  'Scarafeuille Blanc': 'scarafeuille-blanc-bonta-brakmar',
  'Vola Latir': 'vola-latir-bonta-brakmar',
  'Dopeul Sram': 'dopeul-sram-bonta-brakmar',
  'Champa Bleu': 'champa-bleu-bonta-brakmar',
  'Écumouth': 'ecumouth-bonta-brakmar',
  'Myko': 'myko-bonta-brakmar',
  'Cya Nhûr': 'cya-nhur-bonta-brakmar',
  'Grouilleux Mécano': 'grouilleux-mecano-bonta-brakmar',
  'Zack Apus': 'zack-apus-bonta-brakmar',
  'Scarafeuille Bleu': 'scarafeuille-bleu-bonta-brakmar',
  'Craqueleur Vaporeux': 'craqueleur-vaporeux-bonta-brakmar',
  'YeCh\'ti': 'yech-ti-bonta-brakmar',
  'Sournoiserie d\'Oto Mustam': 'sournoiserie-d-oto-mustam-bonta-brakmar',
  'Potion d\'Agression': 'potion-d-agression-bonta-brakmar',
  'Attaque Brâkmarienne': 'attaque-brakmarienne-bonta-brakmar',
  'Démons et Merveilles': 'demons-et-merveilles-bonta-brakmar',
  'Arnaque': 'arnaque-bonta-brakmar',
  'Vol Sacré': 'vol-sacre-bonta-brakmar',
  'Poisse': 'poisse-bonta-brakmar',
  'Mer Kantil': 'mer-kantil-bonta-brakmar',
  'Le Floude': 'le-floude-bonta-brakmar',
  'Dagues Haih\'Ri\'Don\'': 'dagues-haih-ri-don-bonta-brakmar',
  'Lame du Chef Crocodaille': 'lame-du-chef-crocodaille-bonta-brakmar',
  'Petit Anneau d\'Agilité': 'petit-anneau-d-agilite-bonta-brakmar',
  'Le S\'mesme': 'le-s-mesme-bonta-brakmar'
}

/**
 * Trouve une carte avec mapping intelligent
 */
function findCardWithMapping(cardName: string, cardType: string | undefined, cardStore: any): any {
  console.log(`🎯 Mapping pour "${cardName}" (type: ${cardType})`)
  
  // 1. Vérifier le mapping direct
  const mappedId = CARD_NAME_MAPPING[cardName]
  if (mappedId) {
    const card = cardStore.cards.find((c: any) => c.id === mappedId)
    if (card) {
      console.log(`✅ Mapping direct trouvé: ${cardName} → ${card.name} (${card.id})`)
      return card
    }
  }
  
  // 2. Recherche par nom normalisé (fallback)
  const deckStore = useDeckStore()
  const card = deckStore.findCardByName ? deckStore.findCardByName(cardName) : null
  if (card) {
    console.log(`✅ Recherche fallback trouvée: ${cardName} → ${card.name}`)
    return card
  }
  
  // 3. Recherche fuzzy par nom partiel
  const normalizedSearch = cardName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]/g, '')
  const fuzzyCard = cardStore.cards.find((c: any) => {
    const normalizedCardName = c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]/g, '')
    return normalizedCardName.includes(normalizedSearch) || normalizedSearch.includes(normalizedCardName)
  })
  
  if (fuzzyCard) {
    console.log(`⚠️ Recherche fuzzy trouvée: ${cardName} → ${fuzzyCard.name}`)
    return fuzzyCard
  }
  
  // 4. Debug: lister les cartes similaires pour aider au mapping
  console.log(`❌ Aucune correspondance pour: ${cardName}`)
  const debugCards = cardStore.cards.filter((c: any) => {
    const cardNameLower = c.name.toLowerCase()
    const searchLower = cardName.toLowerCase()
    return cardNameLower.includes(searchLower.split(' ')[0]) || searchLower.includes(cardNameLower.split(' ')[0])
  }).slice(0, 5)
  
  if (debugCards.length > 0) {
    console.log(`💡 Cartes avec noms similaires:`, debugCards.map((c: any) => `"${c.name}" (${c.id})`))
  }
  
  return null
}

/**
 * Vérifie si un deck officiel a déjà ses cartes importées
 */
export function isDeckCardsImported(deckId: string): boolean {
  const deckStore = useDeckStore()
  const cardStore = useCardStore()
  
  const deck = deckStore.decks.find(d => d.id === deckId)
  if (!deck || !deck._officialData) {
    return false
  }

  const officialData = deck._officialData
  
  // Vérifier si toutes les cartes sont présentes en quantité suffisante
  const cardsToCheck = [
    { name: officialData.hero, quantity: 1 },
    { name: officialData.havreSac, quantity: 1 },
    ...officialData.cards
  ]

  return cardsToCheck.every(cardEntry => {
    const card = findCardWithMapping(cardEntry.name, 'card', cardStore)
    if (!card) return false
    
    const currentQuantity = cardStore.getCardQuantity(card.id) || 0
    return currentQuantity >= cardEntry.quantity
  })
}

/**
 * Crée les decks officiels dans la liste de l'utilisateur
 */
export async function initializeOfficialDecks(): Promise<{
  decksCreated: number
  errors: string[]
  warnings: string[]
}> {
  const deckStore = useDeckStore()
  const errors: string[] = []
  const warnings: string[] = []
  let decksCreated = 0

  console.log('🎯 Initialisation des decks officiels...')

  for (const officialDeck of OFFICIAL_DECKS) {
    try {
      // Vérifier si le deck existe déjà
      const existingDeck = deckStore.decks.find(deck => 
        deck.name === officialDeck.name || deck.id === officialDeck.id
      )
      
      if (existingDeck) {
        console.log(`ℹ️ Deck déjà existant: ${officialDeck.name}`)
        continue
      }

      // Créer le deck
      const newDeck = await createDeckFromOfficial(officialDeck)
      
      if (newDeck) {
        deckStore.decks.push(newDeck)
        decksCreated++
        console.log(`✅ Deck créé: ${officialDeck.name}`)
      } else {
        const error = `❌ Impossible de créer le deck: ${officialDeck.name}`
        errors.push(error)
        console.error(error)
      }
      
    } catch (error) {
      const errorMsg = `❌ Erreur lors de la création du deck "${officialDeck.name}": ${error}`
      errors.push(errorMsg)
      console.error(errorMsg)
    }
  }

  // Sauvegarder les decks
  try {
    deckStore.saveDecks()
    console.log('💾 Decks sauvegardés')
  } catch (error) {
    const errorMsg = `❌ Erreur lors de la sauvegarde des decks: ${error}`
    errors.push(errorMsg)
    console.error(errorMsg)
  }

  return { decksCreated, errors, warnings }
}

/**
 * Crée un deck Wakfu TCG à partir d'un deck officiel
 */
async function createDeckFromOfficial(officialDeck: OfficialDeck): Promise<Deck | null> {
  const deckStore = useDeckStore()
  
  try {
    // Trouver le héros
    const hero = deckStore.findCardByName(officialDeck.hero)
    if (!hero || hero.mainType !== 'Héros') {
      console.error(`❌ Héros non trouvé ou invalide: ${officialDeck.hero}`)
      return null
    }

    // Trouver le havre-sac
    const havreSac = deckStore.findCardByName(officialDeck.havreSac)
    if (!havreSac || havreSac.mainType !== 'Havre-sac') {
      console.error(`❌ Havre-sac non trouvé ou invalide: ${officialDeck.havreSac}`)
      return null
    }

    // Construire la liste des cartes
    const cards: Record<string, number> = {}
    let totalCards = 0

    for (const cardEntry of officialDeck.cards) {
      if (cardEntry.type === 'card') {
        const card = deckStore.findCardByName(cardEntry.name)
        if (card) {
          cards[card.id] = cardEntry.quantity
          totalCards += cardEntry.quantity
        } else {
          console.warn(`⚠️ Carte non trouvée dans le deck ${officialDeck.name}: ${cardEntry.name}`)
        }
      }
    }

    // Créer le deck
    const deck: Deck = {
      id: `official-${officialDeck.id}-${Date.now()}`,
      name: officialDeck.name,
      description: officialDeck.description,
      hero: hero,
      havreSac: havreSac,
      cards: cards,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isOfficial: true, // Marquer comme deck officiel
      extension: officialDeck.extension
    }

    console.log(`📋 Deck créé: ${deck.name} (${totalCards} cartes)`)
    return deck

  } catch (error) {
    console.error(`❌ Erreur lors de la création du deck ${officialDeck.name}:`, error)
    return null
  }
}

/**
 * Initialisation complète pour les nouveaux utilisateurs
 */
export async function performFullInitialization(): Promise<InitializationResult> {
  console.log('🚀 Début de l\'initialisation complète...')
  
  const result: InitializationResult = {
    success: false,
    cardsAdded: 0,
    decksCreated: 0,
    errors: [],
    warnings: []
  }

  try {
    // 1. Initialiser la collection
    const collectionResult = await initializeCollectionWithOfficialCards()
    result.cardsAdded = collectionResult.cardsAdded
    result.errors.push(...collectionResult.errors)
    result.warnings.push(...collectionResult.warnings)

    // 2. Créer les decks officiels
    const decksResult = await initializeOfficialDecks()
    result.decksCreated = decksResult.decksCreated
    result.errors.push(...decksResult.errors)
    result.warnings.push(...decksResult.warnings)

    // 3. Marquer l'initialisation comme terminée
    localStorage.setItem('wakfu-initialization-completed', Date.now().toString())

    result.success = result.errors.length === 0
    
    console.log(`🎉 Initialisation terminée:`)
    console.log(`   📦 ${result.cardsAdded} cartes ajoutées`)
    console.log(`   🃏 ${result.decksCreated} decks créés`)
    console.log(`   ❌ ${result.errors.length} erreurs`)
    console.log(`   ⚠️ ${result.warnings.length} avertissements`)

  } catch (error) {
    result.errors.push(`❌ Erreur critique lors de l'initialisation: ${error}`)
    console.error('❌ Erreur critique lors de l\'initialisation:', error)
  }

  return result
}

/**
 * Vérifie si l'initialisation a déjà été effectuée
 */
export function isInitializationCompleted(): boolean {
  return localStorage.getItem('wakfu-initialization-completed') !== null
}

/**
 * Force une nouvelle initialisation (pour debug ou réinitialisation)
 */
export function resetInitialization(): void {
  localStorage.removeItem('wakfu-initialization-completed')
  console.log('🔄 Initialisation réinitialisée')
}
