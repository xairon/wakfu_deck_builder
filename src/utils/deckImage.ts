/**
 * Export d'un deck en image PNG partageable — rendu Canvas natif (aucune
 * dépendance). Les images de cartes sont same-origin, le canvas n'est donc
 * pas « tainted » et toDataURL/toBlob fonctionnent.
 */
import type { Deck } from "@/types/cards";
import { getIllustrationPath } from "@/utils/imagePaths";
import { cardElement } from "@/utils/cardDisplay";
import { elementColors } from "@/config/elementColors";

const PAPER = "#F6F5F1";
const INK = "#1B1A17";
const MUTED = "#6B6862";
const EMBER = "#F04E22";

const W = 1080;
const H = 1350;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const ir = img.width / img.height;
  const r = w / h;
  let sw = img.width;
  let sh = img.height;
  let sx = 0;
  let sy = 0;
  if (ir > r) {
    sw = img.height * r;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / r;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

export async function exportDeckImage(deck: Deck): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  try {
    await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts
      ?.ready;
  } catch {
    /* polices indisponibles — repli système */
  }

  const main = deck.cards.filter((c) => !c.isReserve);
  const totalMain = main.reduce((a, c) => a + c.quantity, 0);

  // Fond papier
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  // Filet d'encre épais en haut
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, 10);

  const M = 60;
  // Cartouche
  ctx.fillStyle = MUTED;
  ctx.font = "700 22px 'Space Mono', monospace";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("GRIMOIRE — L'ALMANACH DES DOUZE", M, 70);

  // Titre du deck
  ctx.fillStyle = INK;
  ctx.font = "600 56px Fraunces, Georgia, serif";
  const name = deck.name.length > 30 ? deck.name.slice(0, 29) + "…" : deck.name;
  ctx.fillText(name, M, 130);

  // Sous-titre : héros · havre-sac · cartes
  ctx.fillStyle = MUTED;
  ctx.font = "20px 'Space Mono', monospace";
  const sub = [deck.hero?.name, deck.havreSac?.name, `${totalMain}/48 CARTES`]
    .filter(Boolean)
    .join("  ·  ")
    .toUpperCase();
  ctx.fillText(sub, M, 165);

  // Bandeau illustration du héros
  const bx = M;
  const by = 195;
  const bw = W - 2 * M;
  const bh = 360;
  ctx.fillStyle = "#E5E2DA";
  ctx.fillRect(bx, by, bw, bh);
  if (deck.hero) {
    const heroImg =
      (await loadImage(getIllustrationPath(deck.hero.id))) ||
      (await loadImage(`/images/cards/${deck.hero.id}_recto.webp`));
    if (heroImg) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx, by, bw, bh);
      ctx.clip();
      drawCover(ctx, heroImg, bx, by, bw, bh);
      ctx.restore();
    }
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, bw, bh);

  // Répartition élémentaire (filet segmenté)
  const dist: Record<string, number> = {};
  for (const dc of main) {
    const el = cardElement(dc.card);
    dist[el] = (dist[el] || 0) + dc.quantity;
  }
  const distEntries = Object.entries(dist).sort((a, b) => b[1] - a[1]);
  const barY = by + bh + 40;
  let cx = bx;
  const barW = bw;
  ctx.fillStyle = "#E2DDD2";
  ctx.fillRect(bx, barY, barW, 8);
  for (const [el, count] of distEntries) {
    const segW = (count / Math.max(1, totalMain)) * barW;
    ctx.fillStyle = elementColors[el] || elementColors.neutre;
    ctx.fillRect(cx, barY, segW, 8);
    cx += segW;
  }
  // Légende
  ctx.font = "18px 'Space Mono', monospace";
  let lx = bx;
  for (const [el, count] of distEntries) {
    const label = `${el.charAt(0).toUpperCase() + el.slice(1)} ${count}`;
    ctx.fillStyle = elementColors[el] || elementColors.neutre;
    ctx.fillRect(lx, barY + 26, 14, 14);
    ctx.fillStyle = INK;
    ctx.fillText(label, lx + 22, barY + 38);
    lx += ctx.measureText(label).width + 60;
  }

  // Decklist (2 colonnes, triée par PA puis nom)
  const sorted = [...main].sort((a, b) => {
    const pa = (a.card.stats?.pa || 0) - (b.card.stats?.pa || 0);
    return pa !== 0 ? pa : a.card.name.localeCompare(b.card.name);
  });
  const listTop = barY + 90;
  const colW = (bw - 40) / 2;
  const lineH = 34;
  const maxLines = Math.floor((H - listTop - 80) / lineH);
  ctx.font = "22px Fraunces, Georgia, serif";
  sorted.slice(0, maxLines * 2).forEach((dc, i) => {
    const col = Math.floor(i / maxLines);
    const row = i % maxLines;
    const x = bx + col * (colW + 40);
    const y = listTop + row * lineH;
    ctx.fillStyle = EMBER;
    ctx.font = "700 20px 'Space Mono', monospace";
    ctx.fillText(`${dc.quantity}×`, x, y);
    ctx.fillStyle = INK;
    ctx.font = "22px Fraunces, Georgia, serif";
    let cn = dc.card.name;
    while (ctx.measureText(cn).width > colW - 50 && cn.length > 4)
      cn = cn.slice(0, -2) + "…";
    ctx.fillText(cn, x + 44, y);
  });

  // Pied
  ctx.fillStyle = INK;
  ctx.fillRect(0, H - 4, W, 4);
  ctx.fillStyle = MUTED;
  ctx.font = "18px 'Space Mono', monospace";
  ctx.fillText(
    "wakfu-deck-builder · l'almanach des douze".toUpperCase(),
    M,
    H - 24,
  );

  // Téléchargement
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `${deck.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "deck"}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
