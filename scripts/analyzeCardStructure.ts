import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface FieldStats {
    count: number;
    types: Set<string>;
    values: Set<string>;
    examples: string[];
    maxExamples: number;
}

interface CardStructureAnalysis {
    totalCards: number;
    mainTypes: Set<string>;
    subTypes: Set<string>;
    fields: Map<string, FieldStats>;
    elementTypes: Set<string>;
    keywordTypes: Set<string>;
    effectPatterns: Set<string>;
    statsPatterns: Set<string>;
}

function initFieldStats(maxExamples: number = 3): FieldStats {
    return {
        count: 0,
        types: new Set<string>(),
        values: new Set<string>(),
        examples: [],
        maxExamples
    };
}

function updateFieldStats(stats: FieldStats, value: any) {
    stats.count++;
    stats.types.add(typeof value);
    if (typeof value === 'string') {
        stats.values.add(value);
    }
    if (stats.examples.length < stats.maxExamples) {
        stats.examples.push(JSON.stringify(value));
    }
}

function analyzeCardPage(filePath: string, analysis: CardStructureAnalysis): void {
    const html = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(html);

    // Extraire le type principal et les sous-types
    const mainType = $('h1 small.text-muted').text().trim();
    analysis.mainTypes.add(mainType);

    // Analyser les sous-types
    $('.hstack.gap-3').first().find('div').each((_, el) => {
        const subType = $(el).text().trim();
        if (subType !== mainType) {
            analysis.subTypes.add(subType);
        }
    });

    // Analyser les éléments
    $('.symbole-ressource').each((_, el) => {
        const elementClass = $(el).attr('class')?.match(/symbole-ressource-(\w+)/)?.[1];
        if (elementClass) {
            analysis.elementTypes.add(elementClass);
        }
    });

    // Analyser les mots-clés
    if ($('div:contains("Mots Clefs :")').length > 0) {
        $('div:contains("Mots Clefs :") ul li').each((_, el) => {
            const keyword = $(el).text().trim().split(':')[0].trim();
            analysis.keywordTypes.add(keyword);
        });
    }

    // Analyser les effets
    if ($('div:contains("Effets :")').length > 0) {
        $('div:contains("Effets :") ul li').each((_, el) => {
            const effect = $(el).text().trim();
            // Extraire les patterns d'effets (coûts, conditions, etc.)
            const costPattern = effect.match(/^([^:]+):/);
            if (costPattern) {
                analysis.effectPatterns.add('Cost: ' + costPattern[1]);
            }
            if (effect.includes('une fois par tour')) {
                analysis.effectPatterns.add('Once per turn restriction');
            }
        });
    }

    // Analyser les statistiques
    $('.hstack.gap-3').eq(1).find('div').each((_, el) => {
        const statText = $(el).text().trim();
        if (statText.includes('Niveau')) {
            analysis.statsPatterns.add('Level with element');
        }
        if (statText.includes('Force')) {
            analysis.statsPatterns.add('Force with element');
        }
        if (statText.match(/PA|PM|PV/)) {
            analysis.statsPatterns.add('Basic stats (PA/PM/PV)');
        }
    });

    // Incrémenter le compteur total de cartes
    analysis.totalCards++;
}

async function analyzeAllCards(): Promise<void> {
    const analysis: CardStructureAnalysis = {
        totalCards: 0,
        mainTypes: new Set<string>(),
        subTypes: new Set<string>(),
        fields: new Map<string, FieldStats>(),
        elementTypes: new Set<string>(),
        keywordTypes: new Set<string>(),
        effectPatterns: new Set<string>(),
        statsPatterns: new Set<string>()
    };

    const pagesDir = path.join(__dirname, '..', 'pages');
    const extensions = fs.readdirSync(pagesDir);

    for (const extension of extensions) {
        const extensionDir = path.join(pagesDir, extension);
        if (fs.statSync(extensionDir).isDirectory()) {
            console.log(`\nAnalyse de l'extension ${extension}...`);
            const cards = fs.readdirSync(extensionDir)
                .filter(file => file.endsWith('.html'));

            for (const card of cards) {
                const cardPath = path.join(extensionDir, card);
                analyzeCardPage(cardPath, analysis);
            }
        }
    }

    // Générer le rapport d'analyse
    const report = {
        totalCards: analysis.totalCards,
        mainTypes: Array.from(analysis.mainTypes),
        subTypes: Array.from(analysis.subTypes),
        elements: Array.from(analysis.elementTypes),
        keywords: Array.from(analysis.keywordTypes),
        effectPatterns: Array.from(analysis.effectPatterns),
        statsPatterns: Array.from(analysis.statsPatterns)
    };

    // Sauvegarder le rapport
    const outputPath = path.join(__dirname, '..', 'analysis', 'card_types_analysis.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

    console.log('\nAnalyse terminée !');
    console.log(`Nombre total de cartes analysées : ${analysis.totalCards}`);
    console.log(`Types principaux trouvés : ${Array.from(analysis.mainTypes).join(', ')}`);
    console.log(`Rapport complet sauvegardé dans ${outputPath}`);
}

// Exécution de l'analyse
analyzeAllCards().catch(console.error); 