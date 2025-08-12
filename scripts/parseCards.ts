import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import * as cheerio from 'cheerio'
import type {
  Card,
  CardMainType,
  CardRarity,
  CardElement,
  CardEffect,
  CardKeyword,
  BaseStats,
  ElementalStat,
  ElementalCost,
  ExtensionInfo,
  AllyCard,
  ActionCard,
  EquipmentCard,
  ZoneCard,
  RoomCard,
  DofusCard,
  HeroCard,
  ProtectorCard,
  HavenBagCard,
  ElementalAllyCard,
} from '../src/types/cards'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function parseRarity(text: string): CardRarity {
  const rarityMap: Record<string, CardRarity> = {
    commune: 'Commune',
    'peu commune': 'Peu Commune',
    rare: 'Rare',
    mythique: 'Mythique',
    légendaire: 'Légendaire',
  }
  return rarityMap[text.toLowerCase()] || 'Commune'
}

function parseElement(className: string): CardElement | undefined {
  const elementMap: Record<string, CardElement> = {
    air: 'air',
    eau: 'eau',
    feu: 'feu',
    terre: 'terre',
    neutre: 'neutre',
  }
  const match = className.match(/symbole-ressource-(\w+)/)
  return match ? elementMap[match[1].toLowerCase()] : undefined
}

function parseStats(
  $: cheerio.CheerioAPI,
  statsDiv: cheerio.Cheerio<cheerio.Element>
): BaseStats {
  const stats: BaseStats = {}
  statsDiv.find('div').each((_, el) => {
    const text = $(el).text().trim()
    if (text.includes('PA')) stats.pa = parseInt(text.match(/\d+/)?.[0] || '0')
    if (text.includes('PM')) stats.pm = parseInt(text.match(/\d+/)?.[0] || '0')
    if (text.includes('PV')) stats.pv = parseInt(text.match(/\d+/)?.[0] || '0')
  })
  return stats
}

function parseEffects(
  $: cheerio.CheerioAPI,
  effectsDiv: cheerio.Cheerio<cheerio.Element>
): CardEffect[] {
  const effects: CardEffect[] = []
  effectsDiv.find('li').each((_, el) => {
    const $effect = $(el)
    const text = $effect.text().trim()

    const effect: CardEffect = {
      description: text,
      isOncePerTurn: text.toLowerCase().includes('une fois par tour'),
    }

    // Parser les coûts élémentaires
    const htmlContent = $.html(el)
    if (htmlContent.includes('symbole-ressource')) {
      effect.cost = parseElementalCosts(htmlContent)
    }

    // Parser les jetons liés
    const tokenMatch = text.match(/mettez en jeu un jeton [""]([^""]+)[""]/i)
    if (tokenMatch) {
      const tokenName = tokenMatch[1]
      const tokenForceMatch = text.match(/Force (\d+)/)
      const tokenElements = parseElementalCosts(htmlContent)

      effect.linkedTokens = [
        {
          name: tokenName,
          type: tokenName.split(' - '),
          force: tokenForceMatch ? parseInt(tokenForceMatch[1]) : undefined,
          elements:
            tokenElements.length > 0
              ? tokenElements.map((c) => c.element)
              : undefined,
        },
      ]
    }

    // Parser les conditions
    const conditions: string[] = []
    if (text.includes('si')) {
      const conditionMatch = text.match(/si ([^,\.]+)/i)
      if (conditionMatch) {
        conditions.push(conditionMatch[1].trim())
      }
    }
    if (conditions.length > 0) {
      effect.conditions = conditions
    }

    effects.push(effect)
  })
  return effects
}

function parseKeywords(
  $: cheerio.CheerioAPI,
  keywordsDiv: cheerio.Cheerio<cheerio.Element>
): CardKeyword[] {
  const keywords: CardKeyword[] = []
  keywordsDiv.find('li').each((_, el) => {
    const $keyword = $(el)
    const text = $keyword.text().trim()
    const [name, description] = text.split(':').map((s) => s.trim())

    if (name) {
      const keyword: CardKeyword = {
        name,
        description: description || '',
      }

      // Parser les éléments associés
      const htmlContent = $.html(el)
      if (htmlContent.includes('symbole-ressource')) {
        keyword.elements = parseElementalCosts(htmlContent).map(
          (c) => c.element
        )
      }

      // Parser le niveau si présent
      const levelMatch = text.match(/niveau (\d+)/i)
      if (levelMatch) {
        keyword.level = parseInt(levelMatch[1])
      }

      keywords.push(keyword)
    }
  })
  return keywords
}

function parseBaseStats(
  $: cheerio.CheerioAPI,
  statsDiv: cheerio.Cheerio<cheerio.Element>
): BaseStats {
  const stats: BaseStats = {}

  statsDiv.find('div').each((_, el) => {
    const text = $(el).text().trim()

    if (text.includes('PA')) {
      stats.pa = parseInt(text.match(/\d+/)?.[0] || '0')
    }
    if (text.includes('PM')) {
      stats.pm = parseInt(text.match(/\d+/)?.[0] || '0')
    }
    if (text.includes('PV')) {
      stats.pv = parseInt(text.match(/\d+/)?.[0] || '0')
    }
    if (text.includes('Force')) {
      stats.force = parseElementalStat($, text)
    }
    if (text.includes('Niveau')) {
      stats.niveau = parseElementalStat($, text)
    }
  })

  return stats
}

function parseExtensionInfo($: cheerio.CheerioAPI): ExtensionInfo {
  const extensionDiv = $('div')
    .filter((_, el) => {
      return $(el).text().trim().startsWith('Extension :')
    })
    .last()

  if (extensionDiv.length === 0)
    return { name: '', number: '', shortUrl: undefined }

  const text = cleanText(extensionDiv.text())
  const match = text.match(/Extension\s*:\s*([^0-9]+)\s*(\d+\/\d+)/)
  const shortUrlMatch = $('.short-link-clipboard').attr('data-shorturl')

  if (!match) return { name: '', number: '', shortUrl: shortUrlMatch }

  return {
    name: cleanText(match[1]),
    number: match[2],
    shortUrl: shortUrlMatch,
  }
}

function parseNotes($: cheerio.CheerioAPI): string[] {
  const notes: string[] = []
  const notesDiv = $('div:contains("Notes :")').last()
  if (notesDiv.length > 0) {
    notesDiv.find('ul li').each((_, el) => {
      const note = cleanText($(el).text())
      if (note.length > 0) {
        notes.push(note)
      }
    })
  }
  return notes
}

function parseFlavor(
  $: cheerio.CheerioAPI
): { text: string; attribution?: string } | undefined {
  const flavorDiv = $('div:contains("Ambiance :")').last()
  if (flavorDiv.length === 0) return undefined

  const text = cleanText(flavorDiv.find('p').text())
  if (!text) return undefined

  const parts = text.split('-').map((s) => cleanText(s))
  return parts.length > 1 ? { text: parts[0], attribution: parts[1] } : { text }
}

function parseElementalCosts(text: string): ElementalCost[] {
  const costs: ElementalCost[] = []
  const elementRegex = /symbole-ressource-(\w+)/g
  let match
  const elementCounts = new Map<string, number>()

  while ((match = elementRegex.exec(text)) !== null) {
    const element = match[1].toLowerCase()
    elementCounts.set(element, (elementCounts.get(element) || 0) + 1)
  }

  for (const [element, count] of elementCounts.entries()) {
    costs.push({
      element: element as CardElement,
      count,
    })
  }

  return costs
}

function parseElementalStat(
  $: cheerio.CheerioAPI,
  text: string
): ElementalStat | undefined {
  const valueMatch = text.match(/\d+/)
  if (!valueMatch) return undefined

  const value = parseInt(valueMatch[0])
  const elementMatch = text.match(/symbole-ressource-(\w+)/)
  if (!elementMatch) return undefined

  return {
    value,
    element: elementMatch[1].toLowerCase() as CardElement,
  }
}

// Fonction pour nettoyer le texte des éléments HTML et espaces superflus
function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/\n/g, '').replace(/\t/g, '').trim()
}

// Fonction pour parser les artistes
function parseArtists($: cheerio.CheerioAPI): string[] {
  const artistsDiv = $('div')
    .filter((_, el) => {
      return $(el).text().trim().startsWith('Artistes :')
    })
    .last()

  if (artistsDiv.length === 0) return []

  const artistsText = artistsDiv.text().replace('Artistes :', '').trim()
  return artistsText
    .split(',')
    .map((artist) => cleanText(artist))
    .filter(
      (artist) =>
        artist.length > 0 &&
        !artist.includes('Niveau :') &&
        !artist.includes('Élément :')
    )
}

// Fonction pour parser les éléments
function parseElements(
  $: cheerio.CheerioAPI,
  container: cheerio.Cheerio<cheerio.Element>
): CardElement[] {
  const elements: CardElement[] = []
  container.find('.symbole-ressource').each((_, el) => {
    const elementClass = $(el)
      .attr('class')
      ?.match(/symbole-ressource-(\w+)/)?.[1]
    if (elementClass) {
      const element = elementClass.toLowerCase() as CardElement
      if (!elements.includes(element)) {
        elements.push(element)
      }
    }
  })
  return elements
}

function parseCard(filePath: string, extensionName: string): Card | null {
  try {
    const html = fs.readFileSync(filePath, 'utf-8')
    const $ = cheerio.load(html)

    const mainType = cleanText($('h1 small.text-muted').text()) as CardMainType
    const name = cleanText($('h1').contents().first().text())

    // Extraire les sous-types
    const subTypes: string[] = []
    $('.hstack.gap-3')
      .first()
      .find('div')
      .each((_, el) => {
        const subType = cleanText($(el).text())
        if (subType !== mainType) {
          subTypes.push(subType)
        }
      })

    // Extraire les éléments
    const elements = parseElements($, $('.row'))

    // Construire l'objet de base
    const baseCard = {
      id: path.basename(filePath, '.html'),
      name,
      mainType,
      subTypes,
      extension: parseExtensionInfo($),
      rarity: parseRarity($),
      elements: elements.length > 0 ? elements : undefined,
      imageUrl: $('.card-img-top').attr('src'),
      stats: parseBaseStats($, $('.hstack.gap-3').eq(1)),
      effects: parseEffects($, $('div:contains("Effets :") ul')),
      keywords: parseKeywords($, $('div:contains("Mots Clefs :") ul')),
      experience: parseExperience($),
      artists: parseArtists($),
      notes: parseNotes($),
      flavor: parseFlavor($),
    }

    // Retourner l'objet selon le type principal
    switch (mainType) {
      case 'Allié':
        return {
          ...baseCard,
          mainType: 'Allié',
          race: subTypes[0],
          tribe: subTypes[1],
        } as AllyCard

      case 'Action':
        return {
          ...baseCard,
          mainType: 'Action',
          spellSchool: subTypes[0],
        } as ActionCard

      case 'Équipement':
        return {
          ...baseCard,
          mainType: 'Équipement',
          equipmentType: subTypes[0] as any,
          requirements: {
            level: stats.niveau?.value,
            elements: elements,
            // Ajouter les métiers requis si présents
          },
        } as EquipmentCard

      case 'Zone':
        return {
          ...baseCard,
          mainType: 'Zone',
        } as ZoneCard

      case 'Salle':
        return {
          ...baseCard,
          mainType: 'Salle',
          buildCost: effects[0]?.cost,
        } as RoomCard

      case 'Dofus':
        return {
          ...baseCard,
          mainType: 'Dofus',
          requirements: {
            level: stats.niveau?.value,
            elements,
          },
        } as DofusCard

      case 'Héros':
        return {
          ...baseCard,
          mainType: 'Héros',
          class: subTypes[0],
          level: stats.niveau!,
        } as HeroCard

      case 'Protecteur':
        return {
          ...baseCard,
          mainType: 'Protecteur',
          guardianType: subTypes[0],
        } as ProtectorCard

      case 'Havre Sac':
        return {
          ...baseCard,
          mainType: 'Havre Sac',
        } as HavenBagCard

      case 'Allié Élémentaire':
        return {
          ...baseCard,
          mainType: 'Allié Élémentaire',
          elements,
          elementalAffinity: {
            primary: elements[0],
            secondary: elements[1],
          },
        } as ElementalAllyCard

      default:
        console.warn(`Type de carte non géré : ${mainType}`)
        return null
    }
  } catch (error) {
    console.error(`Erreur lors du parsing de ${filePath}:`, error)
    return null
  }
}

// Fonction pour parser l'expérience
function parseExperience($: cheerio.CheerioAPI): number | undefined {
  const experienceDiv = $('div:contains("Expérience :")').last()
  if (experienceDiv.length === 0) return undefined

  const text = cleanText(experienceDiv.text())
  const match = text.match(/\d+/)
  return match ? parseInt(match[0]) : undefined
}

// Fonction pour parser la rareté
function parseRarity($: cheerio.CheerioAPI): CardRarity {
  const rarityDiv = $('div')
    .filter((_, el) => {
      return $(el).text().trim().startsWith('Rareté :')
    })
    .last()

  if (rarityDiv.length === 0) return 'Commune'

  const text = cleanText(rarityDiv.text().toLowerCase())
  if (text.includes('peu commune')) return 'Peu Commune'
  if (text.includes('rare')) return 'Rare'
  if (text.includes('mythique')) return 'Mythique'
  if (text.includes('légendaire')) return 'Légendaire'
  return 'Commune'
}

async function parseAllCards(): Promise<void> {
  const pagesDir = path.join(__dirname, '..', 'raw-card-data', 'pages')
  const outputDir = path.join(__dirname, '..', 'data')
  fs.mkdirSync(outputDir, { recursive: true })

  const extensions = fs.readdirSync(pagesDir)
  let totalCards = 0
  let successfullyParsed = 0
  const errors: { file: string; error: string }[] = []

  for (const extension of extensions) {
    const extensionDir = path.join(pagesDir, extension)
    if (fs.statSync(extensionDir).isDirectory()) {
      console.log(`\nParsing de l'extension ${extension}...`)
      const cards = fs
        .readdirSync(extensionDir)
        .filter((file) => file.endsWith('.html'))

      const parsedCards: Card[] = []
      totalCards += cards.length

      for (const card of cards) {
        const cardPath = path.join(extensionDir, card)
        try {
          const parsedCard = parseCard(cardPath, extension)
          if (parsedCard) {
            parsedCards.push(parsedCard)
            successfullyParsed++
          } else {
            errors.push({ file: cardPath, error: 'Parsing failed' })
          }
        } catch (error) {
          errors.push({ file: cardPath, error: String(error) })
        }
      }

      // Sauvegarder les cartes parsées pour cette extension
      const outputPath = path.join(outputDir, `${extension}.json`)
      fs.writeFileSync(outputPath, JSON.stringify(parsedCards, null, 2))
      console.log(`${parsedCards.length} cartes parsées pour ${extension}`)
    }
  }

  // Sauvegarder le rapport d'erreurs si nécessaire
  if (errors.length > 0) {
    const errorPath = path.join(outputDir, 'parsing_errors.json')
    fs.writeFileSync(errorPath, JSON.stringify(errors, null, 2))
    console.log(
      `\n${errors.length} erreurs de parsing sauvegardées dans ${errorPath}`
    )
  }

  console.log('\nParsing terminé !')
  console.log(`Total des cartes : ${totalCards}`)
  console.log(`Cartes parsées avec succès : ${successfullyParsed}`)
  console.log(
    `Taux de réussite : ${((successfullyParsed / totalCards) * 100).toFixed(2)}%`
  )
}

// Exécution du parsing
parseAllCards().catch(console.error)
