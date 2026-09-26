const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const rawDir = path.join(process.cwd(), 'raw-card-data', 'pages');
const extensions = fs.readdirSync(rawDir);
const results = [];

for (const ext of extensions) {
  const extDir = path.join(rawDir, ext);
  if (!fs.statSync(extDir).isDirectory() || ext === 'regles') continue;
  const files = fs.readdirSync(extDir).filter(f => f.endsWith('.html'));
  for (const f of files) {
    const html = fs.readFileSync(path.join(extDir, f), 'utf-8');
    const $ = cheerio.load(html);
    const mainType = $('h1 small.text-muted').text().trim();
    if (mainType !== 'Équipement') continue;
    
    const name = $('h1').contents().first().text().trim();
    const hasPanoplie = html.includes('Bonus de la panoplie');
    
    const textAll = $('.hstack.gap-3').text();
    const hasPv = textAll.includes('PV :');
    const hasPa = textAll.includes('PA :');
    const hasPm = textAll.includes('PM :');
    
    results.push({
      file: f,
      name,
      hasPv,
      hasPa,
      hasPm,
      hasPanoplie
    });
  }
}

console.log('Equipments in HTML:', results.length);
console.log('With PV:', results.filter(r => r.hasPv).length);
console.log('With PA:', results.filter(r => r.hasPa).length);
console.log('With PM:', results.filter(r => r.hasPm).length);
console.log('With Panoplie:', results.filter(r => r.hasPanoplie).length);
console.log('No explicit stats and no panoplie:', results.filter(r => !r.hasPv && !r.hasPa && !r.hasPm && !r.hasPanoplie).length);
