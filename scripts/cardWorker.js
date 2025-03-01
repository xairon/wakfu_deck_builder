import axios from 'axios'
import * as cheerio from 'cheerio'
import { parentPort } from 'worker_threads'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function extractNumberFromText(text) {
  const match = text.match(/\d+/)
  return match ? parseInt(match[0]) : null
}

async function fetchCardDetails(url) {
  try {
    console.log(`\nRécupération des détails depuis ${url}...`)
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)
    
    // Extraire le type et les informations supplémentaires
    const typeText = $('h1 small.text-muted').text().trim()
    console.log('Type trouvé:', typeText)
    
    // Extraire toutes les informations de la première div hstack
    const cardInfo = {
      type: typeText || '',
      class: '',
      specialization: null,
      unique: false
    }
    
    // Parcourir tous les divs de la première hstack
    const firstHstack = $('.hstack').first()
    console.log('Contenu de la première hstack:', firstHstack.text().trim())
    
    firstHstack.children('div').each((i, el) => {
      const text = $(el).text().trim()
      console.log('Div trouvé:', text)
      
      if (i === 0) {
        cardInfo.type = text || cardInfo.type // Garder le type du h1 si pas de type dans le hstack
      } else if (text === 'Unique') {
        cardInfo.unique = true
      } else {
        // Si ce n'est pas le type ni "Unique", c'est soit une classe soit une spécialisation
        if (!cardInfo.class) {
          cardInfo.class = text
        } else {
          cardInfo.specialization = text
        }
      }
    })
    console.log('Informations de carte trouvées:', cardInfo)
    
    // Extraire les informations de niveau et de force avec leurs éléments
    const stats = {
      level: null,
      force: null
    }
    
    // Parcourir tous les divs de la deuxième hstack
    const secondHstack = $('.hstack').eq(1)
    console.log('Contenu de la deuxième hstack:', secondHstack.text().trim())
    
    secondHstack.children('div').each((i, el) => {
      const $el = $(el)
      const text = $el.text().trim()
      console.log('Stats div trouvé:', text)
      
      // Extraire l'élément de l'image
      const img = $el.find('img.symbole-ressource')
      const element = img.length ? img.attr('alt') : 'Neutre'
      console.log('Élément trouvé dans l\'image:', element)
      
      // Extraire la valeur numérique
      const value = extractNumberFromText(text)
      console.log('Valeur numérique trouvée:', value)
      
      if (text.includes('Niveau') && value !== null) {
        stats.level = {
          value: value,
          element: element
        }
      } else if (text.includes('Force') && value !== null) {
        stats.force = {
          value: value,
          element: element
        }
      }
    })
    console.log('Statistiques trouvées:', stats)
    
    // Extraire la rareté
    const rareteSpan = $('.badge[title]')
    const rarete = rareteSpan.attr('title')
    console.log('Rareté trouvée:', rarete)
    
    // Construire l'objet final en s'assurant qu'il n'y a pas de valeurs undefined
    const result = { 
      type: cardInfo.type || '', 
      class: cardInfo.class || '',
      specialization: cardInfo.specialization || null,
      unique: cardInfo.unique || false,
      stats: {
        level: stats.level || null,
        force: stats.force || null
      },
      rarete: rarete || '',
      element: stats.level?.element || stats.force?.element || 'Neutre'
    }
    
    console.log('Résultat final:', result)
    return result
  } catch (error) {
    console.error(`Erreur lors de la récupération des détails pour ${url}:`, error)
    throw error
  }
}

// Écouter les messages du thread principal
parentPort.on('message', async ({ card, delay }) => {
  try {
    await sleep(delay)
    const details = await fetchCardDetails(card.url)
    parentPort.postMessage({
      success: true,
      data: {
        ...card,
        type: details.type || card.type,
        class: details.class || card.class,
        specialization: details.specialization,
        unique: details.unique,
        stats: details.stats,
        rarete: details.rarete || card.rarete,
        element: details.element
      }
    })
  } catch (error) {
    parentPort.postMessage({
      success: false,
      error: error.message
    })
  }
}) 