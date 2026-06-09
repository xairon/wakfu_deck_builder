/**
 * Retire le filigrane « Wakfu TCG Return / www.wtcg-return.fr » imprimé
 * verticalement sur le cadre blanc gauche/droit des images `page_card`
 * (358×500) téléchargées depuis wtcg-return.fr, puis agrandit la carte 2×.
 *
 * Le filigrane occupe deux fines bandes verticales situées dans le cadre blanc
 * brillant — entre le bord sombre extérieur et l'illustration. Comme ces bandes
 * ne contiennent que du cadre (aucun pixel d'illustration), on reconstruit
 * chaque ligne par interpolation horizontale entre le cadre propre situé de part
 * et d'autre de la bande. Position fixe (même gabarit sur toutes les cartes).
 *
 * Aucune dépendance hors `sharp` (déjà installé) — npm/npx indisponibles.
 */
const sharp = require("sharp");

// Référence : largeur 358 px. Bandes du filigrane + points d'ancrage « propres ».
// On exprime tout en fractions de largeur pour rester correct si la taille varie.
const REF_W = 358;
const BANDS = [
  // gauche : texte « Wakfu TCG Return » (cadre blanc x≈12–26, texte x≈16–21)
  { paintFrom: 14, paintTo: 25, anchorL: 13, anchorR: 26 },
  // droite : texte « www.wtcg-return.fr » (cadre blanc x≈331–346, texte x≈335–341)
  { paintFrom: 334, paintTo: 343, anchorL: 333, anchorR: 345 },
];

/**
 * Reconstruit les bandes du filigrane dans un buffer RGBA brut, en place.
 */
function inpaint(data, W, H, C) {
  const sx = W / REF_W; // facteur d'échelle si l'image n'est pas en 358 px
  for (const b of BANDS) {
    const xL = Math.round(b.anchorL * sx);
    const xR = Math.round(b.anchorR * sx);
    const x0 = Math.round(b.paintFrom * sx);
    const x1 = Math.round(b.paintTo * sx);
    if (xR <= xL || xR >= W) continue;
    for (let y = 0; y < H; y++) {
      const iL = (y * W + xL) * C;
      const iR = (y * W + xR) * C;
      for (let x = x0; x <= x1; x++) {
        const t = (x - xL) / (xR - xL);
        const i = (y * W + x) * C;
        for (let ch = 0; ch < 3; ch++) {
          data[i + ch] = Math.round(
            data[iL + ch] * (1 - t) + data[iR + ch] * t,
          );
        }
        if (C === 4) data[i + 3] = 255;
      }
    }
  }
}

/**
 * Charge une image, retire le filigrane, agrandit ×scale, renvoie un buffer
 * encodé (webp par défaut). `scale=1` pour conserver la taille.
 */
async function processBuffer(
  srcBuf,
  { scale = 2, format = "webp", quality = 90 } = {},
) {
  const img = sharp(srcBuf).removeAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const W = info.width,
    H = info.height,
    C = info.channels;
  inpaint(data, W, H, C);

  let pipe = sharp(data, { raw: { width: W, height: H, channels: C } });
  if (scale !== 1) {
    pipe = pipe.resize(Math.round(W * scale), Math.round(H * scale), {
      kernel: "lanczos3",
    });
  }
  pipe = pipe.sharpen({ sigma: 0.6 });
  if (format === "webp") return pipe.webp({ quality, effort: 5 }).toBuffer();
  if (format === "png") return pipe.png({ compressionLevel: 9 }).toBuffer();
  return pipe.jpeg({ quality }).toBuffer();
}

module.exports = { inpaint, processBuffer, BANDS, REF_W };
