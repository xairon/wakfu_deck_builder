const fs = require('fs')
const path = require('path')
import * as cheerio from 'cheerio'
import type { CheerioAPI } from 'cheerio'
import type { Element } from 'domhandler'
const axios = require('axios')

// Importation des types uniquement (pas de code exécuté)
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
  HeroFace as ImportedHeroFace,
} from '../src/types/cards'

const __filename = import.meta.url
const __dirname = path.dirname(__filename)

interface Stat {
  value: number
  element: string
}

interface HeroFaceBase {
  name: string
  type: string
  pa: number
  pm: number
  pv: number
  niveau: Stat
  force: Stat
  effects: CardEffect[]
  rarity: string
  extension: string
}

interface CardFace {
  name: string
  subtypes: string[]
  elements: string[]
  stats: {
    [key: string]: {
      value: number
      element: string
    }
  }
  effects: string[]
  extension: string
  rarity: string
  number: string
  imageUrl: string
}

interface HeroFace {
  stats: {
    pa: number
    pm: number
    pv: number
    niveau: ElementalStat
    force: ElementalStat
  }
  effects: CardEffect[]
  keywords: CardKeyword[]
  imageUrl: string
  flavor?: {
    text: string
    attribution?: string
  }
}

// Sélecteurs constants pour éviter la duplication
const SELECTORS = {
  cardName: 'h1',
  cardType: 'h1 small.text-muted',
  subTypes: '.hstack.gap-3:first-child div',
  rarity: '.badge[title]',
  extension: {
    container: '.extension',
    name: '.extension-name',
    number: '.extension-number',
  },
  shortUrl: '.short-link-clipboard',
  stats: {
    container: '.hstack.gap-3:nth-child(2)',
    pa: 'div:contains("PA :") strong',
    pm: 'div:contains("PM :") strong',
    pv: 'div:contains("PV :") strong',
    niveau: {
      container: 'div:contains("Niveau :")',
      value: 'div:contains("Niveau :") strong',
      element: 'div:contains("Niveau :") img.symbole-ressource',
    },
    force: {
      container: 'div:contains("Force :")',
      value: 'div:contains("Force :") strong',
      element: 'div:contains("Force :") img.symbole-ressource',
    },
  },
  effects: {
    container: 'div:contains("Effets :") ul',
    items: 'div:contains("Effets :") ul li',
  },
  keywords: {
    container: 'div:contains("Mots Clefs :") ul',
    items: 'div:contains("Mots Clefs :") ul li',
  },
  flavor: 'div:contains("Ambiance :") p',
  artists: '.artist',
  notes: '.notes',
  image: '.round-card',
} as const

// Fonction pour nettoyer les chaînes de caractères
function cleanString(str: string | undefined): string {
  if (!str) return ''
  return str
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(Artist:|Extension:|Note:)\s*/i, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
}

// Fonction pour extraire une valeur numérique d'un texte
function extractNumber(text: string | undefined): number {
  if (!text) return 0
  const match = text.match(/\d+/)
  return match ? parseInt(match[0]) : 0
}

// Fonction pour extraire un élément depuis une image
function parseElementFromImg($: CheerioAPI, img: Element): CardElement {
  const elementAlt = $(img).attr('alt')?.toLowerCase()
  return elementAlt && ['terre', 'feu', 'eau', 'air'].includes(elementAlt)
    ? (elementAlt as CardElement)
    : 'neutre'
}

// Fonction pour extraire une stat élémentaire
function extractElementalStat(
  $: CheerioAPI,
  selectors: { container: string; value: string; element: string }
): ElementalStat {
  const value = extractNumber($(selectors.value).first().text())
  const element = $(selectors.element).first()

  return {
    value,
    element: element.length > 0 ? parseElementFromImg($, element[0]) : 'neutre',
  }
}

// Fonction pour parser les effets
function parseEffects($: CheerioAPI): CardEffect[] {
  return $(SELECTORS.effects.items)
    .map((_, el) => {
      const $el = $(el)
      const description = cleanString($el.text())

      return {
        description,
        isOncePerTurn: description.toLowerCase().includes('une fois par tour'),
        requiresIncline: $el.find('.symbole-incliner').length > 0,
        elements: $el
          .find('img.symbole-ressource')
          .map((_, img) => parseElementFromImg($, img))
          .get(),
      }
    })
    .get()
}

// Fonction pour parser les mots-clés
function parseKeywords($: CheerioAPI): CardKeyword[] {
  return $(SELECTORS.keywords.items)
    .map((_, el) => {
      const $el = $(el)
      const [name, description = ''] = cleanString($el.text())
        .split(':')
        .map((s) => s.trim())

      return {
        name,
        description,
        elements: $el
          .find('img.symbole-ressource')
          .map((_, img) => parseElementFromImg($, img))
          .get(),
      }
    })
    .get()
}

// Fonction pour extraire les stats de base
function extractHeroStats($: CheerioAPI): BaseStats {
  return {
    pa: extractNumber($(SELECTORS.stats.pa).first().text()),
    pm: extractNumber($(SELECTORS.stats.pm).first().text()),
    pv: extractNumber($(SELECTORS.stats.pv).first().text()),
    niveau: extractElementalStat($, SELECTORS.stats.niveau),
    force: extractElementalStat($, SELECTORS.stats.force),
  }
}

// Fonction pour nettoyer le texte des éléments HTML et espaces superflus
function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/\n/g, '').replace(/\t/g, '').trim()
}

// Fonction pour parser les artistes
function parseArtists($: cheerio.CheerioAPI): string[] {
  const artistsText = $('div:contains("Artistes :")').last().text().trim()
  if (!artistsText) return []
  const artists = artistsText
    .replace('Artistes : ', '')
    .split(',')
    .map((a) => a.trim())
  return [...new Set(artists)] // Remove duplicates
}

// Fonction pour parser les informations d'extension
function parseExtensionInfo($: cheerio.CheerioAPI): ExtensionInfo {
  const extensionDiv = $('div:contains("Extension :")')
  const extensionText = extensionDiv.text().trim()
  const [_, name, number] =
    extensionText.match(/Extension\s*:\s*([^0-9]+)(?:\s*(\d+\/\d+))?/) || []
  const shortUrl = $('.short-link-clipboard').attr('data-shorturl')

  return {
    name: name?.trim() || '',
    number: number?.trim() || '',
    shortUrl,
  }
}

// Fonction pour parser les éléments
function parseElements(
  $: cheerio.CheerioAPI,
  container: cheerio.Cheerio<any>
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

// Fonction pour parser la rareté
function parseRarity($: cheerio.CheerioAPI): CardRarity {
  const rarityText =
    $('div:contains("Rareté :")').find('.badge').attr('title')?.toLowerCase() ||
    ''

  switch (rarityText) {
    case 'peu commune':
      return 'Peu Commune'
    case 'rare':
      return 'Rare'
    case 'mythique':
      return 'Mythique'
    case 'légendaire':
      return 'Légendaire'
    default:
      return 'Commune'
  }
}

// Fonction pour parser les notes
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

// Fonction pour parser le texte d'ambiance
function parseFlavor(
  $: cheerio.CheerioAPI
): { text: string; attribution?: string } | undefined {
  const flavorDiv = $('div:contains("Ambiance :")')
  const flavorText = flavorDiv.find('p').text().trim()

  if (!flavorText) return undefined

  const parts = flavorText.split('-').map((s) => s.trim())
  return parts.length > 1
    ? { text: parts[0], attribution: parts[1] }
    : { text: flavorText }
}

// Fonction pour parser les coûts élémentaires
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

// Fonction pour parser l'expérience
function parseExperience($: cheerio.CheerioAPI): number | undefined {
  const experienceDiv = $('div:contains("Expérience :")').last()
  if (experienceDiv.length === 0) return undefined

  const text = cleanText(experienceDiv.text())
  const match = text.match(/\d+/)
  return match ? parseInt(match[0]) : undefined
}

function parseHeroFace($: CheerioAPI, $face: Cheerio<Element>): HeroFace {
  const stats = extractHeroStats($face)
  const effects = parseEffects($face)
  const keywords = parseKeywords($face)
  const imageUrl = $(SELECTORS.image).attr('src') || ''
  const flavorText = parseFlavor($face)

  return {
    stats,
    effects,
    keywords,
    imageUrl,
    flavorText,
  }
}

function parseHero(filePath: string): HeroCard {
  const isFirstFace = !filePath.endsWith('-2.html')
  const basePath = isFirstFace
    ? filePath.replace(/\.html$/, '')
    : filePath.replace('-2.html', '')
  const rectoPath = `${basePath}.html`
  const versoPath = `${basePath}-2.html`

  // Lecture et parsing du recto
  const rectoContent = fs.readFileSync(rectoPath, 'utf8')
  const $recto = cheerio.load(rectoContent)

  // Extraction du nom
  const cardName = cleanString(
    $recto(SELECTORS.cardName)
      .contents()
      .filter(function () {
        return this.type === 'text'
      })
      .text()
  )

  if (!cardName) {
    throw new Error('Nom de la carte non trouvé')
  }

  // Extraction des sous-types
  const subTypes: string[] = []
  $recto(SELECTORS.subTypes).each((_, el) => {
    const text = cleanString($recto(el).text())
    if (text !== 'Héros') {
      subTypes.push(text)
    }
  })

  // Extraction de la rareté
  const rarity = cleanString(
    $recto(SELECTORS.rarity).attr('title') || ''
  ) as CardRarity

  // Extraction de l'extension
  const extension: ExtensionInfo = {
    name: cleanString($recto(SELECTORS.extension.name).first().text()),
    number: cleanString($recto(SELECTORS.extension.number).first().text()),
    shortUrl: $recto(SELECTORS.shortUrl).attr('data-shorturl'),
  }

  // Parsing du recto
  const recto = parseHeroFace($recto, $recto)

  // Parsing du verso
  let verso: HeroFace | undefined
  if (fs.existsSync(versoPath)) {
    const versoContent = fs.readFileSync(versoPath, 'utf8')
    const $verso = cheerio.load(versoContent)
    verso = parseHeroFace($verso, $verso)
  }

  // Si le verso n'existe pas, on utilise le recto
  if (!verso) {
    verso = recto
  }

  // Extraction des artistes
  const artistsText = cleanString($recto(SELECTORS.artists).text())
  const artists = artistsText
    ? artistsText
        .split(',')
        .map((a) => cleanString(a))
        .filter((a) => a.length > 0)
    : []

  // Extraction des notes
  const notes = $recto(SELECTORS.notes)
    .map((_, el) => cleanString($recto(el).text()))
    .get()
    .filter((note) => note.length > 0)

  // Génération de l'ID
  const id = `${extension.name.toLowerCase()}-${cardName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  return {
    id,
    name: cardName,
    mainType: 'Héros',
    class: subTypes[0] || 'Inconnu',
    subTypes,
    extension,
    rarity,
    level: recto.stats.niveau,
    elements: [recto.stats.niveau.element],
    imageUrl: recto.imageUrl,
    artists,
    notes,
    recto,
    verso,
  }
}

async function parseCard(filePath: string): Promise<Card | null> {
  try {
    const html = await fs.promises.readFile(filePath, 'utf-8')
    const $ = cheerio.load(html)

    const cardName = cleanString(
      $(SELECTORS.cardName).contents().first().text()
    )
    const cardType = cleanString($(SELECTORS.cardType).text())

    if (cardType === 'Héros') {
      const isFirstFace = !filePath.endsWith('-2.html')
      if (isFirstFace) {
        return parseHero(filePath)
      }
      return null // On ignore les faces 2, elles sont traitées avec la face 1
    }

    const subTypes: string[] = []
    $(SELECTORS.subTypes).each((_, el) => {
      const text = cleanString($(el).text())
      if (text !== cardType) {
        subTypes.push(text)
      }
    })

    const elements = $(SELECTORS.stats.container)
      .find('img.symbole-ressource')
      .map((_, img) => parseElementFromImg($, img))
      .get()

    const stats = extractHeroStats($)

    const baseCard = {
      id: path.basename(filePath, '.html'),
      name: cardName,
      mainType: cardType as CardMainType,
      subTypes,
      extension: {
        name: cleanString($(SELECTORS.extension.name).text()),
        number: cleanString($(SELECTORS.extension.number).text()),
        shortUrl: $(SELECTORS.shortUrl).attr('data-shorturl'),
      },
      rarity: $(SELECTORS.rarity).attr('title') as CardRarity,
      elements: elements.length > 0 ? elements : undefined,
      imageUrl: $(SELECTORS.image).attr('src'),
      stats,
      effects: parseEffects($),
      keywords: parseKeywords($),
      artists: $(SELECTORS.artists)
        .text()
        .replace('Artistes :', '')
        .split(',')
        .map((artist) => cleanString(artist))
        .filter((artist) => artist.length > 0),
    }

    switch (cardType) {
      case 'Allié':
        return {
          ...baseCard,
          mainType: 'Allié',
          race: subTypes[0],
          tribe: subTypes[1],
          stats: { ...stats },
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
          stats: { ...stats },
          requirements: {
            level: stats.niveau?.value,
            elements,
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
          buildCost: baseCard.effects?.[0]?.cost,
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

      case 'Protecteur':
        return {
          ...baseCard,
          mainType: 'Protecteur',
          guardianType: subTypes[0],
          stats: stats,
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
          stats: stats,
          elementalAffinity: {
            primary: elements[0],
            secondary: elements[1],
          },
        } as ElementalAllyCard

      default:
        return null
    }
  } catch (error) {
    console.error(`Erreur lors du parsing de ${filePath}:`, error)
    return null
  }
}

async function parseAllCards() {
  const pagesDir = 'raw-card-data/pages'
  const outputDir = 'data'
  const files = await fs.promises.readdir(pagesDir, { recursive: true })
  const htmlFiles = files.filter((file: string) =>
    file.toString().endsWith('.html')
  )

  let successfullyParsed = 0
  const totalCards = htmlFiles.length
  const parsingErrors: { file: string; error: string }[] = []
  const parsedCards: Card[] = []

  for (const file of htmlFiles) {
    const filePath = path.join(pagesDir, file.toString())
    try {
      console.log(`\nTraitement de ${filePath}...`)
      const parsedCard = await parseCard(filePath)
      if (parsedCard) {
        parsedCards.push(parsedCard)
        successfullyParsed++
        console.log(`✓ ${filePath} parsé avec succès`)
      } else {
        console.error(`✗ Échec du parsing de ${filePath}`)
        parsingErrors.push({ file: filePath, error: 'Parsing failed' })
      }
    } catch (error) {
      console.error(`✗ Erreur lors du parsing de ${filePath}:`, error)
      parsingErrors.push({ file: filePath, error: String(error) })
    }
  }

  // Sauvegarder les cartes parsées
  console.log('\nSauvegarde des cartes...')
  const outputPath = path.join(outputDir, 'parsed_cards.json')
  fs.writeFileSync(outputPath, JSON.stringify(parsedCards, null, 2))
  console.log(`${parsedCards.length} cartes sauvegardées dans ${outputPath}`)

  // Sauvegarder le rapport d'erreurs si nécessaire
  if (parsingErrors.length > 0) {
    console.log("\nSauvegarde du rapport d'erreurs...")
    const errorPath = path.join(outputDir, 'parsing_errors.json')
    fs.writeFileSync(errorPath, JSON.stringify(parsingErrors, null, 2))
    console.log(
      `${parsingErrors.length} erreurs de parsing sauvegardées dans ${errorPath}`
    )
  }

  console.log('\n=== Résumé du parsing ===')
  console.log(`Total des cartes : ${totalCards}`)
  console.log(`Cartes parsées avec succès : ${successfullyParsed}`)
  console.log(
    `Taux de réussite : ${((successfullyParsed / totalCards) * 100).toFixed(2)}%`
  )
  console.log('\n=== Fin du parsing ===')
}

// Exécution du parsing
parseAllCards().catch(console.error)
