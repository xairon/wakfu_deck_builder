import * as fs from 'fs'
import * as cheerio from 'cheerio'
import type {
  Card,
  CardElement,
  BaseStats,
  CardEffect,
  CardKeyword,
  HeroCard,
  BaseCard,
  ElementalStat,
  ExtensionInfo,
  CardRarity,
  HeroFace,
} from '../types/cards' // Ajustement du chemin d'importation

// Types utilitaires
type CheerioElement = cheerio.Element
type CheerioSelector = string
type ElementCallback = (
  this: CheerioElement,
  index: number,
  element: CheerioElement
) => boolean

// Constantes pour les valeurs par défaut
const DEFAULT_ELEMENT: CardElement = 'neutre'
const DEFAULT_STATS: BaseStats = {
  pa: 0,
  pm: 0,
  pv: 0,
  force: { value: 0, element: DEFAULT_ELEMENT },
  niveau: { value: 0, element: DEFAULT_ELEMENT },
} as const

const DEFAULT_HERO_FACE: HeroFace = {
  stats: DEFAULT_STATS,
  effects: [],
  keywords: [],
  imageUrl: '',
} as const

function parseEffect(text: string): CardEffect {
  return {
    description: text,
    isOncePerTurn: text.toLowerCase().includes('une fois par tour'),
    requiresIncline: text.includes('Incliner'),
  }
}

function extractEffects($: cheerio.CheerioAPI): CardEffect[] {
  return $('div:contains("Effets :")')
    .first()
    .find('ul li')
    .map(function (this: CheerioElement): CardEffect {
      return parseEffect($(this).text().trim())
    })
    .get()
}

function areEffectsIdentical(
  effects1: CardEffect[],
  effects2: CardEffect[]
): boolean {
  return (
    JSON.stringify(effects1.map((e) => e.description)) ===
    JSON.stringify(effects2.map((e) => e.description))
  )
}

async function loadHtml(filePath: string): Promise<cheerio.CheerioAPI> {
  try {
    const html = await fs.promises.readFile(filePath, 'utf-8')
    const $ = cheerio.load(html)
    return $ as cheerio.CheerioAPI
  } catch (error) {
    console.error(`Erreur lors du chargement de ${filePath}:`, error)
    throw error
  }
}

function createBaseCard(name: string = '', subTypes: string[] = []): BaseCard {
  return {
    id: '',
    name,
    mainType: 'Héros',
    subTypes,
    extension: {
      name: '',
      number: '',
      shortUrl: '',
    },
    rarity: 'Commune',
    level: {
      value: 0,
      element: DEFAULT_ELEMENT,
    },
    elements: [],
    artists: [],
    imageUrl: '',
  }
}

function parseElementFromImg(
  $: cheerio.CheerioAPI,
  imgElement: CheerioElement
): CardElement {
  const elementClass = $(imgElement).attr('class')
  if (!elementClass) return DEFAULT_ELEMENT

  const elementMatch = elementClass.match(/symbole-ressource-(\w+)/)
  if (!elementMatch) return DEFAULT_ELEMENT

  const elementValue = elementMatch[1].toLowerCase()
  return isValidCardElement(elementValue) ? elementValue : DEFAULT_ELEMENT
}

function isValidCardElement(element: string): element is CardElement {
  return ['terre', 'feu', 'eau', 'air', 'neutre'].includes(element)
}

async function parseHero(
  filePath: string,
  extension: string
): Promise<HeroCard> {
  console.log(`Début du parsing de ${filePath}`)
  const isFirstFace = !filePath.endsWith('-2.html')
  const rectoPath = isFirstFace
    ? filePath
    : filePath.replace(/-2\.html$/, '.html')
  const versoPath = isFirstFace
    ? filePath.replace(/\.html$/, '-2.html')
    : filePath

  try {
    const $recto = await loadHtml(rectoPath)

    // Extraction du nom avec typage strict
    const cardName = $recto('h1')
      .first()
      .contents()
      .filter(function (this: CheerioElement): boolean {
        return this.type === 'text'
      })
      .text()
      .trim()

    if (!cardName) {
      throw new Error('Nom de carte non trouvé')
    }

    console.log(`Parsing du héros: ${cardName}`)

    // Extraction des sous-types avec typage strict
    const subTypes = $recto('.hstack.gap-3')
      .first()
      .children('div')
      .map(function (this: CheerioElement): string | null {
        const text = $recto(this).text().trim()
        return text !== 'Héros' ? text : null
      })
      .get()
      .filter((type): type is string => type !== null)

    // Extraction de la rareté avec typage strict
    const rarityElement = $recto('div')
      .filter(function (this: CheerioElement): boolean {
        return $recto(this).text().trim().startsWith('Rareté :')
      })
      .first()

    const rarity = (rarityElement.text().trim().split(':')[1]?.trim() ||
      'Commune') as CardRarity
    console.log(`Rareté trouvée: ${rarity}`)

    // Extraction de l'extension avec typage strict
    const extensionElement = $recto('div')
      .filter(function (this: CheerioElement): boolean {
        return $recto(this).text().trim().startsWith('Extension :')
      })
      .first()

    const extensionText = extensionElement.text().trim()
    const extensionMatch = extensionText.match(
      /Extension : (.+?)(?:\s+(\d+)\/(\d+))?$/
    )
    const extensionName = extensionMatch ? extensionMatch[1].trim() : extension
    const extensionNumber = extensionMatch?.[2]
      ? `${extensionMatch[2]}/${extensionMatch[3]}`
      : ''
    console.log(`Extension trouvée: ${extensionName} (${extensionNumber})`)

    // Parsing du recto
    console.log('Parsing du recto...')
    const rectoCard = await parseBaseCard(rectoPath)

    // Extraction des stats du recto
    const rectoStats = extractHeroStats($recto)
    console.log('Stats du recto:', rectoStats)

    // Création de la face recto
    const rectoFace: HeroFace = {
      stats: {
        ...rectoStats,
        niveau: rectoCard.level ?? DEFAULT_STATS.niveau,
        force: rectoStats.force ?? DEFAULT_STATS.force,
      },
      effects: extractEffects($recto),
      keywords: [],
      imageUrl: rectoCard.imageUrl || '',
    }

    let versoFace: HeroFace
    try {
      console.log('Tentative de parsing du verso...')
      const $verso = await loadHtml(versoPath)
      const versoCard = await parseBaseCard(versoPath)

      // Extraction des stats du verso
      const versoStats = extractHeroStats($verso)
      console.log('Stats du verso:', versoStats)

      // Création de la face verso
      versoFace = {
        stats: {
          ...versoStats,
          niveau: versoCard.level ?? DEFAULT_STATS.niveau,
          force: versoStats.force ?? DEFAULT_STATS.force,
        },
        effects: extractEffects($verso),
        keywords: [],
        imageUrl: versoCard.imageUrl || '',
      }

      // Vérification des faces identiques
      const areStatsIdentical =
        JSON.stringify(rectoStats) === JSON.stringify(versoStats)
      const effectsIdentical = areEffectsIdentical(
        versoFace.effects,
        rectoFace.effects
      )

      if (areStatsIdentical && effectsIdentical) {
        console.log('Note: Le verso est identique au recto (stats et effets)')
        versoFace = { ...rectoFace }
      } else {
        if (areStatsIdentical)
          console.log('Note: Les stats du verso sont identiques au recto')
        if (effectsIdentical)
          console.log('Note: Les effets du verso sont identiques au recto')
      }
    } catch (error: any) {
      if (fs.existsSync(versoPath)) {
        console.warn(
          `Avertissement : Échec du parsing du verso ${versoPath}. Utilisation du recto. Erreur: ${error.message}`
        )
      } else {
        // console.log(`Note : Fichier verso ${versoPath} non trouvé. C'est normal pour les héros non double-face.`);
      }
      versoFace = { ...rectoFace } // Utiliser le recto si le verso n'existe pas ou si le parsing échoue
    }

    // Création de la carte Héros finale
    const heroCard: HeroCard = {
      ...createBaseCard(cardName, subTypes),
      mainType: 'Héros',
      rarity,
      extension: {
        name: extensionName,
        number: extensionNumber,
        shortUrl: '', // Sera défini plus tard si nécessaire
      },
      level: rectoFace.stats.niveau,
      elements: Array.from(
        new Set([
          rectoFace.stats.force.element,
          rectoFace.stats.niveau.element,
          ...(versoFace.stats.force.element !== DEFAULT_ELEMENT
            ? [versoFace.stats.force.element]
            : []),
          ...(versoFace.stats.niveau.element !== DEFAULT_ELEMENT
            ? [versoFace.stats.niveau.element]
            : []),
        ])
      ).filter((el) => el !== DEFAULT_ELEMENT),
      recto: rectoFace,
      verso: versoFace,
      imageUrl: rectoFace.imageUrl,
    }

    console.log(`Parsing de ${cardName} terminé.`)
    return heroCard
  } catch (error) {
    console.error(`Erreur critique lors du parsing de ${filePath}:`, error)
    throw error
  }
}

function extractHeroStats($: cheerio.CheerioAPI): BaseStats {
  const stats: BaseStats = { ...DEFAULT_STATS }
  const statElements = $('.col-auto.text-center.flex-grow-1.my-1')

  statElements.each(function (this: CheerioElement) {
    const imgElement = $(this).find('img')
    const valueElement = $(this).find('div').last()
    const statValue = parseInt(valueElement.text().trim(), 10)

    if (imgElement.length && !isNaN(statValue)) {
      const imgSrc = imgElement.attr('src')
      if (imgSrc) {
        if (imgSrc.includes('pv.png')) stats.pv = statValue
        else if (imgSrc.includes('pa.png')) stats.pa = statValue
        else if (imgSrc.includes('pm.png')) stats.pm = statValue
        else if (imgSrc.includes('force.png')) {
          stats.force = {
            value: statValue,
            element: parseElementFromImg($ || cheerio.load(''), imgElement[0]),
          }
        } else if (imgSrc.includes('niv.png')) {
          stats.niveau = {
            value: statValue,
            element: parseElementFromImg($ || cheerio.load(''), imgElement[0]),
          }
        }
      }
    }
  })
  return stats
}

async function parseBaseCard(filePath: string): Promise<BaseCard> {
  const $ = await loadHtml(filePath)
  const cardName = $('h1').first().text().trim()

  // Sous-types (ex: "Héros", "Guerrier")
  const subTypes: string[] = []
  $('.hstack.gap-3 > div').each(function (this: CheerioElement) {
    const typeText = $(this).text().trim()
    if (typeText && typeText !== 'Héros') {
      // Ne pas ajouter "Héros" comme sous-type ici
      subTypes.push(typeText)
    }
  })

  // Extension
  let extensionName = 'N/A'
  let extensionNumber = 'N/A'
  $('div').each(function (this: CheerioElement) {
    const text = $(this).text().trim()
    if (text.startsWith('Extension :')) {
      const match = text.match(/Extension : (.*?) (\d+\/\d+)/)
      if (match) {
        extensionName = match[1].trim()
        extensionNumber = match[2].trim()
      } else {
        // Fallback si le numéro n'est pas présent
        extensionName = text.replace('Extension :', '').trim()
      }
      return false // Stop iterating
    }
  })

  // Rareté
  let rarity: CardRarity = 'Commune' // Valeur par défaut
  $('div').each(function (this: CheerioElement) {
    const text = $(this).text().trim()
    if (text.startsWith('Rareté :')) {
      rarity = text.replace('Rareté :', '').trim() as CardRarity
      return false // Stop iterating
    }
  })

  // Niveau et son élément (si applicable)
  let level: ElementalStat = { ...DEFAULT_STATS.niveau }
  $('div.col-auto.text-center.flex-grow-1.my-1').each(
    function (this: CheerioElement) {
      const img = $(this).find('img[src*="niv.png"]')
      if (img.length > 0) {
        const value = parseInt($(this).find('div').last().text().trim(), 10)
        const element = parseElementFromImg($ || cheerio.load(''), img[0])
        if (!isNaN(value)) {
          level = { value, element }
        }
        return false
      }
    }
  )

  // Image URL
  const imageUrl = $('img.card-img-top.img-fluid.w-100').attr('src') || ''

  return {
    id: '', // L'ID sera généré plus tard
    name: cardName,
    mainType: 'Héros', // Sera déterminé plus précisément par la fonction appelante
    subTypes,
    extension: {
      name: extensionName,
      number: extensionNumber,
      shortUrl: '', // À définir
    },
    rarity,
    level,
    elements: [], // Sera rempli par la fonction appelante
    artists: [], // À extraire si disponible
    imageUrl,
  }
}

export { parseHero, parseBaseCard, loadHtml } 