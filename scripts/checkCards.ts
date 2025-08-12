/**
 * Script pour vérifier l'intégrité des données des cartes
 * Utilisé par le système MCP pour permettre à Claude de vérifier les données
 */

import fs from 'fs'
import path from 'path'
import * as glob from 'glob'

// Configuration
const DATA_DIR = path.join(process.cwd(), 'data')
const IMAGES_DIR = path.join(process.cwd(), 'public', 'images', 'cards')
const REPORT_PATH = path.join(process.cwd(), 'debug', 'cards_check_report.json')

// Liste des extensions à exclure de l'analyse
const EXCLUDE_FILES = ['collection.json', 'failed_downloads.json']

// Interface pour les données de carte
interface Card {
  id: string | number
  name: string
  type: string
  imageUrl?: string
  image?: string
  [key: string]: any
}

// Fonction pour vérifier l'intégrité des données des cartes
async function checkCardsIntegrity() {
  try {
    console.log("🔍 Vérification de l'intégrité des données des cartes...")

    // Trouver tous les fichiers JSON dans le dossier data
    const cardFiles = glob.sync(path.join(DATA_DIR, '*.json'))

    if (cardFiles.length === 0) {
      console.error(
        '❌ Aucun fichier de données de cartes trouvé dans',
        DATA_DIR
      )
      return
    }

    // Filtrer les fichiers exclus
    const filteredCardFiles = cardFiles.filter((file) => {
      const fileName = path.basename(file)
      return !EXCLUDE_FILES.includes(fileName)
    })

    console.log(
      `📊 ${filteredCardFiles.length} fichiers de données de cartes trouvés.`
    )

    // Tableau pour stocker toutes les cartes
    let allCards: Card[] = []

    // Charger les cartes de chaque fichier
    for (const cardFile of filteredCardFiles) {
      const fileName = path.basename(cardFile)
      try {
        console.log(`  📄 Lecture de ${fileName}...`)

        // Lire le fichier JSON
        const fileContent = fs.readFileSync(cardFile, 'utf-8')
        const cardsData = JSON.parse(fileContent)

        // Vérifier la structure
        let cards: Card[] = []

        if (Array.isArray(cardsData)) {
          // Si c'est un tableau, utiliser directement
          cards = cardsData
        } else if (typeof cardsData === 'object') {
          // Si c'est un objet, extraire les valeurs
          cards = Object.values(cardsData)
        } else {
          console.error(`❌ Format de données non reconnu dans ${fileName}`)
          continue
        }

        console.log(`    → ${cards.length} cartes trouvées`)

        // Ajouter les cartes à la liste complète
        allCards = allCards.concat(cards)
      } catch (error) {
        console.error(`❌ Erreur lors de la lecture de ${fileName}:`, error)
      }
    }

    console.log(
      `\n📊 Total: ${allCards.length} cartes chargées depuis ${filteredCardFiles.length} fichiers.`
    )

    // Initialiser les compteurs et rapports
    const report = {
      totalCards: allCards.length,
      cardsByType: {} as Record<string, number>,
      cardsWithMissingFields: [] as any[],
      cardsWithMissingImages: [] as any[],
      duplicateIds: [] as string[],
      typesWithProperties: {} as Record<string, string[]>,
      extensionFiles: filteredCardFiles.map((f) => path.basename(f)),
    }

    // Cartes par ID pour vérifier les doublons
    const cardsById: Record<string, Card[]> = {}

    // Propriétés par type de carte
    const propertiesByType: Record<string, Set<string>> = {}

    // Vérifier chaque carte
    for (const card of allCards) {
      // Vérifier les champs requis
      const missingFields = []
      if (!card.id) missingFields.push('id')
      if (!card.name) missingFields.push('name')
      if (!card.type) missingFields.push('type')

      // Ajouter au rapport si des champs sont manquants
      if (missingFields.length > 0) {
        report.cardsWithMissingFields.push({
          id: card.id || 'unknown',
          name: card.name || 'unknown',
          missingFields,
        })
      }

      // Compter par type
      const type = card.type || 'unknown'
      report.cardsByType[type] = (report.cardsByType[type] || 0) + 1

      // Vérifier les images
      let imagePath = ''
      if (card.imageUrl) {
        // Extraire le nom du fichier de l'URL
        const fileName = card.imageUrl.split('/').pop()
        if (fileName) {
          imagePath = path.join(IMAGES_DIR, fileName)
        }
      } else if (card.image) {
        imagePath = path.join(IMAGES_DIR, card.image)
      }

      if (imagePath && !fs.existsSync(imagePath)) {
        report.cardsWithMissingImages.push({
          id: card.id,
          name: card.name,
          imagePath: path.relative(process.cwd(), imagePath),
        })
      }

      // Vérifier les doublons d'ID
      const cardId = String(card.id)
      if (!cardsById[cardId]) {
        cardsById[cardId] = []
      }
      cardsById[cardId].push(card)

      // Collecter les propriétés par type
      if (!propertiesByType[type]) {
        propertiesByType[type] = new Set()
      }

      // Ajouter toutes les propriétés de cette carte
      Object.keys(card).forEach((prop) => {
        propertiesByType[type].add(prop)
      })
    }

    // Identifier les doublons d'ID
    for (const [id, cardsList] of Object.entries(cardsById)) {
      if (cardsList.length > 1) {
        report.duplicateIds.push(id)
      }
    }

    // Convertir les ensembles de propriétés en tableaux
    for (const [type, propsSet] of Object.entries(propertiesByType)) {
      report.typesWithProperties[type] = Array.from(propsSet)
    }

    // Vérifier les images manquantes
    console.log(
      `\n🖼️ Images: ${report.cardsWithMissingImages.length} cartes avec images manquantes sur ${report.totalCards} total`
    )

    // Vérifier les champs manquants
    console.log(
      `📋 Champs: ${report.cardsWithMissingFields.length} cartes avec champs manquants`
    )

    // Vérifier les doublons d'ID
    console.log(`🔢 IDs: ${report.duplicateIds.length} IDs en double`)

    // Afficher les types de cartes
    console.log('\n📊 Répartition par type:')
    for (const [type, count] of Object.entries(report.cardsByType)) {
      console.log(`  - ${type}: ${count} cartes`)
    }

    // Créer le répertoire de debug s'il n'existe pas
    const debugDir = path.dirname(REPORT_PATH)
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true })
    }

    // Enregistrer le rapport dans un fichier
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8')

    console.log(
      `\n✅ Vérification terminée. Rapport enregistré dans: ${REPORT_PATH}`
    )
  } catch (error) {
    console.error('❌ Erreur lors de la vérification des cartes:', error)
  }
}

// Exécuter la vérification
checkCardsIntegrity()
