const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const rawDir = path.join(process.cwd(), 'raw-card-data', 'pages');
const extensions = fs.readdirSync(rawDir);
const panoplies = [];

for (const ext of extensions) {
  const extDir = path.join(rawDir, ext);
  if (!fs.statSync(extDir).isDirectory() || ext === 'regles') continue;
  for (const f of fs.readdirSync(extDir).filter(f => f.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(extDir, f), 'utf-8');
    if (!html.includes('Bonus de la panoplie')) continue;
    const $ = cheerio.load(html);
    const cardName = $('h1').contents().first().text().trim();
    
    // Find panoplie container
    $('div').each((i, element) => {
      const $el = $(element);
      const directText = $el.clone().children().remove().end().text().trim();
      if (directText.startsWith('Bonus de la panoplie')) {
        // Build readable text
        // E.g. "Panoplie Kwak de Glace (3) : +1 en Force, +3 PV, +1 PM, Résistance 1 (Eau)"
        const panTitle = directText.replace(/^Bonus de la\s*/i, '').replace(/\s*:\s*$/, '').trim();
        const bonuses = [];
        
        $el.find('div').each((_, sub) => {
          const t = $(sub).clone().children().remove().end().text().trim();
          if (t.startsWith('Bonus Force :')) bonuses.push(`+${t.replace('Bonus Force :', '').trim()} en Force`);
          if (t.startsWith('Bonus PV :')) bonuses.push(`+${t.replace('Bonus PV :', '').replace('PV', '').trim()} PV`);
          if (t.startsWith('Bonus PM :')) bonuses.push(`+${t.replace('Bonus PM :', '').replace('PM', '').trim()} PM`);
          if (t.startsWith('Bonus PA :')) bonuses.push(`+${t.replace('Bonus PA :', '').replace('PA', '').trim()} PA`);
        });
        
        const keywords = [];
        $el.find('ul li').each((_, li) => {
          keywords.push($(li).text().replace(/\s+/g, ' ').trim());
        });
        
        const allParts = [...bonuses, ...keywords];
        const formatted = `${panTitle} : ${allParts.join(', ')}.`;
        panoplies.push({ card: cardName, file: f, extension: ext, text: formatted });
      }
    });
  }
}

console.log('Total extracted panoplies:', panoplies.length);
panoplies.slice(0, 10).forEach(p => console.log('-', p.card, '=>', p.text));
