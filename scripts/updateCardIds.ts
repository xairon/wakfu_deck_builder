import { promises as fs } from 'fs'
import path from 'path'
import { glob } from 'glob'

interface Card {
  id: string
  name: string
  mainType: string
  extension: {
    name: string
    number?: string
    shortUrl?: string
  }
}

function getExtensionSlug(extensionName: string): string {
  const extensionMap: { [key: string]: string } = {
    Incarnam: 'incarnam',
    'Bonta & Brâkmar': 'bonta-brakmar',
    'Île des Wabbits': 'ile-des-wabbits',
    "Chaos d'Ogrest": 'chaos-dogrest',
    'Dofus Collection': 'dofus-collection',
    'Ankama Convention #5': 'ankama-convention-5',
    Amakna: 'amakna',
    Astrub: 'astrub',
    Otomaï: 'otomai',
    Pandala: 'pandala',
  }

  return (
    extensionMap[extensionName] ||
    extensionName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  )
}

async function updateCardIds() {
  try {
    console.log('🔍 Lecture des fichiers JSON...')
    const jsonFiles = await glob('data/*.json')
    const imagesDir = path.join('data', 'images')
    const imageRenames: Array<{ old: string; new: string }> = []
    const updatedFiles: string[] = []

    // Lire tous les fichiers d'images existants
    console.log('📝 Lecture des fichiers images...')
    const existingImages = await fs.readdir(imagesDir)

    for (const jsonFile of jsonFiles) {
      if (jsonFile.includes('failed_downloads')) continue

      console.log(`📖 Lecture de ${jsonFile}...`)
      const content = await fs.readFile(jsonFile, 'utf-8')
      const cards: Card[] = JSON.parse(content)
      const extension = path.basename(jsonFile, '.json')
      let hasChanges = false

      // Mettre à jour les IDs des cartes
      cards.forEach((card) => {
        const extensionSlug = getExtensionSlug(card.extension.name)
        const oldId = card.id
        const newId = `${oldId}-${extensionSlug}`

        if (oldId !== newId) {
          // Mettre à jour l'ID de la carte
          card.id = newId
          hasChanges = true

          // Ajouter les renommages d'images nécessaires
          if (card.mainType === 'Héros') {
            const oldRecto = `${oldId}_recto.png`
            const oldVerso = `${oldId}_verso.png`
            const newRecto = `${newId}_recto.png`
            const newVerso = `${newId}_verso.png`

            if (existingImages.includes(oldRecto)) {
              imageRenames.push({ old: oldRecto, new: newRecto })
            }
            if (existingImages.includes(oldVerso)) {
              imageRenames.push({ old: oldVerso, new: newVerso })
            }
          } else {
            const oldImage = `${oldId}.png`
            const newImage = `${newId}.png`

            if (existingImages.includes(oldImage)) {
              imageRenames.push({ old: oldImage, new: newImage })
            }
          }
        }
      })

      if (hasChanges) {
        // Sauvegarder le fichier JSON mis à jour
        const updatedContent = JSON.stringify(cards, null, 2)
        await fs.writeFile(jsonFile, updatedContent, 'utf-8')
        updatedFiles.push(jsonFile)
        console.log(`✅ Fichier mis à jour : ${jsonFile}`)
      }
    }

    // Renommer les fichiers d'images
    console.log("\n🔄 Renommage des fichiers d'images...")
    for (const rename of imageRenames) {
      const oldPath = path.join(imagesDir, rename.old)
      const newPath = path.join(imagesDir, rename.new)

      try {
        await fs.rename(oldPath, newPath)
        console.log(`✅ Renommé : ${rename.old} -> ${rename.new}`)
      } catch (error) {
        console.error(`❌ Erreur lors du renommage de ${rename.old}:`, error)
      }
    }

    // Rapport final
    console.log('\n📊 Rapport final :')
    console.log(`📝 Fichiers JSON mis à jour : ${updatedFiles.length}`)
    console.log(`🖼️ Images renommées : ${imageRenames.length}`)

    if (updatedFiles.length > 0) {
      console.log('\nFichiers JSON mis à jour :')
      updatedFiles.forEach((file) => console.log(`   ${file}`))
    }
  } catch (error) {
    console.error('❌ Erreur fatale:', error)
  }
}

updateCardIds()
