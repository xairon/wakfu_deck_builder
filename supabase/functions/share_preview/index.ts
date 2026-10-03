import { adminClient } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const shareId = url.searchParams.get("id");
  const siteUrl = Deno.env.get("SITE_URL") || "https://almanach-des-douze-xairons-projects.vercel.app";

  if (!shareId) {
    return new Response(
      `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${siteUrl}/decks"></head><body>Redirecting...</body></html>`,
      {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": `${siteUrl}/decks`,
          "Content-Type": "text/html; charset=utf-8",
        },
      },
    );
  }

  const db = adminClient();
  const { data: share, error } = await db
    .from("deck_shares")
    .select("id, name, hero_id, havre_sac_id, cards")
    .eq("id", shareId)
    .maybeSingle();

  if (error || !share) {
    const fallbackUrl = `${siteUrl}/deck/share?id=${encodeURIComponent(shareId)}`;
    return new Response(
      `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${fallbackUrl}"></head><body>Redirecting...</body></html>`,
      {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": fallbackUrl,
          "Content-Type": "text/html; charset=utf-8",
        },
      },
    );
  }

  // Résoudre les cartes du deck
  const heroId = share.hero_id;
  const cardIds: string[] = [];
  if (heroId) cardIds.push(heroId);
  if (share.havre_sac_id) cardIds.push(share.havre_sac_id);
  const cardsList: { cardId: string; quantity: number; isReserve?: boolean }[] = Array.isArray(share.cards) ? share.cards : [];
  for (const c of cardsList) {
    if (c.cardId && !cardIds.includes(c.cardId)) {
      cardIds.push(c.cardId);
    }
  }

  const { data: dbCards } = await db
    .from("cards")
    .select("id, data")
    .in("id", cardIds);

  const cardMap = new Map<string, any>();
  if (dbCards) {
    for (const c of dbCards) {
      cardMap.set(c.id, c.data);
    }
  }

  const heroCard = heroId ? cardMap.get(heroId) : null;
  const heroName = heroCard?.name || (heroId ? heroId : "Sans Héros");
  const totalCards = cardsList.reduce((acc, c) => acc + (c.quantity || 1), 0);

  // Échantillon de cartes pour la description
  const sampleCardNames = cardsList
    .slice(0, 5)
    .map((c) => {
      const cardData = cardMap.get(c.cardId);
      const name = cardData?.name || c.cardId;
      return `${c.quantity || 1}× ${name}`;
    })
    .join(", ");

  const deckTitle = `${share.name} — Deck Wakfu TCG`;
  const deckDesc = `Héros : ${heroName} · ${totalCards} cartes${sampleCardNames ? ` (${sampleCardNames}...)` : ""}. Cliquez pour consulter la decklist complète ou l'importer dans votre collection.`;

  // Image d'aperçu : vignette / scan du Héros
  const heroImgUrl = heroId
    ? `${siteUrl}/images/cards/thumbs/${heroId}_recto.webp`
    : `${siteUrl}/images/pwa-512x512.png`;

  const targetAppUrl = `${siteUrl}/deck/share?id=${encodeURIComponent(share.id)}`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(deckTitle)}</title>
  <meta name="description" content="${escapeHtml(deckDesc)}">
  
  <!-- Open Graph / Facebook / Discord -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(targetAppUrl)}">
  <meta property="og:title" content="${escapeHtml(deckTitle)}">
  <meta property="og:description" content="${escapeHtml(deckDesc)}">
  <meta property="og:image" content="${escapeHtml(heroImgUrl)}">
  <meta property="og:site_name" content="L'Almanach des Douze · Wakfu TCG">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${escapeHtml(targetAppUrl)}">
  <meta name="twitter:title" content="${escapeHtml(deckTitle)}">
  <meta name="twitter:description" content="${escapeHtml(deckDesc)}">
  <meta name="twitter:image" content="${escapeHtml(heroImgUrl)}">

  <!-- Redirection instantanée pour les navigateurs humains -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(targetAppUrl)}">
  <script>
    window.location.replace("${escapeHtml(targetAppUrl)}");
  </script>
</head>
<body style="font-family: sans-serif; padding: 2rem; background: #131316; color: #fff;">
  <h2>${escapeHtml(deckTitle)}</h2>
  <p>${escapeHtml(deckDesc)}</p>
  <p>Redirection vers <a href="${escapeHtml(targetAppUrl)}" style="color: #f04e22;">l'Almanach des Douze</a>...</p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
    },
  });
});
