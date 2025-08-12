/**
 * Decks officiels pour l'initialisation automatique de la collection
 * Basés sur les decks starter de WTCG Return
 */

export interface OfficialDeckCard {
  name: string
  quantity: number
  type: 'hero' | 'havre-sac' | 'card'
}

export interface OfficialDeck {
  id: string
  name: string
  description: string
  extension: string
  hero: string
  havreSac: string
  cards: OfficialDeckCard[]
}

export const OFFICIAL_DECKS: OfficialDeck[] = [
  // === INCARNAM STARTERS ===
  {
    id: 'incarnam-feca',
    name: 'Incarnam - Feca',
    description: 'Deck starter Feca pour débutants',
    extension: 'incarnam',
    hero: 'Poum Ondacié',
    havreSac: 'Havre Sac du Prespic',
    cards: [
      // Alliés (25 cartes)
      { name: 'Piou Rouge', quantity: 1, type: 'card' },
      { name: 'Larve Orange', quantity: 1, type: 'card' },
      { name: 'Vrombyx', quantity: 1, type: 'card' },
      { name: 'Dragodinde Rousse Sauvage', quantity: 3, type: 'card' },
      { name: 'Bwork', quantity: 1, type: 'card' },
      { name: 'Bwork Mage', quantity: 2, type: 'card' },
      { name: 'Gobelinet', quantity: 1, type: 'card' },
      { name: 'Chevaucheur Gobelin', quantity: 1, type: 'card' },
      { name: 'Léopardo', quantity: 1, type: 'card' },
      { name: 'Shiffer Van Brushing', quantity: 3, type: 'card' },
      { name: 'Amal Odoua', quantity: 1, type: 'card' },
      { name: 'Fofy Fafié', quantity: 3, type: 'card' },
      { name: 'Demi Finame', quantity: 2, type: 'card' },
      { name: 'Amar Casto', quantity: 3, type: 'card' },
      { name: 'Fécaline la Sage', quantity: 2, type: 'card' },
      
      // Actions (12 cartes)
      { name: 'Parchemin d\'Intelligence', quantity: 1, type: 'card' },
      { name: 'Parchemin Blanc', quantity: 3, type: 'card' },
      { name: 'Défi', quantity: 2, type: 'card' },
      { name: 'Prospection', quantity: 1, type: 'card' },
      { name: 'Glyphe Revigorant', quantity: 3, type: 'card' },
      { name: 'Glyphe Incandescent', quantity: 2, type: 'card' },
      { name: 'Trêve', quantity: 1, type: 'card' },
      
      // Zones (3 cartes)
      { name: 'Mines d\'Astrub', quantity: 3, type: 'card' },
      
      // Salles (1 carte)
      { name: 'Temple Féca', quantity: 1, type: 'card' },
      
      // Équipements (5 cartes)
      { name: 'Dora', quantity: 1, type: 'card' },
      { name: 'Cape du Prespic', quantity: 1, type: 'card' },
      { name: 'Ceinture du Prespic', quantity: 1, type: 'card' },
      { name: 'Anneau du Prespic', quantity: 1, type: 'card' },
      { name: 'Chacha Noir', quantity: 1, type: 'card' }
    ]
  },

  {
    id: 'incarnam-cra',
    name: 'Incarnam - Crâ',
    description: 'Deck starter Crâ pour débutants',
    extension: 'incarnam',
    hero: 'Tirlangue Portey',
    havreSac: 'Havre Sac du Tofu',
    cards: [
      // Alliés (24 cartes)
      { name: 'Piou Jaune', quantity: 1, type: 'card' },
      { name: 'Tofu', quantity: 3, type: 'card' },
      { name: 'Tofu Mutant', quantity: 2, type: 'card' },
      { name: 'Tofu Céleste', quantity: 1, type: 'card' },
      { name: 'Polter Tofu', quantity: 1, type: 'card' },
      { name: 'Smare', quantity: 2, type: 'card' },
      { name: 'Chauve-Souris Vampyre', quantity: 2, type: 'card' },
      { name: 'Kanigrou', quantity: 1, type: 'card' },
      { name: 'Moskito', quantity: 1, type: 'card' },
      { name: 'Kristie Endor', quantity: 1, type: 'card' },
      { name: 'Akoua Flesh', quantity: 3, type: 'card' },
      { name: 'Guma Bobeule', quantity: 1, type: 'card' },
      { name: 'Guy Yomtella', quantity: 3, type: 'card' },
      { name: 'Ekraz Lenoub', quantity: 2, type: 'card' },
      { name: 'Merelyne Manro', quantity: 1, type: 'card' },
      
      // Actions (13 cartes)
      { name: 'Parchemin d\'Agilité', quantity: 1, type: 'card' },
      { name: 'Répulsion', quantity: 1, type: 'card' },
      { name: 'Brisé !', quantity: 1, type: 'card' },
      { name: 'Jeunesse d\'Ogrest', quantity: 1, type: 'card' },
      { name: 'Pandrista', quantity: 2, type: 'card' },
      { name: 'Repos', quantity: 1, type: 'card' },
      { name: 'Pain au Blé Complet', quantity: 1, type: 'card' },
      { name: 'Flèche d\'Immolation', quantity: 3, type: 'card' },
      { name: 'Flèche Chercheuse', quantity: 2, type: 'card' },
      { name: 'Flèche Blizzard', quantity: 1, type: 'card' },
      
      // Zones (3 cartes) 
      { name: 'Champs d\'Astrub', quantity: 3, type: 'card' },
      
      // Salles (1 carte)
      { name: 'Temple Crâ', quantity: 1, type: 'card' },
      
      // Équipements (5 cartes)
      { name: 'Pantoufles du Tofu', quantity: 1, type: 'card' },
      { name: 'Nomoon', quantity: 1, type: 'card' },
      { name: 'Baguette du Tofu', quantity: 1, type: 'card' },
      { name: 'Amulette du Tofu', quantity: 1, type: 'card' },
      { name: 'Tiwabbit', quantity: 1, type: 'card' }
    ]
  },

  {
    id: 'incarnam-iop',
    name: 'Incarnam - Iop',
    description: 'Deck starter Iop pour débutants',
    extension: 'incarnam',
    hero: 'Bruss Ouilis',
    havreSac: 'Havre Sac du Bouftou',
    cards: [
      // Alliés (24 cartes)
      { name: 'Piou Vert', quantity: 1, type: 'card' },
      { name: 'Boufton Blanc', quantity: 3, type: 'card' },
      { name: 'Bouftou', quantity: 3, type: 'card' },
      { name: 'Chef de Guerre Bouftou', quantity: 2, type: 'card' },
      { name: 'Bouftou Royal', quantity: 1, type: 'card' },
      { name: 'Larve Verte', quantity: 2, type: 'card' },
      { name: 'Craqueleur', quantity: 1, type: 'card' },
      { name: 'Maître Bolet', quantity: 1, type: 'card' },
      { name: 'Berger Porkass', quantity: 1, type: 'card' },
      { name: 'Arakne', quantity: 1, type: 'card' },
      { name: 'Demi Moon', quantity: 2, type: 'card' },
      { name: 'Tomla Klass', quantity: 3, type: 'card' },
      { name: 'Jicé Aouaire', quantity: 2, type: 'card' },
      { name: 'Katsou Mee', quantity: 1, type: 'card' },
      
      // Actions (15 cartes)
      { name: 'Parchemin de Force', quantity: 1, type: 'card' },
      { name: 'Coup Critique', quantity: 2, type: 'card' },
      { name: 'Exclusion', quantity: 1, type: 'card' },
      { name: 'Stratégie de Groupe', quantity: 1, type: 'card' },
      { name: 'Boon Attitude', quantity: 1, type: 'card' },
      { name: 'Agression', quantity: 2, type: 'card' },
      { name: 'Repos', quantity: 1, type: 'card' },
      { name: 'Charge', quantity: 3, type: 'card' },
      { name: 'Bond', quantity: 2, type: 'card' },
      { name: 'Colère de Iop', quantity: 1, type: 'card' },
      
      // Zones (3 cartes)
      { name: 'Forêts d\'Astrub', quantity: 3, type: 'card' },
      
      // Salles (1 carte)
      { name: 'Temple Iop', quantity: 1, type: 'card' },
      
      // Équipements (5 cartes)
      { name: 'Coiffe du Bouftou', quantity: 1, type: 'card' },
      { name: 'Marteau du Bouftou', quantity: 1, type: 'card' },
      { name: 'Scaranneau Blanc', quantity: 2, type: 'card' },
      { name: 'Marcassin', quantity: 1, type: 'card' }
    ]
  },

  {
    id: 'incarnam-xelor',
    name: 'Incarnam - Xélor',
    description: 'Deck starter Xélor pour débutants',
    extension: 'incarnam',
    hero: 'Aeron Zeklox',
    havreSac: 'Havre Sac du Wabbit',
    cards: [
      // Alliés (23 cartes)
      { name: 'Piou Bleu', quantity: 1, type: 'card' },
      { name: 'Gelée Bleue', quantity: 2, type: 'card' },
      { name: 'Larve Bleue', quantity: 2, type: 'card' },
      { name: 'Coffre Malveillant', quantity: 1, type: 'card' },
      { name: 'Wabbit', quantity: 1, type: 'card' },
      { name: 'Wa Wabbit', quantity: 1, type: 'card' },
      { name: 'Boo', quantity: 3, type: 'card' },
      { name: 'Corailleur', quantity: 1, type: 'card' },
      { name: 'Crapaud Mufle', quantity: 1, type: 'card' },
      { name: 'Keyss Aouti', quantity: 3, type: 'card' },
      { name: 'Djakky Chwan', quantity: 2, type: 'card' },
      { name: 'Belgodass', quantity: 2, type: 'card' },
      { name: 'Montrakristo', quantity: 3, type: 'card' },
      { name: 'Dollarawan le Banquier', quantity: 1, type: 'card' },
      
      // Actions (15 cartes)
      { name: 'Parchemin de Chance', quantity: 1, type: 'card' },
      { name: 'Échec Critique', quantity: 2, type: 'card' },
      { name: 'Exclusion', quantity: 1, type: 'card' },
      { name: 'Répulsion', quantity: 1, type: 'card' },
      { name: 'Brisé !', quantity: 1, type: 'card' },
      { name: 'Bonne Affaire !', quantity: 1, type: 'card' },
      { name: 'Prospection', quantity: 2, type: 'card' },
      { name: 'Flétrissement', quantity: 2, type: 'card' },
      { name: 'Coupure Temporelle', quantity: 3, type: 'card' },
      { name: 'Choc Temporel', quantity: 1, type: 'card' },
      
      // Zones (3 cartes)
      { name: 'Calanques d\'Astrub', quantity: 3, type: 'card' },
      
      // Salles (1 carte)
      { name: 'Temple Xélor', quantity: 1, type: 'card' },
      
      // Équipements (5 cartes)
      { name: 'Ceinture Akwadala', quantity: 1, type: 'card' },
      { name: 'Pelle Mechba', quantity: 1, type: 'card' },
      { name: 'Arès', quantity: 1, type: 'card' },
      { name: 'Amulette Akwadala', quantity: 1, type: 'card' },
      { name: 'Bébé Panda', quantity: 1, type: 'card' }
    ]
  },

  // === BONTA & BRAKMAR STARTERS ===
  {
    id: 'bonta-brakmar-sadida',
    name: 'Bonta & Brâkmar - Sadida',
    description: 'Deck Sadida Terre/Feu basé sur WTCG Return',
    extension: 'bonta-brakmar',
    hero: 'Jin Kobi Loba',
    havreSac: 'Havre Sac du Craqueleur',
    cards: [
      // Alliés (basés sur WTCG Return)
      { name: 'Bébé Dragodinde', quantity: 1, type: 'card' },
      { name: 'Danathor', quantity: 1, type: 'card' },
      { name: 'Champa Vert', quantity: 2, type: 'card' },
      { name: 'Dureden Taille-l\'air', quantity: 2, type: 'card' },
      { name: 'Relidium Metrens', quantity: 1, type: 'card' },
      { name: 'Boufcoul', quantity: 2, type: 'card' },
      { name: 'Lee Lou', quantity: 1, type: 'card' },
      { name: 'Scarafeuille Vert', quantity: 2, type: 'card' },
      { name: 'Champa Rouge', quantity: 2, type: 'card' },
      { name: 'Grine Piz', quantity: 3, type: 'card' },
      { name: 'Wapins', quantity: 1, type: 'card' },
      { name: 'Citwouille', quantity: 1, type: 'card' },
      { name: 'Chouquette', quantity: 1, type: 'card' },
      { name: 'Eksa Soth', quantity: 1, type: 'card' },
      { name: 'Epron Krashva', quantity: 1, type: 'card' },
      { name: 'Scarafeuille Rouge', quantity: 2, type: 'card' },
      { name: 'Franchiche Laliane', quantity: 1, type: 'card' },
      { name: 'Grand Shushu Craquelé', quantity: 1, type: 'card' },
      { name: 'Dopeul Sadida', quantity: 1, type: 'card' },
      { name: 'Dathura', quantity: 1, type: 'card' },
      
      // Actions
      { name: 'Droiture d\'Amayiro', quantity: 2, type: 'card' },
      { name: 'Au Champ d\'Honneur', quantity: 1, type: 'card' },
      { name: 'Fée d\'Artifice', quantity: 1, type: 'card' },
      { name: 'Attaque Bontarienne', quantity: 1, type: 'card' },
      { name: 'Un Ange passe', quantity: 1, type: 'card' },
      { name: 'Feu de Brousse', quantity: 2, type: 'card' },
      { name: 'Malédiction Voudoule', quantity: 2, type: 'card' },
      { name: 'Arbre de Vie', quantity: 1, type: 'card' },
      
      // Zones
      { name: 'Forêt des Abraknydes', quantity: 2, type: 'card' },
      { name: 'Bonta, Cité de Lumière', quantity: 1, type: 'card' },
      
      // Équipements
      { name: 'Cape du Koalak', quantity: 1, type: 'card' },
      { name: 'Arc du Koalak', quantity: 1, type: 'card' },
      { name: 'Bâton Bah\'Pik\'', quantity: 1, type: 'card' },
      { name: 'Petit Anneau de Force', quantity: 1, type: 'card' },
      { name: 'Petit Anneau d\'Intelligence', quantity: 1, type: 'card' },
      { name: 'Amulette du Koalak', quantity: 1, type: 'card' }
    ]
  },

  {
    id: 'bonta-brakmar-sram',
    name: 'Bonta & Brâkmar - Sram',
    description: 'Deck Sram Air/Eau basé sur WTCG Return',
    extension: 'bonta-brakmar',
    hero: 'Oscar Nak',
    havreSac: 'Havre Sac du Crocodaille',
    cards: [
      // Alliés (27 cartes)
      { name: 'Bébé Dragodinde', quantity: 1, type: 'card' },
      { name: 'Morbidon', quantity: 1, type: 'card' },
      { name: 'Champa Marron', quantity: 2, type: 'card' },
      { name: 'Alysse', quantity: 3, type: 'card' },
      { name: 'Brik Enbroc', quantity: 1, type: 'card' },
      { name: 'Sellor Noob', quantity: 3, type: 'card' },
      { name: 'Many', quantity: 1, type: 'card' },
      { name: 'Scarafeuille Blanc', quantity: 2, type: 'card' },
      { name: 'Vola Latir', quantity: 1, type: 'card' },
      { name: 'Dopeul Sram', quantity: 1, type: 'card' },
      { name: 'Champa Bleu', quantity: 2, type: 'card' },
      { name: 'Écumouth', quantity: 1, type: 'card' },
      { name: 'Myko', quantity: 2, type: 'card' },
      { name: 'Cya Nhûr', quantity: 1, type: 'card' },
      { name: 'Grouilleux Mécano', quantity: 1, type: 'card' },
      { name: 'Zack Apus', quantity: 1, type: 'card' },
      { name: 'Scarafeuille Bleu', quantity: 2, type: 'card' },
      { name: 'Craqueleur Vaporeux', quantity: 1, type: 'card' },
      { name: 'YeCh\'ti', quantity: 1, type: 'card' },
      
      // Actions (11 cartes)
      { name: 'Sournoiserie d\'Oto Mustam', quantity: 2, type: 'card' },
      { name: 'Au Champ d\'Honneur', quantity: 1, type: 'card' },
      { name: 'Potion d\'Agression', quantity: 1, type: 'card' },
      { name: 'Attaque Brâkmarienne', quantity: 1, type: 'card' },
      { name: 'Démons et Merveilles', quantity: 1, type: 'card' },
      { name: 'Arnaque', quantity: 2, type: 'card' },
      { name: 'Vol Sacré', quantity: 2, type: 'card' },
      { name: 'Poisse', quantity: 1, type: 'card' },
      
      // Zones (3 cartes)
      { name: 'Mer Kantil', quantity: 2, type: 'card' },
      { name: 'Brâkmar, Cité des Ténèbres', quantity: 1, type: 'card' },
      
      // Équipements (6 cartes)
      { name: 'Le Floude', quantity: 1, type: 'card' },
      { name: 'Ceinture du Chef Crocodaille', quantity: 1, type: 'card' },
      { name: 'Dagues Haih\'Ri\'Don\'', quantity: 1, type: 'card' },
      { name: 'Lame du Chef Crocodaille', quantity: 1, type: 'card' },
      { name: 'Petit Anneau d\'Agilité', quantity: 1, type: 'card' },
      { name: 'Le S\'mesme', quantity: 1, type: 'card' }
    ]
  }
]

/**
 * Retourne tous les noms de cartes uniques des decks officiels
 * pour l'ajout automatique à la collection
 */
export function getAllOfficialCards(): Set<string> {
  const allCards = new Set<string>()
  
  OFFICIAL_DECKS.forEach(deck => {
    // Ajouter le héros et havre-sac
    allCards.add(deck.hero)
    allCards.add(deck.havreSac)
    
    // Ajouter toutes les cartes
    deck.cards.forEach(card => {
      allCards.add(card.name)
    })
  })
  
  return allCards
}

/**
 * Calcule le nombre total de chaque carte nécessaire
 * pour avoir tous les decks officiels
 */
export function getCardQuantitiesForAllDecks(): Record<string, number> {
  const cardQuantities: Record<string, number> = {}
  
  OFFICIAL_DECKS.forEach(deck => {
    // Compter héros et havre-sac (toujours 1 exemplaire)
    cardQuantities[deck.hero] = Math.max(cardQuantities[deck.hero] || 0, 1)
    cardQuantities[deck.havreSac] = Math.max(cardQuantities[deck.havreSac] || 0, 1)
    
    // Compter les cartes
    deck.cards.forEach(card => {
      cardQuantities[card.name] = Math.max(cardQuantities[card.name] || 0, card.quantity)
    })
  })
  
  return cardQuantities
}
