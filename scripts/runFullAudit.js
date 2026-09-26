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

const audit = {
  equipmentsWithPanoplieMissingInJson: [],
  equipmentsWithStatsDiff: [],
  effectsTruncatedOrMissing: [],
  totalHtmlProcessed: 0
};

for (const ext of extensions) {
  const extDir = path.join(rawDir, ext);
  if (!fs.statSync(extDir).isDirectory() || ext === 'regles') continue;
  const files = fs.readdirSync(extDir).filter(f => f.endsWith('.html'));
  
  for (const f of files) {
    audit.totalHtmlProcessed++;
    const cardSlug = f.replace('.html', '');
    const cardId = `${cardSlug}-${ext}`;
    const jsonEntry = jsonCards.get(cardId);
    if (!jsonEntry) continue;
    
    const card = jsonEntry.card;
    const html = fs.readFileSync(path.join(extDir, f), 'utf-8');
    const $ = cheerio.load(html);
    
    // 1. Panoplie
    if (html.includes('Bonus de la panoplie')) {
      const hasPanoplieInEffects = (card.effects || []).some(e => e.description && /panoplie/i.test(e.description));
      if (!hasPanoplieInEffects) {
        // Extract panoplie details
        let panText = '';
        $('div').each((_, el) => {
          const $el = $(el);
          const t = $el.clone().children().remove().end().text().trim();
          if (t.startsWith('Bonus de la panoplie')) {
            const title = t.replace(/^Bonus de la\s*/i, '').replace(/\s*:\s*$/, '').trim();
            const bonuses = [];
            $el.find('div').each((_, sub) => {
              const subT = $(sub).clone().children().remove().end().text().trim();
              if (subT.startsWith('Bonus Force :')) bonuses.push(`+${subT.replace('Bonus Force :', '').trim()} Force`);
              if (subT.startsWith('Bonus PV :')) bonuses.push(`+${subT.replace('Bonus PV :', '').replace('PV', '').trim()} PV`);
              if (subT.startsWith('Bonus PM :')) bonuses.push(`+${subT.replace('Bonus PM :', '').replace('PM', '').trim()} PM`);
              if (subT.startsWith('Bonus PA :')) bonuses.push(`+${subT.replace('Bonus PA :', '').replace('PA', '').trim()} PA`);
              if (subT.startsWith('Effet :')) bonuses.push(subT.replace('Effet :', '').trim());
            });
            $el.find('ul li').each((_, li) => {
              bonuses.push($(li).text().replace(/\s+/g, ' ').trim());
            });
            panText = `${title} : ${bonuses.join(', ')}`;
          }
        });
        audit.equipmentsWithPanoplieMissingInJson.push({
          id: cardId,
          name: card.name,
          extension: ext,
          panoplieDetails: panText
        });
      }
    }
    
    // 2. Stats
    const statsText = $('.hstack.gap-3').text();
    const statsJson = card.stats || {};
    
    const extractStat = (name) => {
      const m = statsText.match(new RegExp(`${name}\\s*:\\s*([+-]?\\d+)`));
      return m ? parseInt(m[1]) : undefined;
    };
    
    const paHtml = extractStat('PA');
    const pmHtml = extractStat('PM');
    const pvHtml = extractStat('PV');
    
    const statDiffs = {};
    if (paHtml !== undefined && statsJson.pa !== paHtml) statDiffs.pa = { html: paHtml, json: statsJson.pa };
    if (pmHtml !== undefined && statsJson.pm !== pmHtml) statDiffs.pm = { html: pmHtml, json: statsJson.pm };
    if (pvHtml !== undefined && statsJson.pv !== pvHtml) statDiffs.pv = { html: pvHtml, json: statsJson.pv };
    
    if (Object.keys(statDiffs).length > 0) {
      audit.equipmentsWithStatsDiff.push({
        id: cardId,
        name: card.name,
        extension: ext,
        diffs: statDiffs
      });
    }
    
    // 3. Effects text differences
    const effectsHtml = [];
    $('div:contains("Effets :") ul li').each((_, el) => {
      // Don't include keywords that leaked into effects
      const txt = $(el).text().replace(/\s+/g, ' ').trim();
      if (txt && !txt.startsWith('Recette :') && !txt.startsWith('Résistance ')) {
        effectsHtml.push(txt);
      }
    });
    
    const effectsJson = (card.effects || [])
      .filter(e => !e.kind) // ignore ruling/errata
      .map(e => e.description.replace(/\s+/g, ' ').trim());
      
    // Compare
    for (const eff of effectsHtml) {
      const cleanEff = eff.replace(/^,\s*:\s*/, '').replace(/^:\s*/, '').trim();
      const match = effectsJson.some(ej => ej.includes(cleanEff) || cleanEff.includes(ej));
      if (!match) {
        audit.effectsTruncatedOrMissing.push({
          id: cardId,
          name: card.name,
          extension: ext,
          htmlEffect: cleanEff
        });
      }
    }
  }
}

console.log('=== RAPPORT AUDIT HTML vs JSON ===');
console.log('Total cartes traitées:', audit.totalHtmlProcessed);
console.log('1. Équipements avec bonus de Panoplie manquant dans le JSON:', audit.equipmentsWithPanoplieMissingInJson.length);
console.log('2. Cartes avec différence de stats PA/PM/PV (HTML vs JSON):', audit.equipmentsWithStatsDiff.length);
console.log('3. Effets de carte tronqués ou manquants:', audit.effectsTruncatedOrMissing.length);

if (audit.equipmentsWithStatsDiff.length > 0) {
  console.log('\n--- Différences de stats (PA/PM/PV) ---');
  console.log(JSON.stringify(audit.equipmentsWithStatsDiff, null, 2));
}

console.log('\n--- Échantillon Panoplies manquantes (5 premières) ---');
console.log(JSON.stringify(audit.equipmentsWithPanoplieMissingInJson.slice(0, 5), null, 2));

console.log('\n--- Échantillon Effets manquants/divergents (5 premiers) ---');
console.log(JSON.stringify(audit.effectsTruncatedOrMissing.slice(0, 5), null, 2));
