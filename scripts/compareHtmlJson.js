const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const rawDir = path.join(process.cwd(), 'raw-card-data', 'pages');
const dataDir = path.join(process.cwd(), 'public', 'data');
const extensions = fs.readdirSync(rawDir);

// Map json cards by id
const jsonCards = new Map();
for (const f of fs.readdirSync(dataDir)) {
  if (!f.endsWith('.json') || ['collection.json', 'failed_downloads.json', 'community-decks.json', 'deck_iop.json'].includes(f)) continue;
  const cards = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf-8'));
  if (Array.isArray(cards)) {
    for (const c of cards) {
      jsonCards.set(c.id, { file: f, card: c });
    }
  }
}

let totalDiffs = 0;
const diffList = [];

for (const ext of extensions) {
  const extDir = path.join(rawDir, ext);
  if (!fs.statSync(extDir).isDirectory() || ext === 'regles') continue;
  const files = fs.readdirSync(extDir).filter(f => f.endsWith('.html'));
  for (const f of files) {
    const cardSlug = f.replace('.html', '');
    const cardId = `${cardSlug}-${ext}`;
    const jsonEntry = jsonCards.get(cardId);
    if (!jsonEntry) continue;
    
    const html = fs.readFileSync(path.join(extDir, f), 'utf-8');
    const $ = cheerio.load(html);
    
    // Check Panoplie
    const hasPanoplieHtml = html.includes('Bonus de la panoplie');
    const hasPanoplieJson = (jsonEntry.card.effects || []).some(e => e.description && e.description.includes('Panoplie'));
    
    // Check Effects count
    const effectsHtml = [];
    $('div:contains("Effets :") ul li').each((_, el) => {
      effectsHtml.push($(el).text().trim());
    });
    
    const diffs = [];
    if (hasPanoplieHtml && !hasPanoplieJson) {
      diffs.push('Missing Panoplie in JSON');
    }
    
    if (diffs.length > 0) {
      totalDiffs++;
      diffList.push({
        id: cardId,
        name: jsonEntry.card.name,
        file: jsonEntry.file,
        diffs
      });
    }
  }
}

console.log('Total cards with missing panoplies:', totalDiffs);
console.log('Sample:', JSON.stringify(diffList.slice(0, 10), null, 2));
