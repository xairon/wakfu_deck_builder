// Helper Edge (Deno) : RÉCONCILIATION + VALIDATION autoritative d'un deck.
//
// Le client POSTe un snapshot de son deck (create_game/join_game). Ce snapshot
// est UNTRUSTED : un client trafiqué peut y gonfler les stats du Héros/Havre-Sac
// (PV/PA/PM/Résistance) ou glisser un deck illégal. On :
//   (C1) remplace chaque objet-carte par sa version AUTORITATIVE (table `cards`,
//        par id) → les stats forgées sont écrasées avant setupEvents ;
//   (M2) valide la légalité structurelle (48 cartes, réserve 0/12, types
//        Héros/Havre-Sac, limite de copies) avant d'accepter la partie.
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { Card, Deck } from "../../../src/types/cards.ts";
import { loadCards } from "./cards.ts";

type DeckEntry = { card: Card; quantity?: number; isReserve?: boolean };

/** Normalise un nom pour la limite de copies canonique (par NOM, toutes
 *  éditions confondues — cf. règle métier). Minimal, sans dépendance `@/`. */
function canonName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isUnique(card: Card): boolean {
  const c = card as unknown as {
    rarity?: string;
    keywords?: { keyword?: string }[];
  };
  if (typeof c.rarity === "string" && /unique/i.test(c.rarity)) return true;
  return (c.keywords ?? []).some((k) => /unique/i.test(k?.keyword ?? ""));
}

export interface ReconcileResult {
  ok: boolean;
  error?: string;
  deck?: Deck;
}

/**
 * Recharge les cartes du deck depuis la table `cards` (source de vérité),
 * reconstruit le deck avec ces objets, et valide sa légalité. Renvoie le deck
 * RÉCONCILIÉ (à stocker/utiliser tel quel) ou une erreur.
 */
export async function reconcileAndValidateDeck(
  db: SupabaseClient,
  raw: unknown,
): Promise<ReconcileResult> {
  const d = raw as Partial<Deck> & { cards?: DeckEntry[] };
  if (!d?.hero?.id || !d?.havreSac?.id)
    return { ok: false, error: "DECK_INVALIDE" };
  const entries = (d.cards ?? []).filter((e): e is DeckEntry => !!e?.card?.id);

  const ids = [d.hero.id, d.havreSac.id, ...entries.map((e) => e.card.id)];
  const trusted = await loadCards(db, ids);

  const hero = trusted.get(d.hero.id);
  const havreSac = trusted.get(d.havreSac.id);
  if (!hero || hero.mainType !== "Héros")
    return { ok: false, error: "HERO_INVALIDE" };
  if (!havreSac || havreSac.mainType !== "Havre-Sac")
    return { ok: false, error: "HAVRESAC_INVALIDE" };

  // Réconciliation + comptage (par NOM canonique pour la limite de copies).
  const byName = new Map<string, { qty: number; unique: boolean }>();
  let pioche = 0;
  let reserve = 0;
  const reconciled: DeckEntry[] = [];
  for (const e of entries) {
    const card = trusted.get(e.card.id);
    if (!card) return { ok: false, error: "CARTE_INCONNUE" };
    const qty = Math.max(0, Math.floor(e.quantity ?? 0));
    if (qty === 0) continue;
    if (e.isReserve) reserve += qty;
    else pioche += qty;
    const key = canonName(card.name);
    const agg = byName.get(key) ?? { qty: 0, unique: isUnique(card) };
    agg.qty += qty;
    byName.set(key, agg);
    reconciled.push({ card, quantity: qty, isReserve: e.isReserve });
  }

  // Légalité (règles métier) : 48 en Pioche, Réserve exactement 0 ou 12,
  // limite de copies canonique (3, ou 1 si Unique).
  if (pioche !== 48) return { ok: false, error: "DECK_PAS_48" };
  if (reserve !== 0 && reserve !== 12)
    return { ok: false, error: "RESERVE_INVALIDE" };
  for (const { qty, unique } of byName.values()) {
    if (qty > (unique ? 1 : 3)) return { ok: false, error: "TROP_DE_COPIES" };
  }

  return {
    ok: true,
    deck: {
      ...(d as Deck),
      hero: hero as Deck["hero"],
      havreSac: havreSac as Deck["havreSac"],
      cards: reconciled as Deck["cards"],
    },
  };
}
