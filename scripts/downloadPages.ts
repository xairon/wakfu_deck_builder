import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pLimit from 'p-limit';
import { cpus } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Nombre de cœurs disponibles
const NUM_CPUS = cpus().length;
// Nombre maximum de requêtes simultanées (2 par cœur)
const MAX_CONCURRENT_REQUESTS = NUM_CPUS * 2;
// Délai minimum entre chaque requête par worker (en ms)
const MIN_REQUEST_DELAY = 200;

interface Card {
    url: string;
    name: string;
    extension: string;
    type?: string;
}

async function loadAllCards(): Promise<Card[]> {
    const cardsDir = path.join(__dirname, '..', 'cartes');
    const files = fs.readdirSync(cardsDir)
        .filter(file => file.endsWith('_cards.json'));
    
    const allCards: Card[] = [];
    
    for (const file of files) {
        try {
            const content = fs.readFileSync(path.join(cardsDir, file), 'utf-8');
            const cards = JSON.parse(content) as Card[];
            allCards.push(...cards);
        } catch (error) {
            console.error(`Erreur lors de la lecture de ${file}:`, error);
        }
    }
    
    return allCards;
}

async function downloadPage(card: Card, isVerso: boolean = false): Promise<void> {
    try {
        // Extraire l'URL relative de l'URL complète
        const urlParts = new URL(card.url);
        let relativePath = urlParts.pathname;
        
        // Si c'est un héros et qu'on veut le verso, modifier l'URL
        if (card.type === 'Héros' && isVerso) {
            relativePath = relativePath.replace(/(\d+)$/, '$1-2');
            urlParts.pathname = relativePath;
        }
        
        // Créer le dossier de l'extension s'il n'existe pas
        const extensionName = card.extension.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Enlever les accents
            .replace(/[^a-z0-9]+/g, '-');
        const outputDir = path.join(__dirname, '..', 'pages', extensionName);
        fs.mkdirSync(outputDir, { recursive: true });
        
        // Créer un nom de fichier sécurisé
        const safeName = card.name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
            
        // Ajouter le suffixe -2 pour le verso des héros
        const outputPath = path.join(outputDir, `${safeName}${isVerso ? '-2' : ''}.html`);
        
        // Vérifier si le fichier existe déjà
        if (fs.existsSync(outputPath)) {
            console.log(`Page déjà existante: ${outputPath}`);
            return;
        }
        
        // Télécharger la page
        console.log(`Téléchargement de ${urlParts.href}...`);
        const response = await axios.get(urlParts.href);
        const html = response.data;
        
        // Sauvegarder la page
        fs.writeFileSync(outputPath, html, 'utf-8');
        console.log(`Page sauvegardée: ${outputPath}`);
        
        // Attendre un peu pour ne pas surcharger le serveur
        await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_DELAY));
        
    } catch (error) {
        console.error(`Erreur lors du téléchargement de ${card.url}:`, error);
    }
}

async function processExtension(extension: string, cards: Card[]): Promise<void> {
    console.log(`\nTraitement de l'extension ${extension} (${cards.length} cartes)...`);
    
    // Créer un limiteur de concurrence pour cette extension
    const limit = pLimit(MAX_CONCURRENT_REQUESTS);
    
    // Créer un tableau de promesses pour tous les téléchargements
    const downloadPromises = cards.map((card, index) => {
        return limit(async () => {
            console.log(`[${index + 1}/${cards.length}] Traitement de ${card.name}...`);
            
            // Télécharger le recto
            await downloadPage(card, false);
            
            // Si c'est un héros, télécharger aussi le verso
            if (card.type === 'Héros') {
                console.log(`Téléchargement du verso pour ${card.name}...`);
                await downloadPage(card, true);
            }
        });
    });
    
    // Attendre que tous les téléchargements soient terminés
    await Promise.all(downloadPromises);
}

async function downloadAllPages() {
    console.log(`Configuration: ${NUM_CPUS} cœurs détectés, ${MAX_CONCURRENT_REQUESTS} requêtes simultanées maximum`);
    console.log("Chargement des cartes depuis les fichiers JSON...");
    
    const cards = await loadAllCards();
    console.log(`${cards.length} cartes trouvées au total.`);
    
    // Créer le dossier pages s'il n'existe pas
    const pagesDir = path.join(__dirname, '..', 'pages');
    fs.mkdirSync(pagesDir, { recursive: true });
    
    // Grouper les cartes par extension
    const cardsByExtension = cards.reduce((acc, card) => {
        const ext = card.extension.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-');
        if (!acc[ext]) acc[ext] = [];
        acc[ext].push(card);
        return acc;
    }, {} as Record<string, Card[]>);
    
    // Traiter chaque extension séquentiellement, mais avec des téléchargements parallèles à l'intérieur
    for (const [extension, extensionCards] of Object.entries(cardsByExtension)) {
        await processExtension(extension, extensionCards);
    }
    
    console.log("\nTéléchargement terminé !");
}

// Exécution du script
downloadAllPages().catch(console.error); 