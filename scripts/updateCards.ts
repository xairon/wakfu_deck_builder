import axios from 'axios'
import * as cheerio from 'cheerio'
import * as fs from 'fs/promises'
import * as path from 'path'

const BASE_URL = 'https://www.wtcg-return.fr'
const CARDS_DIR = './cartes'
const DELAY = 1000 // 1 seconde entre chaque requête

interface Card {
  url: string
  name: string
  type: string
  rarete: string
  element: string | null
  [key: string]: any
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchCardDetails(url: string): Promise<{ type: string, element: string | null, rarete: string }> {
  try {
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)
    
    // Extraire le type
    const type = $('div.card-info div:nth-child(3)').text().trim()
    
    // Extraire l'élément
    const elementImg = $('.symbole-ressource')
    const element = elementImg.length ? elementImg.attr('alt') || null : null
    
    // Extraire la rareté
    const rareteSpan = $('.rarete span')
    const rarete = rareteSpan.attr('title') || ''
    
    return { type, element, rarete }
  } catch (error) {
    console.error(`Erreur lors de la récupération des détails pour ${url}:`, error)
    throw error
  }
}

async function updateCardsFile(filePath: string) {
  try {
    // Lire le fichier
    const content = await fs.readFile(filePath, 'utf-8')
    const cards: Card[] = JSON.parse(content)
    
    // Mettre à jour chaque carte
    for (const card of cards) {
      try {
        console.log(`Traitement de ${card.name}...`)
        const { type, element, rarete } = await fetchCardDetails(card.url)
        
        // Mettre à jour les informations
        card.type = type
        card.element = element
        card.rarete = rarete
        
        // Attendre avant la prochaine requête
        await sleep(DELAY)
      } catch (error) {
        console.error(`Erreur pour la carte ${card.name}:`, error)
      }
    }
    
    // Sauvegarder le fichier mis à jour
    await fs.writeFile(filePath, JSON.stringify(cards, null, 2))
    console.log(`✅ Fichier ${filePath} mis à jour`)
  } catch (error) {
    console.error(`Erreur lors du traitement du fichier ${filePath}:`, error)
  }
}

async function main() {
  try {
    // Lister tous les fichiers JSON dans le dossier cartes
    const files = await fs.readdir(CARDS_DIR)
    const jsonFiles = files.filter(file => file.endsWith('.json'))
    
    // Traiter chaque fichier
    for (const file of jsonFiles) {
      console.log(`\nTraitement du fichier ${file}...`)
      await updateCardsFile(path.join(CARDS_DIR, file))
    }
    
    console.log('\n✨ Mise à jour terminée')
  } catch (error) {
    console.error('Erreur lors de la mise à jour des cartes:', error)
  }
}

main() 