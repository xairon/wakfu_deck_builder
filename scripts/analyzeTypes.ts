import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import * as cheerio from 'cheerio'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface TypeAnalysis {
  mainType: string
  subTypes: Set<string>
  characteristics: Set<string>
  stats: Set<string>
  effects: Set<string>
  keywords: Set<string>
  requirements: Set<string>
  otherFields: Set<string>
  examples: string[]
  count: number
}

interface DetailedAnalysis {
  [key: string]: TypeAnalysis
}

function initTypeAnalysis(): TypeAnalysis {
  return {
    mainType: '',
    subTypes: new Set<string>(),
    characteristics: new Set<string>(),
    stats: new Set<string>(),
    effects: new Set<string>(),
    keywords: new Set<string>(),
    requirements: new Set<string>(),
    otherFields: new Set<string>(),
    examples: [],
    count: 0,
  }
}

function analyzeCardPage(filePath: string, analysis: DetailedAnalysis): void {
  try {
    const html = fs.readFileSync(filePath, 'utf-8')
    const $ = cheerio.load(html)

    // Extraire le type principal
    const mainType = $('h1 small.text-muted').text().trim()
    if (!analysis[mainType]) {
      analysis[mainType] = initTypeAnalysis()
      analysis[mainType].mainType = mainType
    }

    analysis[mainType].count++
    if (analysis[mainType].examples.length < 3) {
      analysis[mainType].examples.push(filePath)
    }

    // Extraire les sous-types
    $('.hstack.gap-3')
      .first()
      .find('div')
      .each((_, el) => {
        const subType = $(el).text().trim()
        if (subType !== mainType) {
          analysis[mainType].subTypes.add(subType)
        }
      })

    // Analyser les caractéristiques
    $('.row .hstack.gap-3').each((_, container) => {
      $(container)
        .find('div')
        .each((_, el) => {
          const text = $(el).text().trim()

          // Analyser les statistiques
          if (text.match(/PA|PM|PV|Force|Niveau/)) {
            analysis[mainType].stats.add(text.split(':')[0].trim())
          }

          // Analyser les éléments
          $('.symbole-ressource').each((_, el) => {
            const elementClass = $(el)
              .attr('class')
              ?.match(/symbole-ressource-(\w+)/)?.[1]
            if (elementClass) {
              analysis[mainType].characteristics.add(`Element: ${elementClass}`)
            }
          })
        })
    })

    // Analyser les effets
    if ($('div:contains("Effets :")').length > 0) {
      $('div:contains("Effets :") ul li').each((_, el) => {
        const effect = $(el).text().trim()
        if (effect.includes('une fois par tour')) {
          analysis[mainType].characteristics.add('Has once per turn effects')
        }
        if (effect.match(/^([^:]+):/)) {
          analysis[mainType].characteristics.add('Has cost effects')
        }
        analysis[mainType].effects.add(effect)
      })
    }

    // Analyser les mots-clés
    if ($('div:contains("Mots Clefs :")').length > 0) {
      analysis[mainType].characteristics.add('Has keywords')
      $('div:contains("Mots Clefs :") ul li').each((_, el) => {
        const keyword = $(el).text().trim()
        analysis[mainType].keywords.add(keyword)
      })
    }

    // Analyser les exigences spécifiques
    $('div').each((_, el) => {
      const text = $(el).text().trim()

      // Expérience
      if (text.startsWith('Expérience :')) {
        analysis[mainType].characteristics.add('Has experience')
      }

      // Ambiance
      if (text.startsWith('Ambiance :')) {
        analysis[mainType].characteristics.add('Has flavor text')
      }

      // Notes
      if (text.startsWith('Notes :')) {
        analysis[mainType].characteristics.add('Has notes')
      }

      // Artistes
      if (text.startsWith('Artistes :')) {
        analysis[mainType].characteristics.add('Has artists')
      }

      // Extension et numéro
      if (text.startsWith('Extension :')) {
        const extensionMatch = text.match(/(\d+)\/(\d+)/)
        if (extensionMatch) {
          analysis[mainType].characteristics.add('Has card number')
        }
      }
    })

    // Analyser les autres champs spécifiques au type
    switch (mainType) {
      case 'Équipement':
        // Vérifier les restrictions d'équipement
        $('div').each((_, el) => {
          const text = $(el).text().trim()
          if (
            text.includes('Niveau requis') ||
            text.includes('Métier requis')
          ) {
            analysis[mainType].requirements.add(text)
          }
        })
        break

      case 'Héros':
        // Vérifier les spécialisations et alignements
        $('div').each((_, el) => {
          const text = $(el).text().trim()
          if (text.includes('Spécialisation') || text.includes('Alignement')) {
            analysis[mainType].characteristics.add(text.split(':')[0].trim())
          }
        })
        break

      // Ajouter d'autres cas spécifiques selon les types
    }
  } catch (error) {
    console.error(`Erreur lors de l'analyse de ${filePath}:`, error)
  }
}

async function analyzeAllTypes(): Promise<void> {
  const analysis: DetailedAnalysis = {}
  const pagesDir = path.join(__dirname, '..', 'pages')
  const extensions = fs.readdirSync(pagesDir)

  for (const extension of extensions) {
    const extensionDir = path.join(pagesDir, extension)
    if (fs.statSync(extensionDir).isDirectory()) {
      console.log(`\nAnalyse de l'extension ${extension}...`)
      const cards = fs
        .readdirSync(extensionDir)
        .filter((file) => file.endsWith('.html'))

      for (const card of cards) {
        const cardPath = path.join(extensionDir, card)
        analyzeCardPage(cardPath, analysis)
      }
    }
  }

  // Générer le rapport détaillé
  const report = Object.entries(analysis).map(([type, data]) => ({
    mainType: type,
    count: data.count,
    subTypes: Array.from(data.subTypes),
    characteristics: Array.from(data.characteristics),
    stats: Array.from(data.stats),
    keywords: Array.from(data.keywords),
    requirements: Array.from(data.requirements),
    examples: data.examples,
  }))

  // Sauvegarder le rapport
  const outputPath = path.join(
    __dirname,
    '..',
    'analysis',
    'types_analysis.json'
  )
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2))

  // Afficher un résumé
  console.log('\nAnalyse des types terminée !')
  console.log('\nRésumé par type principal :')
  for (const [type, data] of Object.entries(analysis)) {
    console.log(`\n${type}:`)
    console.log(`  Nombre de cartes: ${data.count}`)
    console.log(`  Sous-types: ${Array.from(data.subTypes).length}`)
    console.log(
      `  Caractéristiques uniques: ${Array.from(data.characteristics).length}`
    )
  }

  // Générer des exemples HTML pour chaque type
  const examplesDir = path.join(__dirname, '..', 'analysis', 'examples')
  fs.mkdirSync(examplesDir, { recursive: true })

  for (const [type, data] of Object.entries(analysis)) {
    if (data.examples.length > 0) {
      const examplePath = path.join(
        examplesDir,
        `${type.toLowerCase().replace(/\s+/g, '_')}_example.html`
      )
      const exampleHtml = fs.readFileSync(data.examples[0], 'utf-8')
      fs.writeFileSync(examplePath, exampleHtml)
    }
  }

  console.log(`\nRapport complet sauvegardé dans ${outputPath}`)
  console.log(`Exemples HTML sauvegardés dans ${examplesDir}`)
}

// Exécution de l'analyse
analyzeAllTypes().catch(console.error)
