const sharp = require("sharp");

async function main() {
  // Grayscale first!
  const grayBase = await sharp("./public/images/cards/terra-draft.webp")
    .grayscale()
    .toBuffer();

  const titlePatch = await sharp(grayBase)
    .extract({ left: 340, top: 48, width: 1, height: 44 })
    .resize(250, 44, { fit: "fill" })
    .toBuffer();

  // Extract vertical 1px strip from inside the text box of the grayscaled image
  const textPatch = await sharp(grayBase)
    .extract({ left: 530, top: 835, width: 1, height: 78 })
    .resize(505, 78, { fit: "fill" })
    .toBuffer();

  // SVG font matching Wakfu condensed sans-serif
  const svgText = Buffer.from(`
<svg width="716" height="1000" xmlns="http://www.w3.org/2000/svg">
  <text x="110" y="80" font-family="'Arial Narrow', 'Franklin Gothic Medium', Arial, sans-serif" font-weight="900" font-size="34" fill="#111111" letter-spacing="1">NEUTRO</text>
  <text x="117" y="869" font-family="'Arial Narrow', Arial, sans-serif" font-size="24.5" font-weight="500" fill="#222222">Le Neutro ne peut ni attaquer, ni bloquer.</text>
  <text x="117" y="903" font-family="'Arial Narrow', Arial, sans-serif" font-size="24.5" font-weight="500" fill="#222222">Le Neutro ne peut pas porter d’Équipement.</text>
</svg>`);

  await sharp(grayBase)
    .composite([
      { input: titlePatch, left: 105, top: 48 },
      { input: textPatch, left: 115, top: 835 },
      { input: svgText, left: 0, top: 0 },
    ])
    .webp({ quality: 92 })
    .toFile("./public/images/cards/neutro-draft.webp");

  await sharp("./public/images/cards/neutro-draft.webp")
    .resize(256, 358)
    .webp({ quality: 80 })
    .toFile("./public/images/cards/thumbs/neutro-draft.webp");

  console.log("Neutro draft regenerated perfectly!");
}

main().catch(console.error);
