import * as fs from 'fs';
import * as cheerio from 'cheerio';
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
  HeroFace
} from './types/cards';

// Types utilitaires
type CheerioElement = cheerio.Element;
type CheerioSelector = string;
type ElementCallback = (this: CheerioElement, index: number, element: CheerioElement) => boolean;

// Constantes pour les valeurs par défaut
const DEFAULT_ELEMENT: CardElement = 'neutre';
const DEFAULT_STATS: BaseStats = {
  pa: 0,
  pm: 0,
  pv: 0,
  force: { value: 0, element: DEFAULT_ELEMENT },
  niveau: { value: 0, element: DEFAULT_ELEMENT }
} as const;

const DEFAULT_HERO_FACE: HeroFace = {
  stats: DEFAULT_STATS,
  effects: [],
  keywords: [],
  imageUrl: ''
} as const;

function parseEffect(text: string): CardEffect {
  return {
    description: text,
    isOncePerTurn: text.toLowerCase().includes('une fois par tour'),
    requiresIncline: text.includes('Incliner')
  };
}

function extractEffects($: cheerio.CheerioAPI): CardEffect[] {
  return $('div:contains("Effets :")').first().find('ul li')
    .map(function(this: CheerioElement): CardEffect {
      return parseEffect($(this).text().trim());
    })
    .get();
}

function areEffectsIdentical(effects1: CardEffect[], effects2: CardEffect[]): boolean {
  return JSON.stringify(effects1.map(e => e.description)) === 
         JSON.stringify(effects2.map(e => e.description));
}

async function loadHtml(filePath: string): Promise<cheerio.CheerioAPI> {
  try {
    const html = await fs.promises.readFile(filePath, 'utf-8');
    const $ = cheerio.load(html);
    return $ as cheerio.CheerioAPI;
  } catch (error) {
    console.error(`Erreur lors du chargement de ${filePath}:`, error);
    throw error;
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
      shortUrl: ''
    },
    rarity: 'Commune',
    level: {
      value: 0,
      element: DEFAULT_ELEMENT
    },
    elements: [],
    artists: [],
    imageUrl: ''
  };
}

function parseElementFromImg($: cheerio.CheerioAPI, imgElement: CheerioElement): CardElement {
  const elementClass = $(imgElement).attr('class');
  if (!elementClass) return DEFAULT_ELEMENT;

  const elementMatch = elementClass.match(/symbole-ressource-(\w+)/);
  if (!elementMatch) return DEFAULT_ELEMENT;

  const elementValue = elementMatch[1].toLowerCase();
  return isValidCardElement(elementValue) ? elementValue : DEFAULT_ELEMENT;
}

function isValidCardElement(element: string): element is CardElement {
  return ['terre', 'feu', 'eau', 'air', 'neutre'].includes(element);
}

async function parseHero(filePath: string, extension: string): Promise<HeroCard> {
  console.log(`Début du parsing de ${filePath}`);
  const isFirstFace = !filePath.endsWith('-2.html');
  const rectoPath = isFirstFace ? filePath : filePath.replace(/-2\.html$/, '.html');
  const versoPath = isFirstFace ? filePath.replace(/\.html$/, '-2.html') : filePath;

  try {
    const $recto = await loadHtml(rectoPath);
    
    // Extraction du nom avec typage strict
    const cardName = $recto('h1').first().contents().filter(function(this: CheerioElement): boolean {
      return this.type === 'text';
    }).text().trim();

    if (!cardName) {
      throw new Error('Nom de carte non trouvé');
    }

    console.log(`Parsing du héros: ${cardName}`);

    // Extraction des sous-types avec typage strict
    const subTypes = $recto('.hstack.gap-3').first().children('div').map(function(this: CheerioElement): string | null {
      const text = $recto(this).text().trim();
      return text !== 'Héros' ? text : null;
    }).get().filter((type): type is string => type !== null);

    // Extraction de la rareté avec typage strict
    const rarityElement = $recto('div').filter(function(this: CheerioElement): boolean {
      return $recto(this).text().trim().startsWith('Rareté :');
    }).first();
    
    const rarity = (rarityElement.text().trim().split(':')[1]?.trim() || 'Commune') as CardRarity;
    console.log(`Rareté trouvée: ${rarity}`);

    // Extraction de l'extension avec typage strict
    const extensionElement = $recto('div').filter(function(this: CheerioElement): boolean {
      return $recto(this).text().trim().startsWith('Extension :');
    }).first();

    const extensionText = extensionElement.text().trim();
    const extensionMatch = extensionText.match(/Extension : (.+?)(?:\s+(\d+)\/(\d+))?$/);
    const extensionName = extensionMatch ? extensionMatch[1].trim() : extension;
    const extensionNumber = extensionMatch?.[2] ? `${extensionMatch[2]}/${extensionMatch[3]}` : '';
    console.log(`Extension trouvée: ${extensionName} (${extensionNumber})`);

    // Parsing du recto
    console.log('Parsing du recto...');
    const rectoCard = await parseBaseCard(rectoPath);

    // Extraction des stats du recto
    const rectoStats = extractHeroStats($recto);
    console.log('Stats du recto:', rectoStats);

    // Création de la face recto
    const rectoFace: HeroFace = {
      stats: {
        ...rectoStats,
        niveau: rectoCard.level ?? DEFAULT_STATS.niveau,
        force: rectoStats.force ?? DEFAULT_STATS.force
      },
      effects: extractEffects($recto),
      keywords: [],
      imageUrl: rectoCard.imageUrl || ''
    };
    
    let versoFace: HeroFace;
    try {
      console.log('Tentative de parsing du verso...');
      const $verso = await loadHtml(versoPath);
      const versoCard = await parseBaseCard(versoPath);

      // Extraction des stats du verso
      const versoStats = extractHeroStats($verso);
      console.log('Stats du verso:', versoStats);

      // Création de la face verso
      versoFace = {
        stats: {
          ...versoStats,
          niveau: versoCard.level ?? DEFAULT_STATS.niveau,
          force: versoStats.force ?? DEFAULT_STATS.force
        },
        effects: extractEffects($verso),
        keywords: [],
        imageUrl: versoCard.imageUrl || ''
      };

      // Vérification des faces identiques
      const areStatsIdentical = JSON.stringify(rectoStats) === JSON.stringify(versoStats);
      const effectsIdentical = areEffectsIdentical(versoFace.effects, rectoFace.effects);
      
      if (areStatsIdentical && effectsIdentical) {
        console.log('Note: Le verso est identique au recto (stats et effets)');
        versoFace = { ...rectoFace };
      } else {
        if (areStatsIdentical) console.log('Note: Les stats du verso sont identiques au recto');
        if (effectsIdentical) console.log('Note: Les effets du verso sont identiques au recto');
      }
    } catch (error) {
      console.log('Erreur lors du parsing du verso, utilisation du recto comme verso:', error);
      versoFace = { ...rectoFace };
    }

    // S'assurer que level est défini
    const level = rectoCard.level ?? DEFAULT_STATS.niveau;

    const heroCard: HeroCard = {
      id: `${extensionName.toLowerCase()}-${cardName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: cardName,
      mainType: 'Héros',
      subTypes,
      class: subTypes[0] || 'Inconnu',
      extension: {
        name: extensionName,
        number: extensionNumber,
        shortUrl: rectoCard.extension.shortUrl
      },
      rarity,
      level,
      elements: rectoCard.elements,
      imageUrl: rectoCard.imageUrl,
      artists: rectoCard.artists,
      recto: rectoFace,
      verso: versoFace
    };

    console.log(`Héros ${cardName} parsé avec succès`);
    return heroCard;

  } catch (error) {
    console.error(`Erreur lors du parsing du héros ${filePath}:`, error);
    throw error;
  }
}

function extractHeroStats($: cheerio.CheerioAPI): BaseStats {
  const stats: BaseStats = { ...DEFAULT_STATS };
  
  $('.hstack.gap-3').eq(1).find('div').each((_, el) => {
    const text = $(el).text().trim();
    const [statName, value] = text.split(':').map(s => s.trim());
    
    if (statName && value) {
      const numValue = parseInt(value);
      if (!isNaN(numValue)) {
        switch(statName.toLowerCase()) {
          case 'pa':
            stats.pa = numValue;
            break;
          case 'pm':
            stats.pm = numValue;
            break;
          case 'pv':
            stats.pv = numValue;
            break;
        }
      }
    }
  });

  // Extraction du niveau et de la force
  $('.hstack.gap-3').eq(2).find('div').each((_, el) => {
    const text = $(el).text().trim();
    if (text.includes('Niveau')) {
      const levelMatch = text.match(/Niveau\s*:\s*(\d+)/);
      if (levelMatch) {
        const value = parseInt(levelMatch[1]);
        const elementImg = $(el).find('img.symbole-ressource').first();
        const element = elementImg.length > 0 ? parseElementFromImg($, elementImg[0]) : DEFAULT_ELEMENT;
        stats.niveau = { value, element };
      }
    } else if (text.includes('Force')) {
      const forceMatch = text.match(/Force\s*:\s*(\d+)/);
      if (forceMatch) {
        const value = parseInt(forceMatch[1]);
        const elementImg = $(el).find('img.symbole-ressource').first();
        const element = elementImg.length > 0 ? parseElementFromImg($, elementImg[0]) : DEFAULT_ELEMENT;
        stats.force = { value, element };
      }
    }
  });

  return stats;
}

async function parseBaseCard(filePath: string): Promise<BaseCard> {
  const $ = await loadHtml(filePath);
  const baseCard = createBaseCard();

  try {
    baseCard.name = $('h1').first().contents().filter(function(this: CheerioElement): boolean {
      return this.type === 'text';
    }).text().trim();

    baseCard.subTypes = $('.hstack.gap-3').first().find('div').map(function(this: CheerioElement): string {
      return $(this).text().trim();
    }).get().filter(type => type !== 'Héros');

    baseCard.elements = $('.row').find('.symbole-ressource').map(function(this: CheerioElement): CardElement {
      return parseElementFromImg($, this);
    }).get();

    baseCard.imageUrl = $('.round-card').attr('src') || '';

    return baseCard;
  } catch (error) {
    console.error(`Erreur lors du parsing de la carte de base ${filePath}:`, error);
    return baseCard;
  }
}

export {
  parseHero,
  parseBaseCard,
  extractHeroStats,
  parseEffect,
  extractEffects,
  areEffectsIdentical,
  loadHtml,
  parseElementFromImg,
  isValidCardElement,
  DEFAULT_ELEMENT,
  DEFAULT_STATS,
  DEFAULT_HERO_FACE
}; 