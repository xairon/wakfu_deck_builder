import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'
import sharp from 'sharp'

// Charger tous les fichiers JSON
const dataDir = path.resolve(__dirname, '../data')
const outputDir = path.resolve(__dirname, '../public/images/cards')

// Créer le dossier de sortie s'il n'existe pas
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

interface Card {
  id: string
  name: string
  extension: {
    name: string
    shortUrl: string
  }
  imageUrl?: string
}

async function downloadImage(url: string, outputPath: string) {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const buffer = await response.buffer()
    
    // Convertir en WebP avec sharp
    await sharp(buffer)
      .webp({ quality: 80 })
      .toFile(outputPath)
    
    console.log(`✅ Image téléchargée: ${outputPath}`)
    return true
  } catch (error) {
    console.error(`❌ Erreur lors du téléchargement de ${url}:`, error)
    return false
  }
}

async function processCards() {
  const failedDownloads: string[] = []
  const processedUrls = new Set<string>()

  // Lire tous les fichiers JSON dans le dossier data
  const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.json'))
  
  for (const file of files) {
    const content = fs.readFileSync(path.join(dataDir, file), 'utf-8')
    const cards: Card[] = JSON.parse(content)
    
    for (const card of cards) {
      if (!card.imageUrl || processedUrls.has(card.imageUrl)) continue
      
      const outputPath = path.join(
        outputDir,
        `${card.id}-${card.extension.name.toLowerCase().replace(/\s+/g, '-')}.webp`
      )
      
      if (fs.existsSync(outputPath)) {
        console.log(`⏭️ Image déjà existante: ${outputPath}`)
        continue
      }
      
      processedUrls.add(card.imageUrl)
      const success = await downloadImage(card.imageUrl, outputPath)
      
      if (!success) {
        failedDownloads.push(`${card.name} (${card.id}): ${card.imageUrl}`)
      }
      
      // Petite pause pour ne pas surcharger le serveur
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  
  // Sauvegarder les téléchargements échoués
  if (failedDownloads.length > 0) {
    fs.writeFileSync(
      path.join(dataDir, 'failed_downloads.json'),
      JSON.stringify(failedDownloads, null, 2)
    )
    console.log(`⚠️ ${failedDownloads.length} téléchargements ont échoué`)
  }
}

processCards().catch(console.error) 