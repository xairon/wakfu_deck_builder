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

const report = {
  panopliesMissing: [],
  effectsMissing: [],
  statsMissing: []
};

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

    // 1. Panoplie
    if (html.includes('Bonus de la panoplie')) {
      const hasPanoplieInEffects = (jsonEntry.card.effects || []).some(e => e.description && e.description.includes('Panoplie'));
      if (!hasPanoplieInEffects) {
        // Extract panoplie title
        let pTitle = '';
        $('div').each((_, el) => {
          const t = $(el).clone().children().remove().end().text().trim();
          if (t.startsWith('Bonus de la panoplie')) {
            pTitle = t.replace(' :', '').replace('Bonus de la ', '');
          }
        });
        report.panopliesMissing.push({
          id: cardId,
          name: jsonEntry.card.name,
          extension: ext,
          panoplie: pTitle
        });
      }
    }

    // 2. Stats (PV / PA / PM)
    const textAll = $('.hstack.gap-3').text();
    const hasPvHtml = textAll.includes('PV :');
    const hasPaHtml = textAll.includes('PA :');
    const hasPmHtml = textAll.includes('PM :');
    const statsJson = jsonEntry.card.stats || {};

    if (hasPvHtml && statsJson.pv === undefined) {
      const match = textAll.match(/PV\s*:\s*([+-]?\d+)/);
      report.statsMissing.push({ id: cardId, name: jsonEntry.card.name, stat: 'pv', expected: match ? match[1] : 'found in HTML' });
    }
    if (hasPaHtml && statsJson.pa === undefined) {
      const match = textAll.match(/PA\s*:\s*([+-]?\d+)/);
      report.statsMissing.push({ id: cardId, name: jsonEntry.card.name, stat: 'pa', expected: match ? match[1] : 'found in HTML' });
    }
    if (hasPmHtml && statsJson.pm === undefined) {
      const match = textAll.match(/PM\s*:\s*([+-]?\d+)/);
      report.statsMissing.push({ id: cardId, name: jsonEntry.card.name, stat: 'pm', expected: match ? match[1] : 'found in HTML' });
    }

    // 3. Effects in HTML vs JSON
    const effectsHtml = [];
    $('div:contains("Effets :") ul li').each((_, el) => {
      const txt = $(el).text().trim();
      if (txt) effectsHtml.push(txt);
    });

    const effectsJson = (jsonEntry.card.effects || []).map(e => e.description);
    if (effectsHtml.length > effectsJson.length) {
      report.effectsMissing.push({
        id: cardId,
        name: jsonEntry.card.name,
        htmlCount: effectsHtml.length,
        jsonCount: effectsJson.length,
        effectsHtml,
        effectsJson
      });
    }
  }
}

console.log('=== AUDIT RAW HTML vs JSON ===');
console.log('Panoplies missing in JSON:', report.panopliesMissing.length);
console.log('Stats missing in JSON:', report.statsMissing.length);
console.log('Effects missing in JSON:', report.effectsMissing.length);
if (report.statsMissing.length > 0) {
  console.log('Stats missing sample:', JSON.stringify(report.statsMissing.slice(0, 10), null, 2));
}
if (report.effectsMissing.length > 0) {
  console.log('Effects missing sample:', JSON.stringify(report.effectsMissing.slice(0, 5), null, 2));
}
